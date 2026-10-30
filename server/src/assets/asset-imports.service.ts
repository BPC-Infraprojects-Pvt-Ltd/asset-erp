import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import {
  AssetAvailability,
  AssetCriticality,
  AssetCondition,
  AssetImportStatus,
  AssetTrackingMode,
  UserRole,
} from '../generated/prisma/enums.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { LocationsService } from '../locations/locations.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  parseAssetImportCsv,
  type AssetImportCsvRow,
  type AssetImportIssue,
} from './asset-import-csv.js';
import { parseAssetDateOnly } from './asset-date-only.js';
import { AssetsService, type ImportedAssetWrite } from './assets.service.js';

const importJobSelect = {
  id: true,
  organizationId: true,
  createdByUserId: true,
  status: true,
  fileChecksum: true,
  totalRows: true,
  validRows: true,
  errorCount: true,
  createdCount: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  committedAt: true,
} satisfies Prisma.AssetImportJobSelect;

const importJobCommandSelect = {
  ...importJobSelect,
  previewIdempotencyKey: true,
  previewPayloadHash: true,
  commitIdempotencyKey: true,
  commitPayloadHash: true,
} satisfies Prisma.AssetImportJobSelect;
type AssetImportJobCommand = Prisma.AssetImportJobGetPayload<{
  select: typeof importJobCommandSelect;
}>;

const importRowErrorSelect = {
  id: true,
  organizationId: true,
  importJobId: true,
  rowNumber: true,
  fieldName: true,
  code: true,
  message: true,
  createdAt: true,
} satisfies Prisma.AssetImportRowErrorSelect;

interface ImportValidation {
  validRows: ImportedAssetWrite[];
  issues: AssetImportIssue[];
}

@Injectable()
export class AssetImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locations: LocationsService,
    private readonly assets: AssetsService,
  ) {}

  async list(actor: AuthenticatedActor, page: number, pageSize: number) {
    this.requireManager(actor);
    const where: Prisma.AssetImportJobWhereInput = {
      organizationId: actor.organizationId,
      createdByUserId: actor.userId,
    };
    const [items, total] = await Promise.all([
      this.prisma.assetImportJob.findMany({
        where,
        select: importJobSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.assetImportJob.count({ where }),
    ]);
    return { items, page, pageSize, total };
  }

  async get(actor: AuthenticatedActor, importJobId: string) {
    this.requireManager(actor);
    const job = await this.prisma.assetImportJob.findFirst({
      where: {
        id: importJobId,
        organizationId: actor.organizationId,
        createdByUserId: actor.userId,
      },
      select: importJobSelect,
    });
    if (!job) throw new NotFoundException('Asset import job not found');
    return job;
  }

  async errors(actor: AuthenticatedActor, importJobId: string) {
    this.requireManager(actor);
    const job = await this.prisma.assetImportJob.findFirst({
      where: {
        id: importJobId,
        organizationId: actor.organizationId,
        createdByUserId: actor.userId,
      },
      select: { id: true },
    });
    if (!job) throw new NotFoundException('Asset import job not found');
    return this.prisma.assetImportRowError.findMany({
      where: { organizationId: actor.organizationId, importJobId },
      select: importRowErrorSelect,
      orderBy: [{ rowNumber: 'asc' }, { fieldName: 'asc' }, { id: 'asc' }],
      take: 2000,
    });
  }

  async preview(
    actor: AuthenticatedActor,
    idempotencyKey: string | undefined,
    file: Buffer,
  ) {
    this.requireManager(actor);
    const key = this.requireKey(idempotencyKey);
    const fileChecksum = this.checksum(file);
    const payloadHash = this.hash({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      operation: 'asset-import.preview',
      fileChecksum,
    });
    const accessibleLocationIds =
      (await this.locations.getAccessibleLocationIds(actor)) ?? [];
    const parsed = parseAssetImportCsv(file);
    const validation = parsed.issues.length
      ? { validRows: [], issues: parsed.issues }
      : await this.validateRows(
          this.prisma,
          actor,
          accessibleLocationIds,
          parsed.rows,
        );
    const issues = this.uniqueIssues(validation.issues);
    const validRows = validation.validRows.length;
    const status = issues.length
      ? AssetImportStatus.FAILED
      : AssetImportStatus.PREVIEW_READY;

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.assetImportJob.findFirst({
            where: {
              organizationId: actor.organizationId,
              createdByUserId: actor.userId,
              previewIdempotencyKey: key,
            },
            select: importJobCommandSelect,
          });
          if (existing) {
            if (existing.previewPayloadHash !== payloadHash) {
              throw new ConflictException(
                'This Idempotency-Key was already used with a different import file',
              );
            }
            return {
              ...(await this.previewResponse(tx, existing)),
              sampleRows: this.sampleRows(parsed.rows),
            };
          }
          const job = await tx.assetImportJob.create({
            data: {
              organizationId: actor.organizationId,
              createdByUserId: actor.userId,
              status,
              fileChecksum,
              totalRows: parsed.totalRows,
              validRows,
              errorCount: issues.length,
              previewIdempotencyKey: key,
              previewPayloadHash: payloadHash,
            },
            select: importJobSelect,
          });
          await this.persistIssues(tx, actor.organizationId, job.id, issues);
          return {
            job,
            errors: issues.map((issue) => ({
              ...issue,
              importJobId: job.id,
            })),
            sampleRows: this.sampleRows(parsed.rows),
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.assetImportJob.findFirst({
          where: {
            organizationId: actor.organizationId,
            createdByUserId: actor.userId,
            previewIdempotencyKey: key,
          },
          select: importJobCommandSelect,
        });
        if (existing?.previewPayloadHash === payloadHash) {
          return {
            ...(await this.previewResponse(this.prisma, existing)),
            sampleRows: this.sampleRows(parsed.rows),
          };
        }
        throw new ConflictException(
          'This Idempotency-Key was already used with a different import file',
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'The import job changed concurrently. Retry with the same Idempotency-Key.',
        );
      }
      throw error;
    }
  }

  async commit(
    actor: AuthenticatedActor,
    importJobId: string,
    version: number,
    idempotencyKey: string | undefined,
    file: Buffer,
  ) {
    this.requireManager(actor);
    const key = this.requireKey(idempotencyKey);
    const fileChecksum = this.checksum(file);
    const jobBeforeCommit = await this.prisma.assetImportJob.findFirst({
      where: {
        id: importJobId,
        organizationId: actor.organizationId,
        createdByUserId: actor.userId,
      },
      select: importJobCommandSelect,
    });
    if (!jobBeforeCommit) {
      throw new NotFoundException('Asset import job not found');
    }
    if (jobBeforeCommit.fileChecksum !== fileChecksum) {
      throw new UnprocessableEntityException(
        'The selected file does not match the file validated in this import job',
      );
    }
    const commitPayloadHash = this.hash({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      operation: 'asset-import.commit',
      importJobId,
      fileChecksum,
    });
    if (jobBeforeCommit.status === AssetImportStatus.COMMITTED) {
      if (
        jobBeforeCommit.commitIdempotencyKey === key &&
        jobBeforeCommit.commitPayloadHash === commitPayloadHash
      ) {
        return { job: this.publicJob(jobBeforeCommit), errors: [] };
      }
      throw new ConflictException('This import job has already been committed');
    }
    if (
      jobBeforeCommit.status === AssetImportStatus.FAILED &&
      jobBeforeCommit.commitIdempotencyKey === key &&
      jobBeforeCommit.commitPayloadHash === commitPayloadHash
    ) {
      return {
        job: this.publicJob(jobBeforeCommit),
        errors: await this.errors(actor, importJobId),
      };
    }
    if (jobBeforeCommit.status !== AssetImportStatus.PREVIEW_READY) {
      throw new ConflictException(
        'Only a valid preview-ready import can be committed',
      );
    }
    if (jobBeforeCommit.version !== version) {
      throw new ConflictException(
        'The import job changed since it was loaded. Reload before committing.',
      );
    }

    const parsed = parseAssetImportCsv(file);
    if (parsed.issues.length) {
      throw new ConflictException(
        'The file no longer passes validation. Create a new preview.',
      );
    }
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const accessibleLocationIds =
            (await this.locations.getAccessibleLocationIds(actor, tx)) ?? [];
          const current = await tx.assetImportJob.findFirst({
            where: {
              id: importJobId,
              organizationId: actor.organizationId,
              createdByUserId: actor.userId,
            },
            select: importJobCommandSelect,
          });
          if (!current) {
            throw new NotFoundException('Asset import job not found');
          }
          if (current.status === AssetImportStatus.COMMITTED) {
            if (
              current.commitIdempotencyKey === key &&
              current.commitPayloadHash === commitPayloadHash
            ) {
              return { job: this.publicJob(current), errors: [] };
            }
            throw new ConflictException(
              'This import job has already been committed',
            );
          }
          if (
            current.status !== AssetImportStatus.PREVIEW_READY ||
            current.version !== version
          ) {
            throw new ConflictException('The import job changed before commit');
          }

          const validation = await this.validateRows(
            tx,
            actor,
            accessibleLocationIds,
            parsed.rows,
          );
          const issues = this.uniqueIssues(validation.issues);
          if (issues.length) {
            const failed = await tx.assetImportJob.updateMany({
              where: {
                id: importJobId,
                organizationId: actor.organizationId,
                createdByUserId: actor.userId,
                version,
                status: AssetImportStatus.PREVIEW_READY,
              },
              data: {
                status: AssetImportStatus.FAILED,
                validRows: validation.validRows.length,
                errorCount: issues.length,
                commitIdempotencyKey: key,
                commitPayloadHash,
                version: { increment: 1 },
              },
            });
            if (failed.count !== 1) {
              throw new ConflictException(
                'The import job changed during commit',
              );
            }
            await this.persistIssues(
              tx,
              actor.organizationId,
              importJobId,
              issues,
            );
            return {
              job: await tx.assetImportJob.findFirstOrThrow({
                where: {
                  id: importJobId,
                  organizationId: actor.organizationId,
                },
                select: importJobSelect,
              }),
              errors: issues.map((issue) => ({
                ...issue,
                importJobId,
              })),
            };
          }

          const committing = await tx.assetImportJob.updateMany({
            where: {
              id: importJobId,
              organizationId: actor.organizationId,
              createdByUserId: actor.userId,
              version,
              status: AssetImportStatus.PREVIEW_READY,
            },
            data: {
              status: AssetImportStatus.COMMITTING,
              commitIdempotencyKey: key,
              commitPayloadHash,
              version: { increment: 1 },
            },
          });
          if (committing.count !== 1) {
            throw new ConflictException('The import job changed during commit');
          }

          const createdCount = await this.assets.createImportedAssets(
            tx,
            actor,
            importJobId,
            accessibleLocationIds,
            validation.validRows,
          );
          const completed = await tx.assetImportJob.updateMany({
            where: {
              id: importJobId,
              organizationId: actor.organizationId,
              createdByUserId: actor.userId,
              version: version + 1,
              status: AssetImportStatus.COMMITTING,
            },
            data: {
              status: AssetImportStatus.COMMITTED,
              createdCount,
              committedAt: new Date(),
              version: { increment: 1 },
            },
          });
          if (completed.count !== 1) {
            throw new ConflictException('The import job changed during commit');
          }
          return {
            job: await tx.assetImportJob.findFirstOrThrow({
              where: {
                id: importJobId,
                organizationId: actor.organizationId,
              },
              select: importJobSelect,
            }),
            errors: [],
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existingCommit = await this.prisma.assetImportJob.findFirst({
          where: {
            organizationId: actor.organizationId,
            createdByUserId: actor.userId,
            commitIdempotencyKey: key,
          },
          select: importJobCommandSelect,
        });
        if (
          existingCommit?.id === importJobId &&
          existingCommit.status === AssetImportStatus.COMMITTED &&
          existingCommit.commitPayloadHash === commitPayloadHash
        ) {
          return { job: existingCommit, errors: [] };
        }
        if (existingCommit) {
          throw new ConflictException(
            'This Idempotency-Key was already used for a different import',
          );
        }
        return this.failCommitForConcurrentDuplicate(
          actor,
          importJobId,
          version,
          key,
          commitPayloadHash,
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'Assets changed concurrently. Re-preview the file before retrying commit.',
        );
      }
      throw error;
    }
  }

  private async failCommitForConcurrentDuplicate(
    actor: AuthenticatedActor,
    importJobId: string,
    version: number,
    key: string,
    commitPayloadHash: string,
  ) {
    const issue: AssetImportIssue = {
      rowNumber: 1,
      fieldName: 'commit',
      code: 'concurrent_duplicate',
      message:
        'An asset tag was registered concurrently. Run a new preview before retrying.',
    };
    return this.prisma.$transaction(async (tx) => {
      const failed = await tx.assetImportJob.updateMany({
        where: {
          id: importJobId,
          organizationId: actor.organizationId,
          createdByUserId: actor.userId,
          version,
          status: AssetImportStatus.PREVIEW_READY,
        },
        data: {
          status: AssetImportStatus.FAILED,
          errorCount: 1,
          commitIdempotencyKey: key,
          commitPayloadHash,
          version: { increment: 1 },
        },
      });
      if (failed.count !== 1) {
        throw new ConflictException('The import job changed during commit');
      }
      await this.persistIssues(tx, actor.organizationId, importJobId, [issue]);
      return {
        job: await tx.assetImportJob.findFirstOrThrow({
          where: { id: importJobId, organizationId: actor.organizationId },
          select: importJobSelect,
        }),
        errors: [{ ...issue, importJobId }],
      };
    });
  }

  private async validateRows(
    db: PrismaService | Prisma.TransactionClient,
    actor: AuthenticatedActor,
    accessibleLocationIds: string[],
    rows: AssetImportCsvRow[],
  ): Promise<ImportValidation> {
    const issues: AssetImportIssue[] = [];
    const seenTags = new Set<string>();
    const specificationsByRow = new Map<number, Record<string, string>>();
    for (const row of rows) {
      if (!row.assetTag || row.assetTag.length > 100) {
        issues.push(this.issue(row.rowNumber, 'assetTag', 'invalid_asset_tag'));
      }
      if (row.assetTag && seenTags.has(row.assetTag)) {
        issues.push(this.issue(row.rowNumber, 'assetTag', 'duplicate_in_file'));
      }
      if (row.assetTag) seenTags.add(row.assetTag);
      if (!row.categoryCode || row.categoryCode.length > 60) {
        issues.push(
          this.issue(row.rowNumber, 'categoryCode', 'invalid_category'),
        );
      }
      if (!row.locationCode || row.locationCode.length > 60) {
        issues.push(
          this.issue(row.rowNumber, 'locationCode', 'invalid_location'),
        );
      }
      if (!this.isInitialAvailability(row.availability)) {
        issues.push(
          this.issue(row.rowNumber, 'availability', 'invalid_availability'),
        );
      }
      if (!this.isCondition(row.condition)) {
        issues.push(
          this.issue(row.rowNumber, 'condition', 'invalid_condition'),
        );
      } else if (
        row.condition === AssetCondition.NONFUNCTIONAL &&
        row.availability === AssetAvailability.AVAILABLE
      ) {
        issues.push(
          this.issue(
            row.rowNumber,
            'availability',
            'invalid_state_combination',
          ),
        );
      }
      if (row.criticality && !this.isCriticality(row.criticality)) {
        issues.push(
          this.issue(row.rowNumber, 'criticality', 'invalid_criticality'),
        );
      }
      for (const [fieldName, value, maxLength] of [
        ['manufacturer', row.manufacturer, 150],
        ['model', row.model, 150],
        ['serialNumber', row.serialNumber, 150],
        ['sourceReference', row.sourceReference, 150],
        ['notes', row.notes, 2000],
        ['warrantyReference', row.warrantyReference, 150],
      ] as const) {
        if (value.length > maxLength) {
          issues.push(this.issue(row.rowNumber, fieldName, 'value_too_long'));
        }
      }
      for (const [fieldName, value] of [
        ['purchaseDate', row.purchaseDate],
        ['warrantyExpiresOn', row.warrantyExpiresOn],
      ] as const) {
        if (value && !parseAssetDateOnly(value)) {
          issues.push(this.issue(row.rowNumber, fieldName, 'invalid_date'));
        }
      }
      if (row.specifications.length > 5000) {
        issues.push(
          this.issue(row.rowNumber, 'specifications', 'invalid_specifications'),
        );
      } else if (row.specifications.trim()) {
        try {
          const parsed = JSON.parse(row.specifications) as unknown;
          if (
            typeof parsed !== 'object' ||
            parsed === null ||
            Array.isArray(parsed)
          ) {
            throw new Error('Specification values must be strings');
          }
          const specificationValues: Record<string, string> = {};
          for (const [fieldKey, fieldValue] of Object.entries(parsed)) {
            if (typeof fieldValue !== 'string') {
              throw new Error('Specification values must be strings');
            }
            specificationValues[fieldKey] = fieldValue;
          }
          specificationsByRow.set(row.rowNumber, specificationValues);
        } catch {
          issues.push(
            this.issue(
              row.rowNumber,
              'specifications',
              'invalid_specifications',
            ),
          );
        }
      }
    }

    const [categories, locations, existingAssets] = await Promise.all([
      db.assetCategory.findMany({
        where: {
          organizationId: actor.organizationId,
          code: { in: [...new Set(rows.map((row) => row.categoryCode))] },
          isActive: true,
          trackingMode: AssetTrackingMode.INDIVIDUAL,
        },
        select: { id: true, code: true, specificationFields: true },
      }),
      db.location.findMany({
        where: {
          organizationId: actor.organizationId,
          code: { in: [...new Set(rows.map((row) => row.locationCode))] },
          id: { in: accessibleLocationIds },
          isActive: true,
        },
        select: { id: true, code: true },
      }),
      db.asset.findMany({
        where: {
          organizationId: actor.organizationId,
          assetTag: { in: [...new Set(rows.map((row) => row.assetTag))] },
        },
        select: { assetTag: true },
      }),
    ]);
    const categoryByCode = new Map(
      categories.map((category) => [category.code, category]),
    );
    const locationByCode = new Map(
      locations.map((location) => [location.code, location.id]),
    );
    const existingTags = new Set(existingAssets.map((asset) => asset.assetTag));
    for (const row of rows) {
      const category = categoryByCode.get(row.categoryCode);
      if (!category) {
        issues.push(
          this.issue(row.rowNumber, 'categoryCode', 'category_not_found'),
        );
      } else {
        try {
          this.assets.validateAssetSpecifications(
            category.specificationFields,
            specificationsByRow.get(row.rowNumber),
          );
        } catch {
          issues.push(
            this.issue(
              row.rowNumber,
              'specifications',
              'invalid_specifications',
            ),
          );
        }
      }
      if (!locationByCode.has(row.locationCode)) {
        issues.push(
          this.issue(row.rowNumber, 'locationCode', 'location_not_found'),
        );
      }
      if (row.assetTag && existingTags.has(row.assetTag)) {
        issues.push(
          this.issue(row.rowNumber, 'assetTag', 'duplicate_in_register'),
        );
      }
    }

    const errorRows = new Set(issues.map((issue) => issue.rowNumber));
    const uniqueIssues = this.uniqueIssues(issues);
    const validRows: ImportedAssetWrite[] = rows
      .filter(
        (row) =>
          !errorRows.has(row.rowNumber) &&
          categoryByCode.has(row.categoryCode) &&
          locationByCode.has(row.locationCode),
      )
      .map((row) => {
        const category = categoryByCode.get(row.categoryCode);
        const locationId = locationByCode.get(row.locationCode);
        if (!category || !locationId) {
          throw new ConflictException(
            'An import reference changed during validation',
          );
        }
        return {
          rowNumber: row.rowNumber,
          assetTag: row.assetTag,
          categoryId: category.id,
          locationId,
          availability: row.availability as AssetAvailability,
          condition: row.condition as AssetCondition,
          manufacturer: row.manufacturer || undefined,
          model: row.model || undefined,
          serialNumber: row.serialNumber || undefined,
          sourceReference: row.sourceReference || undefined,
          notes: row.notes || undefined,
          specifications: specificationsByRow.get(row.rowNumber),
          criticality: row.criticality
            ? (row.criticality as AssetCriticality)
            : undefined,
          purchaseDate: row.purchaseDate || undefined,
          warrantyExpiresOn: row.warrantyExpiresOn || undefined,
          warrantyReference: row.warrantyReference || undefined,
        };
      });
    return { validRows, issues: uniqueIssues };
  }

  private async previewResponse(
    tx: Prisma.TransactionClient | PrismaService,
    job: AssetImportJobCommand,
  ) {
    const errors = await tx.assetImportRowError.findMany({
      where: {
        organizationId: job.organizationId as string,
        importJobId: job.id,
      },
      select: importRowErrorSelect,
      orderBy: [{ rowNumber: 'asc' }, { fieldName: 'asc' }, { id: 'asc' }],
      take: 2000,
    });
    return { job: this.publicJob(job), errors };
  }

  private sampleRows(rows: AssetImportCsvRow[]) {
    return rows.slice(0, 5).map((row) => ({
      rowNumber: row.rowNumber,
      assetTag: row.assetTag,
      categoryCode: row.categoryCode,
      locationCode: row.locationCode,
      availability: row.availability,
      condition: row.condition,
    }));
  }

  private publicJob(job: AssetImportJobCommand) {
    const {
      previewIdempotencyKey: _key,
      previewPayloadHash: _hash,
      commitIdempotencyKey: _commitKey,
      commitPayloadHash: _commitHash,
      ...safeJob
    } = job;
    return safeJob;
  }

  private async persistIssues(
    tx: Prisma.TransactionClient,
    organizationId: string,
    importJobId: string,
    issues: AssetImportIssue[],
  ): Promise<void> {
    if (!issues.length) return;
    await tx.assetImportRowError.createMany({
      data: issues.map((issue) => ({
        organizationId,
        importJobId,
        rowNumber: issue.rowNumber,
        fieldName: issue.fieldName,
        code: issue.code,
        message: issue.message,
      })),
    });
  }

  private uniqueIssues(issues: AssetImportIssue[]): AssetImportIssue[] {
    const seen = new Set<string>();
    const unique: AssetImportIssue[] = [];
    for (const issue of issues) {
      const key = `${issue.rowNumber}:${issue.fieldName}:${issue.code}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(issue);
      if (unique.length >= 2000) break;
    }
    return unique;
  }

  private issue(
    rowNumber: number,
    fieldName: string,
    code: string,
  ): AssetImportIssue {
    const messages: Record<string, string> = {
      invalid_asset_tag:
        'Asset tag is required and must be at most 100 characters.',
      duplicate_in_file: 'Asset tag is duplicated within this file.',
      invalid_category: 'An active individual-tracking category is required.',
      invalid_location: 'An active location code is required.',
      invalid_availability:
        'Availability must be AVAILABLE, QUARANTINED, or UNAVAILABLE.',
      invalid_condition: 'Condition value is not supported.',
      invalid_state_combination:
        'A nonfunctional asset cannot be imported as available.',
      value_too_long: 'Field exceeds its supported maximum length.',
      category_not_found: 'Active individual-tracking category was not found.',
      location_not_found:
        'Active location was not found in your assigned scope.',
      duplicate_in_register: 'Asset tag already exists in the register.',
    };
    return {
      rowNumber,
      fieldName,
      code,
      message: messages[code] ?? 'Row failed validation.',
    };
  }

  private isInitialAvailability(
    value: string,
  ): value is 'AVAILABLE' | 'QUARANTINED' | 'UNAVAILABLE' {
    return ['AVAILABLE', 'QUARANTINED', 'UNAVAILABLE'].includes(value);
  }

  private isCondition(value: string): value is AssetCondition {
    return Object.values(AssetCondition).includes(value as AssetCondition);
  }

  private isCriticality(value: string): value is AssetCriticality {
    return (
      value === AssetCriticality.LOW ||
      value === AssetCriticality.MEDIUM ||
      value === AssetCriticality.HIGH ||
      value === AssetCriticality.CRITICAL
    );
  }

  private checksum(file: Buffer): string {
    return createHash('sha256').update(file).digest('hex');
  }

  private hash(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private requireKey(value: string | undefined): string {
    const key = value?.trim();
    if (!key || key.length > 100) {
      throw new UnprocessableEntityException(
        'A valid Idempotency-Key header is required',
      );
    }
    return key;
  }

  private requireManager(actor: AuthenticatedActor): void {
    if (actor.role !== UserRole.ASSET_MANAGER) {
      throw new ForbiddenException(
        'Asset imports are available to Asset Managers only',
      );
    }
  }
}
