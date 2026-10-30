import {
  BadRequestException,
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
  AssetHistoryEventType,
  AssetLifecycle,
  AssetTrackingMode,
  AssetTransferLineStatus,
  AssetTransferStatus,
  AssetVerification,
  AssignmentRecipientType,
  UserRole,
} from '../generated/prisma/enums.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { LocationsService } from '../locations/locations.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseAssetDateOnly } from './asset-date-only.js';
import type { CreateAssetCategoryDto } from './dto/create-asset-category.dto.js';
import type { CreateAssetDto } from './dto/create-asset.dto.js';
import type { ListAssetCategoriesQueryDto } from './dto/list-asset-categories-query.dto.js';
import type { ListAssetsQueryDto } from './dto/list-assets-query.dto.js';
import type { UpdateAssetProfileDto } from './dto/update-asset-profile.dto.js';
import type { UpdateAssetCategoryDto } from './dto/update-asset-category.dto.js';
import type { AssetCategorySpecificationFieldDto } from './dto/asset-category-specification-field.dto.js';
import type {
  CreateAssetReservationDto,
  ListAssetReservationsQueryDto,
} from './dto/create-asset-reservation.dto.js';
import type {
  CreateAssetTransferDto,
  ReceiveAssetTransferLineDto,
} from './dto/create-asset-transfer.dto.js';
import type {
  CreateAssetAssignmentDto,
  ListAssetAssignmentsQueryDto,
  ReturnAssetAssignmentDto,
} from './dto/create-asset-assignment.dto.js';
import type {
  InstallAssetComponentDto,
  RemoveAssetComponentDto,
} from './dto/install-asset-component.dto.js';

const categorySelect = {
  id: true,
  organizationId: true,
  code: true,
  name: true,
  trackingMode: true,
  specificationFields: true,
  isActive: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AssetCategorySelect;

const assetSelect = {
  id: true,
  organizationId: true,
  assetTag: true,
  categoryId: true,
  manufacturer: true,
  model: true,
  serialNumber: true,
  locationId: true,
  lifecycle: true,
  availability: true,
  condition: true,
  verification: true,
  criticality: true,
  commissioningDate: true,
  purchaseDate: true,
  warrantyExpiresOn: true,
  warrantyReference: true,
  sourceReference: true,
  notes: true,
  specifications: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: {
      id: true,
      code: true,
      name: true,
      specificationFields: true,
    },
  },
  location: { select: { id: true, code: true, name: true } },
} satisfies Prisma.AssetSelect;

const assetRelationshipSelect = {
  id: true,
  organizationId: true,
  parentAssetId: true,
  childAssetId: true,
  createdByUserId: true,
  endedByUserId: true,
  createdAt: true,
  endedAt: true,
  parentAsset: {
    select: {
      id: true,
      assetTag: true,
      category: { select: { code: true, name: true } },
    },
  },
  childAsset: {
    select: {
      id: true,
      assetTag: true,
      category: { select: { code: true, name: true } },
    },
  },
} satisfies Prisma.AssetRelationshipSelect;

const componentInstallationSelect = {
  id: true,
  organizationId: true,
  hostAssetId: true,
  componentAssetId: true,
  installedByUserId: true,
  installedAt: true,
  installNote: true,
  removedByUserId: true,
  removedAt: true,
  removalNote: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  hostAsset: {
    select: {
      id: true,
      assetTag: true,
      lifecycle: true,
      availability: true,
      category: { select: { code: true, name: true } },
      location: { select: { id: true, code: true, name: true } },
    },
  },
  componentAsset: {
    select: {
      id: true,
      assetTag: true,
      lifecycle: true,
      availability: true,
      category: { select: { code: true, name: true } },
      location: { select: { id: true, code: true, name: true } },
    },
  },
  installedBy: { select: { displayName: true } },
  removedBy: { select: { displayName: true } },
} satisfies Prisma.ComponentInstallationSelect;

const componentInstallationCommandSelect = {
  ...componentInstallationSelect,
  installIdempotencyKey: true,
  installPayloadHash: true,
  removalIdempotencyKey: true,
  removalPayloadHash: true,
} satisfies Prisma.ComponentInstallationSelect;

const assetReservationSelect = {
  id: true,
  organizationId: true,
  assetId: true,
  employeeId: true,
  startDate: true,
  expiresOn: true,
  reason: true,
  createdByUserId: true,
  cancelledByUserId: true,
  cancelledAt: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  asset: {
    select: {
      id: true,
      assetTag: true,
      location: { select: { id: true, code: true, name: true } },
      category: { select: { id: true, code: true, name: true } },
    },
  },
  employee: {
    select: { id: true, employeeNumber: true, displayName: true },
  },
} satisfies Prisma.AssetReservationSelect;

const assetAssignmentSelect = {
  id: true,
  organizationId: true,
  assetId: true,
  recipientType: true,
  employeeId: true,
  recipientLabel: true,
  issuedByUserId: true,
  issuedAt: true,
  expectedReturnDate: true,
  conditionAtIssue: true,
  accessoriesAtIssue: true,
  purpose: true,
  acknowledgedAt: true,
  returnedAt: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  asset: {
    select: {
      id: true,
      assetTag: true,
      location: { select: { id: true, code: true, name: true } },
      category: { select: { id: true, code: true, name: true } },
    },
  },
  employee: {
    select: { id: true, employeeNumber: true, displayName: true },
  },
  returnRecord: {
    select: {
      id: true,
      returnedAt: true,
      conditionAtReturn: true,
      accessoriesReturned: true,
      missingItems: true,
      followUp: true,
      inspectionRequired: true,
      receivedBy: { select: { displayName: true } },
    },
  },
} satisfies Prisma.AssetAssignmentSelect;

const assetTransferSelect = {
  id: true,
  organizationId: true,
  sourceLocationId: true,
  destinationLocationId: true,
  reason: true,
  status: true,
  requestedByUserId: true,
  version: true,
  dispatchedAt: true,
  createdAt: true,
  updatedAt: true,
  sourceLocation: { select: { id: true, code: true, name: true } },
  destinationLocation: { select: { id: true, code: true, name: true } },
  lines: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      assetId: true,
      assetVersionAtCreate: true,
      assetVersionAtDispatch: true,
      status: true,
      version: true,
      receivedAt: true,
      conditionAtReceipt: true,
      inspectionRequired: true,
      exceptionNote: true,
      asset: {
        select: {
          id: true,
          assetTag: true,
          condition: true,
          availability: true,
          location: { select: { id: true, code: true, name: true } },
          category: { select: { code: true, name: true } },
        },
      },
    },
  },
} satisfies Prisma.AssetTransferSelect;

export interface ImportedAssetWrite {
  rowNumber: number;
  assetTag: string;
  categoryId: string;
  locationId: string;
  availability: AssetAvailability;
  condition: AssetCondition;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  sourceReference?: string;
  notes?: string;
  specifications?: Record<string, string>;
  criticality?: AssetCriticality;
  purchaseDate?: string;
  warrantyExpiresOn?: string;
  warrantyReference?: string;
}

type ComponentInstallationCommand = Prisma.ComponentInstallationGetPayload<{
  select: typeof componentInstallationCommandSelect;
}>;

type AssetReservationRecord = Prisma.AssetReservationGetPayload<{
  select: typeof assetReservationSelect;
}>;

function utcDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function reservationStatus(reservation: {
  startDate: Date;
  expiresOn: Date;
  cancelledAt: Date | null;
}): 'SCHEDULED' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED' {
  if (reservation.cancelledAt) return 'CANCELLED';
  const today = utcDateOnly(new Date());
  if (utcDateOnly(reservation.startDate) > today) return 'SCHEDULED';
  if (utcDateOnly(reservation.expiresOn) < today) return 'EXPIRED';
  return 'ACTIVE';
}

function reservationResponse(reservation: AssetReservationRecord) {
  return {
    id: reservation.id,
    organizationId: reservation.organizationId,
    assetId: reservation.assetId,
    employeeId: reservation.employeeId,
    startDate: reservation.startDate,
    expiresOn: reservation.expiresOn,
    reason: reservation.reason,
    createdByUserId: reservation.createdByUserId,
    cancelledByUserId: reservation.cancelledByUserId,
    cancelledAt: reservation.cancelledAt,
    version: reservation.version,
    createdAt: reservation.createdAt,
    updatedAt: reservation.updatedAt,
    asset: reservation.asset,
    employee: reservation.employee,
    status: reservationStatus(reservation),
  };
}

type AssetAssignmentRecord = Prisma.AssetAssignmentGetPayload<{
  select: typeof assetAssignmentSelect;
}>;

function assignmentResponse(assignment: AssetAssignmentRecord) {
  const today = utcDateOnly(new Date());
  const dueDate = assignment.expectedReturnDate
    ? utcDateOnly(assignment.expectedReturnDate)
    : null;
  return {
    ...assignment,
    status: assignment.returnedAt
      ? 'RETURNED'
      : dueDate && dueDate < today
        ? 'OVERDUE'
        : 'OPEN',
    acknowledgementStatus: assignment.acknowledgedAt
      ? 'ACKNOWLEDGED'
      : 'PENDING',
  };
}

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locations: LocationsService,
  ) {}

  async listCategories(
    actor: AuthenticatedActor,
    query: ListAssetCategoriesQueryDto,
  ) {
    this.requireCategoryReader(actor);
    if (query.includeInactive) this.requireAdministrator(actor);
    const where: Prisma.AssetCategoryWhereInput = {
      organizationId: actor.organizationId,
      ...(query.trackingMode ? { trackingMode: query.trackingMode } : {}),
      ...(query.includeInactive ? {} : { isActive: true }),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.assetCategory.findMany({
        where,
        select: categorySelect,
        orderBy: [{ code: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.assetCategory.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async setCategoryActive(
    actor: AuthenticatedActor,
    categoryId: string,
    isActive: boolean,
  ) {
    this.requireAdministrator(actor);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.assetCategory.updateMany({
        where: { id: categoryId, organizationId: actor.organizationId },
        data: { isActive, version: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new NotFoundException('Asset category not found');
      }
      return tx.assetCategory.findFirstOrThrow({
        where: { id: categoryId, organizationId: actor.organizationId },
        select: categorySelect,
      });
    });
  }

  async getCategory(actor: AuthenticatedActor, categoryId: string) {
    this.requireCategoryReader(actor);
    const category = await this.prisma.assetCategory.findFirst({
      where: { id: categoryId, organizationId: actor.organizationId },
      select: categorySelect,
    });
    if (!category) throw new NotFoundException('Asset category not found');
    return category;
  }

  async createCategory(actor: AuthenticatedActor, dto: CreateAssetCategoryDto) {
    this.requireAdministrator(actor);
    const specificationFields: Prisma.InputJsonArray =
      this.validateCategorySpecificationFields(dto.specificationFields).map(
        ({ key, label, required }) => ({ key, label, required }),
      );
    try {
      return await this.prisma.assetCategory.create({
        data: {
          organizationId: actor.organizationId,
          code: dto.code,
          name: dto.name,
          trackingMode: dto.trackingMode ?? AssetTrackingMode.INDIVIDUAL,
          specificationFields,
        },
        select: categorySelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'An asset category with this code already exists in the organization',
        );
      }
      throw error;
    }
  }

  async updateCategory(
    actor: AuthenticatedActor,
    categoryId: string,
    version: number,
    dto: UpdateAssetCategoryDto,
  ) {
    this.requireAdministrator(actor);
    const specificationFields = dto.specificationFields
      ? this.validateCategorySpecificationFields(dto.specificationFields)
      : undefined;
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.assetCategory.findFirst({
        where: { id: categoryId, organizationId: actor.organizationId },
        select: { id: true, trackingMode: true, specificationFields: true },
      });
      if (!current) throw new NotFoundException('Asset category not found');
      if (dto.trackingMode && dto.trackingMode !== current.trackingMode) {
        throw new ConflictException(
          'Tracking mode is permanent after category creation',
        );
      }
      if (
        specificationFields &&
        JSON.stringify(specificationFields) !==
          JSON.stringify(current.specificationFields)
      ) {
        throw new ConflictException(
          'Specification fields are permanent after category creation',
        );
      }

      try {
        const updated = await tx.assetCategory.updateMany({
          where: {
            id: categoryId,
            organizationId: actor.organizationId,
            version,
          },
          data: {
            code: dto.code,
            name: dto.name,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException(
            'The asset category changed since it was loaded. Reload and review the latest category before saving again.',
          );
        }
        return tx.assetCategory.findFirstOrThrow({
          where: { id: categoryId, organizationId: actor.organizationId },
          select: categorySelect,
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException(
            'An asset category with this code already exists in the organization',
          );
        }
        throw error;
      }
    });
  }

  async list(actor: AuthenticatedActor, query: ListAssetsQueryDto) {
    this.requireAssetReader(actor);
    const accessibleLocationIds =
      await this.locations.getAccessibleLocationIds(actor);
    if (
      query.locationId &&
      accessibleLocationIds &&
      !accessibleLocationIds.includes(query.locationId)
    ) {
      throw new NotFoundException('Location not found');
    }

    const warrantyExpiresOnFrom = query.warrantyExpiresOnFrom
      ? this.parseDateOnly(
          query.warrantyExpiresOnFrom,
          'Warranty expiry start date',
        )
      : undefined;
    const warrantyExpiresOnTo = query.warrantyExpiresOnTo
      ? this.parseDateOnly(
          query.warrantyExpiresOnTo,
          'Warranty expiry end date',
        )
      : undefined;
    if (
      warrantyExpiresOnFrom &&
      warrantyExpiresOnTo &&
      warrantyExpiresOnFrom > warrantyExpiresOnTo
    ) {
      throw new BadRequestException(
        'Warranty expiry start date must be on or before the end date',
      );
    }

    const today = new Date(`${utcDateOnly(new Date())}T00:00:00.000Z`);
    const activeReservationWhere = {
      cancelledAt: null,
      startDate: { lte: today },
      expiresOn: { gte: today },
    } satisfies Prisma.AssetReservationWhereInput;
    const filters: Prisma.AssetWhereInput[] = [];
    if (query.availability === AssetAvailability.RESERVED) {
      filters.push({
        OR: [
          { availability: AssetAvailability.RESERVED },
          {
            availability: AssetAvailability.AVAILABLE,
            reservations: { some: activeReservationWhere },
          },
        ],
      });
    } else if (query.availability === AssetAvailability.AVAILABLE) {
      filters.push({
        availability: AssetAvailability.AVAILABLE,
        reservations: { none: activeReservationWhere },
      });
    } else if (query.availability) {
      filters.push({ availability: query.availability });
    }
    if (query.search) {
      filters.push({
        OR: [
          { assetTag: { contains: query.search, mode: 'insensitive' } },
          { serialNumber: { contains: query.search, mode: 'insensitive' } },
          { manufacturer: { contains: query.search, mode: 'insensitive' } },
          { model: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.AssetWhereInput = {
      organizationId: actor.organizationId,
      ...(query.assetIdExact ? { id: query.assetIdExact } : {}),
      ...(query.locationId
        ? { locationId: query.locationId }
        : accessibleLocationIds
          ? { locationId: { in: accessibleLocationIds } }
          : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.lifecycle ? { lifecycle: query.lifecycle } : {}),
      ...(query.condition ? { condition: query.condition } : {}),
      ...(query.verification ? { verification: query.verification } : {}),
      ...(warrantyExpiresOnFrom || warrantyExpiresOnTo
        ? {
            warrantyExpiresOn: {
              ...(warrantyExpiresOnFrom ? { gte: warrantyExpiresOnFrom } : {}),
              ...(warrantyExpiresOnTo ? { lte: warrantyExpiresOnTo } : {}),
            },
          }
        : {}),
      ...(query.serialNumberExact
        ? { serialNumber: query.serialNumberExact }
        : {}),
      ...(filters.length ? { AND: filters } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.asset.findMany({
        where,
        select: assetSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.asset.count({ where }),
    ]);
    const reservedAssetIds = items.length
      ? new Set(
          (
            await this.prisma.assetReservation.findMany({
              where: {
                organizationId: actor.organizationId,
                assetId: { in: items.map((asset) => asset.id) },
                ...activeReservationWhere,
              },
              select: { assetId: true },
            })
          ).map(({ assetId }) => assetId),
        )
      : new Set<string>();
    const projectedItems = items.map((asset) =>
      asset.availability === AssetAvailability.AVAILABLE &&
      reservedAssetIds.has(asset.id)
        ? { ...asset, availability: AssetAvailability.RESERVED }
        : asset,
    );

    return {
      items: projectedItems,
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async listReservations(
    actor: AuthenticatedActor,
    query: ListAssetReservationsQueryDto,
  ) {
    this.requireAssetManager(actor);
    const accessibleLocationIds =
      (await this.locations.getAccessibleLocationIds(actor)) ?? [];
    const where: Prisma.AssetReservationWhereInput = {
      organizationId: actor.organizationId,
      asset: { locationId: { in: accessibleLocationIds } },
      ...(query.search
        ? {
            OR: [
              {
                asset: {
                  assetTag: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                employee: {
                  displayName: { contains: query.search, mode: 'insensitive' },
                },
              },
              { reason: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.assetReservation.findMany({
        where,
        select: assetReservationSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.assetReservation.count({ where }),
    ]);

    return {
      items: items.map(reservationResponse),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async createReservation(
    actor: AuthenticatedActor,
    idempotencyKey: string | undefined,
    dto: CreateAssetReservationDto,
  ) {
    this.requireAssetManager(actor);
    const key = idempotencyKey?.trim();
    if (!key || key.length > 100) {
      throw new UnprocessableEntityException(
        'A valid Idempotency-Key header is required',
      );
    }

    const startDate = new Date(`${dto.startDate}T00:00:00.000Z`);
    const expiresOn = new Date(`${dto.expiresOn}T00:00:00.000Z`);
    const today = utcDateOnly(new Date());
    if (dto.startDate < today) {
      throw new UnprocessableEntityException(
        'Reservation start date cannot be before today',
      );
    }
    if (dto.expiresOn < dto.startDate) {
      throw new UnprocessableEntityException(
        'Reservation expiry date must be on or after its start date',
      );
    }

    const canonicalPayload = JSON.stringify({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      operation: 'asset-reservation.create',
      assetId: dto.assetId,
      employeeId: dto.employeeId,
      startDate: dto.startDate,
      expiresOn: dto.expiresOn,
      reason: dto.reason,
    });
    const payloadHash = createHash('sha256')
      .update(canonicalPayload)
      .digest('hex');
    const accessibleLocationIds =
      (await this.locations.getAccessibleLocationIds(actor)) ?? [];

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`
            SELECT pg_advisory_xact_lock(
              hashtext(${actor.organizationId}),
              hashtext(${dto.assetId})
            )
          `;
          const asset = await tx.asset.findFirst({
            where: {
              id: dto.assetId,
              organizationId: actor.organizationId,
              locationId: { in: accessibleLocationIds },
            },
            select: { id: true, lifecycle: true, availability: true },
          });
          if (!asset) {
            throw new NotFoundException('Asset not found');
          }

          const existing = await tx.assetReservation.findFirst({
            where: {
              organizationId: actor.organizationId,
              createdByUserId: actor.userId,
              idempotencyKey: key,
            },
            select: {
              ...assetReservationSelect,
              payloadHash: true,
            },
          });
          if (existing) {
            if (
              existing.payloadHash !== payloadHash ||
              existing.assetId !== dto.assetId
            ) {
              throw new ConflictException(
                'This Idempotency-Key was already used with a different reservation request',
              );
            }
            return reservationResponse(existing);
          }

          if (
            asset.lifecycle !== AssetLifecycle.ACTIVE ||
            asset.availability !== AssetAvailability.AVAILABLE
          ) {
            throw new ConflictException(
              'Only active, available assets can be reserved',
            );
          }
          const transferLine = await tx.assetTransferLine.findFirst({
            where: {
              organizationId: actor.organizationId,
              assetId: dto.assetId,
              status: {
                in: [
                  AssetTransferLineStatus.DRAFT,
                  AssetTransferLineStatus.IN_TRANSIT,
                  AssetTransferLineStatus.MISSING,
                  AssetTransferLineStatus.REJECTED,
                ],
              },
            },
            select: { id: true },
          });
          if (transferLine) {
            throw new ConflictException(
              'This asset belongs to an open transfer',
            );
          }
          const installation = await tx.componentInstallation.findFirst({
            where: {
              organizationId: actor.organizationId,
              componentAssetId: dto.assetId,
              removedAt: null,
            },
            select: { id: true },
          });
          if (installation) {
            throw new ConflictException(
              'Remove the component from its host before reserving it independently',
            );
          }
          const employee = await tx.employee.findFirst({
            where: {
              id: dto.employeeId,
              organizationId: actor.organizationId,
              isActive: true,
            },
            select: { id: true },
          });
          if (!employee) {
            throw new NotFoundException('Active employee not found');
          }

          const overlapping = await tx.assetReservation.findFirst({
            where: {
              organizationId: actor.organizationId,
              assetId: dto.assetId,
              cancelledAt: null,
              startDate: { lte: expiresOn },
              expiresOn: { gte: startDate },
            },
            select: { id: true },
          });
          if (overlapping) {
            throw new ConflictException(
              'This asset already has a reservation that overlaps those dates',
            );
          }

          const reservation = await tx.assetReservation.create({
            data: {
              organizationId: actor.organizationId,
              assetId: dto.assetId,
              employeeId: dto.employeeId,
              startDate,
              expiresOn,
              reason: dto.reason,
              idempotencyKey: key,
              payloadHash,
              createdByUserId: actor.userId,
            },
            select: assetReservationSelect,
          });
          await tx.assetHistoryEvent.create({
            data: {
              organizationId: actor.organizationId,
              assetId: dto.assetId,
              actorUserId: actor.userId,
              eventType: AssetHistoryEventType.RESERVATION_CREATED,
              details: {
                startDate: dto.startDate,
                expiresOn: dto.expiresOn,
              },
            },
          });
          return reservationResponse(reservation);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.assetReservation.findFirst({
          where: {
            organizationId: actor.organizationId,
            createdByUserId: actor.userId,
            idempotencyKey: key,
          },
          select: { ...assetReservationSelect, payloadHash: true },
        });
        if (
          existing &&
          existing.payloadHash === payloadHash &&
          existing.assetId === dto.assetId
        ) {
          return reservationResponse(existing);
        }
        if (existing) {
          throw new ConflictException(
            'This Idempotency-Key was already used with a different reservation request',
          );
        }
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'A concurrent reservation changed this asset. Retry with the same Idempotency-Key.',
        );
      }
      throw error;
    }
  }

  async cancelReservation(
    actor: AuthenticatedActor,
    reservationId: string,
    version: number,
  ) {
    this.requireAssetManager(actor);
    const accessibleLocationIds =
      (await this.locations.getAccessibleLocationIds(actor)) ?? [];
    return this.prisma.$transaction(
      async (tx) => {
        const initial = await tx.assetReservation.findFirst({
          where: {
            id: reservationId,
            organizationId: actor.organizationId,
            asset: { locationId: { in: accessibleLocationIds } },
          },
          select: { id: true, assetId: true },
        });
        if (!initial) {
          throw new NotFoundException('Reservation not found');
        }
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(
            hashtext(${actor.organizationId}),
            hashtext(${initial.assetId})
          )
        `;
        const current = await tx.assetReservation.findFirst({
          where: {
            id: reservationId,
            organizationId: actor.organizationId,
            asset: { locationId: { in: accessibleLocationIds } },
          },
          select: assetReservationSelect,
        });
        if (!current) {
          throw new NotFoundException('Reservation not found');
        }
        if (current.cancelledAt) {
          return reservationResponse(current);
        }
        if (reservationStatus(current) === 'EXPIRED') {
          return reservationResponse(current);
        }

        const updated = await tx.assetReservation.updateMany({
          where: {
            id: reservationId,
            organizationId: actor.organizationId,
            version,
            cancelledAt: null,
          },
          data: {
            cancelledAt: new Date(),
            cancelledByUserId: actor.userId,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException(
            'The reservation changed since it was loaded. Reload and review it before cancelling.',
          );
        }
        await tx.assetHistoryEvent.create({
          data: {
            organizationId: actor.organizationId,
            assetId: current.assetId,
            actorUserId: actor.userId,
            eventType: AssetHistoryEventType.RESERVATION_CANCELLED,
            details: { reservationId },
          },
        });
        const cancelled = await tx.assetReservation.findFirstOrThrow({
          where: { id: reservationId, organizationId: actor.organizationId },
          select: assetReservationSelect,
        });
        return reservationResponse(cancelled);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async listAssignments(
    actor: AuthenticatedActor,
    query: ListAssetAssignmentsQueryDto,
  ) {
    this.requireAssetManager(actor);
    const accessibleLocationIds =
      (await this.locations.getAccessibleLocationIds(actor)) ?? [];
    const where: Prisma.AssetAssignmentWhereInput = {
      organizationId: actor.organizationId,
      asset: { locationId: { in: accessibleLocationIds } },
      ...(query.includeClosed ? {} : { returnedAt: null }),
      ...(query.search
        ? {
            OR: [
              {
                asset: {
                  assetTag: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                employee: {
                  displayName: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                recipientLabel: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.assetAssignment.findMany({
        where,
        select: assetAssignmentSelect,
        orderBy: [{ issuedAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.assetAssignment.count({ where }),
    ]);

    return {
      items: items.map(assignmentResponse),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async createAssignment(
    actor: AuthenticatedActor,
    idempotencyKey: string | undefined,
    dto: CreateAssetAssignmentDto,
  ) {
    this.requireAssetManager(actor);
    const key = idempotencyKey?.trim();
    if (!key || key.length > 100) {
      throw new UnprocessableEntityException(
        'A valid Idempotency-Key header is required',
      );
    }
    if (
      dto.expectedReturnDate &&
      dto.expectedReturnDate < utcDateOnly(new Date())
    ) {
      throw new UnprocessableEntityException(
        'Expected return date cannot be before today',
      );
    }
    if (dto.conditionAtIssue === AssetCondition.NONFUNCTIONAL) {
      throw new UnprocessableEntityException(
        'A nonfunctional asset cannot be issued',
      );
    }
    if (
      dto.recipientType === AssignmentRecipientType.EMPLOYEE
        ? !dto.employeeId || Boolean(dto.recipientLabel)
        : Boolean(dto.employeeId) || !dto.recipientLabel?.trim()
    ) {
      throw new UnprocessableEntityException(
        'Choose either an active employee or a team/shared-pool label',
      );
    }

    const canonicalPayload = JSON.stringify({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      operation: 'asset-assignment.create',
      assetId: dto.assetId,
      recipientType: dto.recipientType,
      employeeId: dto.employeeId ?? null,
      recipientLabel: dto.recipientLabel?.trim() ?? null,
      expectedReturnDate: dto.expectedReturnDate ?? null,
      conditionAtIssue: dto.conditionAtIssue,
      accessoriesAtIssue: dto.accessoriesAtIssue?.trim() ?? null,
      purpose: dto.purpose.trim(),
    });
    const payloadHash = createHash('sha256')
      .update(canonicalPayload)
      .digest('hex');
    const accessibleLocationIds =
      (await this.locations.getAccessibleLocationIds(actor)) ?? [];

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`
            SELECT pg_advisory_xact_lock(
              hashtext(${actor.organizationId}),
              hashtext(${dto.assetId})
            )
          `;
          const asset = await tx.asset.findFirst({
            where: {
              id: dto.assetId,
              organizationId: actor.organizationId,
              locationId: { in: accessibleLocationIds },
            },
            select: {
              id: true,
              lifecycle: true,
              availability: true,
              condition: true,
              version: true,
            },
          });
          if (!asset) {
            throw new NotFoundException('Asset not found');
          }
          const existing = await tx.assetAssignment.findFirst({
            where: {
              organizationId: actor.organizationId,
              issuedByUserId: actor.userId,
              idempotencyKey: key,
            },
            select: { ...assetAssignmentSelect, payloadHash: true },
          });
          if (existing) {
            if (
              existing.payloadHash !== payloadHash ||
              existing.assetId !== dto.assetId
            ) {
              throw new ConflictException(
                'This Idempotency-Key was already used with a different assignment request',
              );
            }
            return assignmentResponse(existing);
          }
          if (
            asset.lifecycle !== AssetLifecycle.ACTIVE ||
            asset.availability !== AssetAvailability.AVAILABLE
          ) {
            throw new ConflictException(
              'Only active, available assets can be assigned',
            );
          }

          const today = new Date(`${utcDateOnly(new Date())}T00:00:00.000Z`);
          const assignmentEnd = dto.expectedReturnDate
            ? new Date(`${dto.expectedReturnDate}T00:00:00.000Z`)
            : new Date('9999-12-31T00:00:00.000Z');
          const reservation = await tx.assetReservation.findFirst({
            where: {
              organizationId: actor.organizationId,
              assetId: dto.assetId,
              cancelledAt: null,
              startDate: { lte: assignmentEnd },
              expiresOn: { gte: today },
            },
            select: { id: true },
          });
          if (reservation) {
            throw new ConflictException(
              'This asset has a reservation that overlaps the assignment period',
            );
          }
          const transferLine = await tx.assetTransferLine.findFirst({
            where: {
              organizationId: actor.organizationId,
              assetId: dto.assetId,
              status: {
                in: [
                  AssetTransferLineStatus.DRAFT,
                  AssetTransferLineStatus.IN_TRANSIT,
                  AssetTransferLineStatus.MISSING,
                  AssetTransferLineStatus.REJECTED,
                ],
              },
            },
            select: { id: true },
          });
          if (transferLine) {
            throw new ConflictException(
              'This asset belongs to an open transfer',
            );
          }
          const installation = await tx.componentInstallation.findFirst({
            where: {
              organizationId: actor.organizationId,
              componentAssetId: dto.assetId,
              removedAt: null,
            },
            select: { id: true },
          });
          if (installation) {
            throw new ConflictException(
              'Remove the component from its host before assigning it independently',
            );
          }
          const openAssignment = await tx.assetAssignment.findFirst({
            where: {
              organizationId: actor.organizationId,
              assetId: dto.assetId,
              returnedAt: null,
            },
            select: { id: true },
          });
          if (openAssignment) {
            throw new ConflictException(
              'This asset already has an open custody assignment',
            );
          }
          if (dto.recipientType === AssignmentRecipientType.EMPLOYEE) {
            const employee = await tx.employee.findFirst({
              where: {
                id: dto.employeeId,
                organizationId: actor.organizationId,
                isActive: true,
              },
              select: { id: true },
            });
            if (!employee) {
              throw new NotFoundException('Active employee not found');
            }
          }

          const updatedAsset = await tx.asset.updateMany({
            where: {
              id: dto.assetId,
              organizationId: actor.organizationId,
              locationId: { in: accessibleLocationIds },
              lifecycle: AssetLifecycle.ACTIVE,
              availability: AssetAvailability.AVAILABLE,
              version: asset.version,
            },
            data: {
              availability: AssetAvailability.ASSIGNED,
              condition: dto.conditionAtIssue,
              version: { increment: 1 },
            },
          });
          if (updatedAsset.count !== 1) {
            throw new ConflictException(
              'The asset changed while the assignment was being prepared',
            );
          }
          const assignment = await tx.assetAssignment.create({
            data: {
              organizationId: actor.organizationId,
              assetId: dto.assetId,
              recipientType: dto.recipientType,
              employeeId:
                dto.recipientType === AssignmentRecipientType.EMPLOYEE
                  ? dto.employeeId
                  : null,
              recipientLabel:
                dto.recipientType === AssignmentRecipientType.EMPLOYEE
                  ? null
                  : dto.recipientLabel?.trim(),
              issuedByUserId: actor.userId,
              issueDate: today,
              expectedReturnDate: dto.expectedReturnDate
                ? new Date(`${dto.expectedReturnDate}T00:00:00.000Z`)
                : null,
              conditionAtIssue: dto.conditionAtIssue,
              accessoriesAtIssue: dto.accessoriesAtIssue?.trim() || null,
              purpose: dto.purpose.trim(),
              idempotencyKey: key,
              payloadHash,
            },
            select: assetAssignmentSelect,
          });
          await tx.assetHistoryEvent.create({
            data: {
              organizationId: actor.organizationId,
              assetId: dto.assetId,
              actorUserId: actor.userId,
              eventType: AssetHistoryEventType.ASSIGNED,
              details: {
                recipientType: dto.recipientType,
                expectedReturnDate: dto.expectedReturnDate ?? null,
              },
            },
          });
          return assignmentResponse(assignment);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.assetAssignment.findFirst({
          where: {
            organizationId: actor.organizationId,
            issuedByUserId: actor.userId,
            idempotencyKey: key,
          },
          select: { ...assetAssignmentSelect, payloadHash: true },
        });
        if (existing && existing.payloadHash === payloadHash) {
          return assignmentResponse(existing);
        }
        if (existing) {
          throw new ConflictException(
            'This Idempotency-Key was already used with a different assignment request',
          );
        }
        throw new ConflictException(
          'This asset already has an open assignment or the assignment key was reused',
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'A concurrent command changed this asset. Retry with the same Idempotency-Key.',
        );
      }
      throw error;
    }
  }

  async returnAssignment(
    actor: AuthenticatedActor,
    assignmentId: string,
    version: number,
    idempotencyKey: string | undefined,
    dto: ReturnAssetAssignmentDto,
  ) {
    this.requireAssetManager(actor);
    const key = idempotencyKey?.trim();
    if (!key || key.length > 100) {
      throw new UnprocessableEntityException(
        'A valid Idempotency-Key header is required',
      );
    }
    const canonicalPayload = JSON.stringify({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      operation: 'asset-assignment.return',
      assignmentId,
      conditionAtReturn: dto.conditionAtReturn,
      accessoriesReturned: dto.accessoriesReturned?.trim() ?? null,
      missingItems: dto.missingItems?.trim() ?? null,
      followUp: dto.followUp?.trim() ?? null,
      inspectionRequired: dto.inspectionRequired,
    });
    const payloadHash = createHash('sha256')
      .update(canonicalPayload)
      .digest('hex');
    const accessibleLocationIds =
      (await this.locations.getAccessibleLocationIds(actor)) ?? [];

    return this.prisma.$transaction(
      async (tx) => {
        const existingReturn = await tx.assetReturn.findFirst({
          where: {
            organizationId: actor.organizationId,
            receivedByUserId: actor.userId,
            idempotencyKey: key,
          },
          select: { assignmentId: true, payloadHash: true },
        });
        if (existingReturn) {
          if (
            existingReturn.assignmentId !== assignmentId ||
            existingReturn.payloadHash !== payloadHash
          ) {
            throw new ConflictException(
              'This Idempotency-Key was already used with a different return request',
            );
          }
          const replay = await tx.assetAssignment.findFirst({
            where: {
              id: assignmentId,
              organizationId: actor.organizationId,
              asset: { locationId: { in: accessibleLocationIds } },
            },
            select: assetAssignmentSelect,
          });
          if (!replay) throw new NotFoundException('Assignment not found');
          return assignmentResponse(replay);
        }

        const current = await tx.assetAssignment.findFirst({
          where: {
            id: assignmentId,
            organizationId: actor.organizationId,
            asset: { locationId: { in: accessibleLocationIds } },
          },
          select: {
            ...assetAssignmentSelect,
            asset: { select: { id: true, version: true, availability: true } },
          },
        });
        if (!current) {
          throw new NotFoundException('Assignment not found');
        }
        if (current.returnedAt) {
          throw new ConflictException(
            'This assignment has already been returned',
          );
        }
        if (current.version !== version) {
          throw new ConflictException(
            'The assignment changed since it was loaded. Reload and review it before returning.',
          );
        }
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(
            hashtext(${actor.organizationId}),
            hashtext(${current.assetId})
          )
        `;

        const availability =
          dto.inspectionRequired ||
          dto.conditionAtReturn === AssetCondition.DAMAGED ||
          dto.conditionAtReturn === AssetCondition.NONFUNCTIONAL
            ? AssetAvailability.QUARANTINED
            : AssetAvailability.AVAILABLE;
        const assetUpdated = await tx.asset.updateMany({
          where: {
            id: current.assetId,
            organizationId: actor.organizationId,
            locationId: { in: accessibleLocationIds },
            availability: AssetAvailability.ASSIGNED,
            version: current.asset.version,
          },
          data: {
            availability,
            condition: dto.conditionAtReturn,
            version: { increment: 1 },
          },
        });
        if (assetUpdated.count !== 1) {
          throw new ConflictException(
            'The asset changed while the return was being prepared',
          );
        }
        const returnedAt = new Date();
        const assignmentUpdated = await tx.assetAssignment.updateMany({
          where: {
            id: assignmentId,
            organizationId: actor.organizationId,
            version,
            returnedAt: null,
          },
          data: {
            returnedAt,
            version: { increment: 1 },
          },
        });
        if (assignmentUpdated.count !== 1) {
          throw new ConflictException(
            'The assignment changed while the return was being prepared',
          );
        }
        await tx.assetReturn.create({
          data: {
            organizationId: actor.organizationId,
            assignmentId,
            receivedByUserId: actor.userId,
            returnedAt,
            conditionAtReturn: dto.conditionAtReturn,
            accessoriesReturned: dto.accessoriesReturned?.trim() || null,
            missingItems: dto.missingItems?.trim() || null,
            followUp: dto.followUp?.trim() || null,
            inspectionRequired: dto.inspectionRequired,
            idempotencyKey: key,
            payloadHash,
          },
        });
        await tx.assetHistoryEvent.create({
          data: {
            organizationId: actor.organizationId,
            assetId: current.assetId,
            actorUserId: actor.userId,
            eventType: AssetHistoryEventType.RETURNED,
            details: {
              condition: dto.conditionAtReturn,
              inspectionRequired: dto.inspectionRequired,
            },
          },
        });
        const result = await tx.assetAssignment.findFirstOrThrow({
          where: { id: assignmentId, organizationId: actor.organizationId },
          select: assetAssignmentSelect,
        });
        return assignmentResponse(result);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async createTransfer(
    actor: AuthenticatedActor,
    idempotencyKey: string | undefined,
    dto: CreateAssetTransferDto,
  ) {
    this.requireAssetManager(actor);
    const key = idempotencyKey?.trim();
    if (!key || key.length > 100) {
      throw new UnprocessableEntityException(
        'A valid Idempotency-Key header is required',
      );
    }
    const assetIds = [...new Set(dto.assetIds)].sort();
    if (assetIds.length !== dto.assetIds.length) {
      throw new UnprocessableEntityException(
        'A transfer cannot contain the same asset more than once',
      );
    }
    const canonicalPayload = JSON.stringify({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      operation: 'asset-transfer.create',
      destinationLocationId: dto.destinationLocationId,
      assetIds,
      reason: dto.reason.trim(),
    });
    const payloadHash = createHash('sha256')
      .update(canonicalPayload)
      .digest('hex');
    const accessibleLocationIds =
      (await this.locations.getAccessibleLocationIds(actor)) ?? [];

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.assetTransfer.findFirst({
            where: {
              organizationId: actor.organizationId,
              requestedByUserId: actor.userId,
              idempotencyKey: key,
              sourceLocationId: { in: accessibleLocationIds },
              destinationLocationId: { in: accessibleLocationIds },
            },
            select: { ...assetTransferSelect, payloadHash: true },
          });
          if (existing) {
            if (
              existing.payloadHash !== payloadHash ||
              existing.destinationLocationId !== dto.destinationLocationId
            ) {
              throw new ConflictException(
                'This Idempotency-Key was already used with a different transfer request',
              );
            }
            const { payloadHash: _hash, ...transfer } = existing;
            return transfer;
          }

          for (const assetId of assetIds) {
            await tx.$queryRaw`
              SELECT pg_advisory_xact_lock(
                hashtext(${actor.organizationId}),
                hashtext(${assetId})
              )
            `;
          }
          const destination = await tx.location.findFirst({
            where: {
              id: dto.destinationLocationId,
              organizationId: actor.organizationId,
              isActive: true,
            },
            select: { id: true },
          });
          if (!destination || !accessibleLocationIds.includes(destination.id)) {
            throw new NotFoundException('Destination location not found');
          }
          const assets = await tx.asset.findMany({
            where: {
              organizationId: actor.organizationId,
              id: { in: assetIds },
              locationId: { in: accessibleLocationIds },
            },
            select: {
              id: true,
              locationId: true,
              lifecycle: true,
              availability: true,
              version: true,
            },
          });
          if (assets.length !== assetIds.length) {
            throw new NotFoundException('One or more assets were not found');
          }
          const sourceLocationId = assets[0]?.locationId;
          if (!sourceLocationId || sourceLocationId === destination.id) {
            throw new UnprocessableEntityException(
              'The transfer destination must differ from the source location',
            );
          }
          if (assets.some((asset) => asset.locationId !== sourceLocationId)) {
            throw new UnprocessableEntityException(
              'All assets in a transfer must share one source location',
            );
          }
          if (
            assets.some(
              (asset) =>
                asset.lifecycle !== AssetLifecycle.ACTIVE ||
                asset.availability !== AssetAvailability.AVAILABLE,
            )
          ) {
            throw new ConflictException(
              'Only active, available assets can be transferred',
            );
          }
          const [
            reservations,
            assignments,
            existingLines,
            componentInstallations,
          ] = await Promise.all([
            tx.assetReservation.findMany({
              where: {
                organizationId: actor.organizationId,
                assetId: { in: assetIds },
                cancelledAt: null,
                expiresOn: {
                  gte: new Date(`${utcDateOnly(new Date())}T00:00:00.000Z`),
                },
              },
              select: { assetId: true },
            }),
            tx.assetAssignment.findMany({
              where: {
                organizationId: actor.organizationId,
                assetId: { in: assetIds },
                returnedAt: null,
              },
              select: { assetId: true },
            }),
            tx.assetTransferLine.findMany({
              where: {
                organizationId: actor.organizationId,
                assetId: { in: assetIds },
                status: {
                  in: [
                    AssetTransferLineStatus.DRAFT,
                    AssetTransferLineStatus.IN_TRANSIT,
                    AssetTransferLineStatus.MISSING,
                    AssetTransferLineStatus.REJECTED,
                  ],
                },
              },
              select: { assetId: true },
            }),
            tx.componentInstallation.findMany({
              where: {
                organizationId: actor.organizationId,
                removedAt: null,
                OR: [
                  { hostAssetId: { in: assetIds } },
                  { componentAssetId: { in: assetIds } },
                ],
              },
              select: { id: true },
            }),
          ]);
          if (
            reservations.length ||
            assignments.length ||
            existingLines.length ||
            componentInstallations.length
          ) {
            throw new ConflictException(
              'An asset has a reservation, assignment, installation, or other open transfer',
            );
          }

          return await tx.assetTransfer.create({
            data: {
              organizationId: actor.organizationId,
              sourceLocationId,
              destinationLocationId: destination.id,
              reason: dto.reason.trim(),
              requestedByUserId: actor.userId,
              idempotencyKey: key,
              payloadHash,
              lines: {
                create: assets.map((asset) => ({
                  organizationId: actor.organizationId,
                  assetId: asset.id,
                  assetVersionAtCreate: asset.version,
                })),
              },
            },
            select: assetTransferSelect,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.assetTransfer.findFirst({
          where: {
            organizationId: actor.organizationId,
            requestedByUserId: actor.userId,
            idempotencyKey: key,
            sourceLocationId: { in: accessibleLocationIds },
            destinationLocationId: { in: accessibleLocationIds },
          },
          select: { ...assetTransferSelect, payloadHash: true },
        });
        if (existing && existing.payloadHash === payloadHash) {
          const { payloadHash: _hash, ...transfer } = existing;
          return transfer;
        }
        if (existing) {
          throw new ConflictException(
            'This Idempotency-Key was already used with a different transfer request',
          );
        }
        throw new ConflictException(
          'An asset already belongs to an open transfer',
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'A concurrent operation changed one of the assets. Retry with the same Idempotency-Key.',
        );
      }
      throw error;
    }
  }

  async dispatchTransfer(
    actor: AuthenticatedActor,
    transferId: string,
    version: number,
  ) {
    this.requireAssetManager(actor);
    const accessibleLocationIds =
      (await this.locations.getAccessibleLocationIds(actor)) ?? [];
    return this.prisma.$transaction(
      async (tx) => {
        const transfer = await tx.assetTransfer.findFirst({
          where: {
            id: transferId,
            organizationId: actor.organizationId,
            sourceLocationId: { in: accessibleLocationIds },
            destinationLocationId: { in: accessibleLocationIds },
          },
          select: assetTransferSelect,
        });
        if (!transfer) throw new NotFoundException('Transfer not found');
        if (transfer.status !== AssetTransferStatus.DRAFT) {
          if (transfer.status === AssetTransferStatus.CANCELLED) {
            throw new ConflictException(
              'A cancelled transfer cannot be dispatched',
            );
          }
          return transfer;
        }
        if (transfer.version !== version) {
          throw new ConflictException('Transfer changed before dispatch');
        }
        const lines = [...transfer.lines].sort((a, b) =>
          a.assetId.localeCompare(b.assetId),
        );
        for (const line of lines) {
          await tx.$queryRaw`
            SELECT pg_advisory_xact_lock(
              hashtext(${actor.organizationId}),
              hashtext(${line.assetId})
            )
          `;
        }
        const assets = await tx.asset.findMany({
          where: {
            organizationId: actor.organizationId,
            id: { in: lines.map((line) => line.assetId) },
            locationId: transfer.sourceLocationId,
            lifecycle: AssetLifecycle.ACTIVE,
            availability: AssetAvailability.AVAILABLE,
          },
          select: { id: true, version: true },
        });
        if (
          assets.length !== lines.length ||
          lines.some(
            (line) =>
              !assets.some(
                (asset) =>
                  asset.id === line.assetId &&
                  asset.version === line.assetVersionAtCreate,
              ),
          )
        ) {
          throw new ConflictException(
            'One or more assets changed after the transfer was drafted',
          );
        }

        for (const line of lines) {
          const updatedAsset = await tx.asset.updateMany({
            where: {
              id: line.assetId,
              organizationId: actor.organizationId,
              locationId: transfer.sourceLocationId,
              lifecycle: AssetLifecycle.ACTIVE,
              availability: AssetAvailability.AVAILABLE,
              version: line.assetVersionAtCreate,
            },
            data: {
              availability: AssetAvailability.IN_TRANSIT,
              version: { increment: 1 },
            },
          });
          if (updatedAsset.count !== 1) {
            throw new ConflictException('An asset changed during dispatch');
          }
          const updatedLine = await tx.assetTransferLine.updateMany({
            where: {
              id: line.id,
              organizationId: actor.organizationId,
              status: AssetTransferLineStatus.DRAFT,
            },
            data: {
              status: AssetTransferLineStatus.IN_TRANSIT,
              assetVersionAtDispatch: line.assetVersionAtCreate + 1,
              version: { increment: 1 },
            },
          });
          if (updatedLine.count !== 1) {
            throw new ConflictException(
              'A transfer line changed during dispatch',
            );
          }
          await tx.assetHistoryEvent.create({
            data: {
              organizationId: actor.organizationId,
              assetId: line.assetId,
              actorUserId: actor.userId,
              eventType: AssetHistoryEventType.TRANSFER_DISPATCHED,
              details: {
                transferId,
                destinationLocationId: transfer.destinationLocationId,
              },
            },
          });
        }
        const updatedTransfer = await tx.assetTransfer.updateMany({
          where: {
            id: transferId,
            organizationId: actor.organizationId,
            version,
            status: AssetTransferStatus.DRAFT,
          },
          data: {
            status: AssetTransferStatus.IN_TRANSIT,
            dispatchedAt: new Date(),
            version: { increment: 1 },
          },
        });
        if (updatedTransfer.count !== 1) {
          throw new ConflictException('Transfer changed during dispatch');
        }
        return tx.assetTransfer.findFirstOrThrow({
          where: { id: transferId, organizationId: actor.organizationId },
          select: assetTransferSelect,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async cancelTransfer(
    actor: AuthenticatedActor,
    transferId: string,
    version: number,
  ) {
    this.requireAssetManager(actor);
    const accessibleLocationIds =
      (await this.locations.getAccessibleLocationIds(actor)) ?? [];
    return this.prisma.$transaction(
      async (tx) => {
        const transfer = await tx.assetTransfer.findFirst({
          where: {
            id: transferId,
            organizationId: actor.organizationId,
            sourceLocationId: { in: accessibleLocationIds },
            destinationLocationId: { in: accessibleLocationIds },
          },
          select: assetTransferSelect,
        });
        if (!transfer) throw new NotFoundException('Transfer not found');
        if (transfer.status === AssetTransferStatus.CANCELLED) return transfer;
        if (transfer.status !== AssetTransferStatus.DRAFT) {
          throw new ConflictException(
            'Dispatched transfers require an explicit recovery workflow',
          );
        }
        if (transfer.version !== version) {
          throw new ConflictException('Transfer changed before cancellation');
        }
        const cancelledLines = await tx.assetTransferLine.updateMany({
          where: {
            organizationId: actor.organizationId,
            transferId,
            status: AssetTransferLineStatus.DRAFT,
          },
          data: {
            status: AssetTransferLineStatus.CANCELLED,
            version: { increment: 1 },
          },
        });
        if (cancelledLines.count !== transfer.lines.length) {
          throw new ConflictException(
            'Transfer lines changed before cancellation',
          );
        }
        const cancelledTransfer = await tx.assetTransfer.updateMany({
          where: {
            id: transferId,
            organizationId: actor.organizationId,
            version,
            status: AssetTransferStatus.DRAFT,
          },
          data: {
            status: AssetTransferStatus.CANCELLED,
            version: { increment: 1 },
          },
        });
        if (cancelledTransfer.count !== 1) {
          throw new ConflictException('Transfer changed during cancellation');
        }
        return tx.assetTransfer.findFirstOrThrow({
          where: { id: transferId, organizationId: actor.organizationId },
          select: assetTransferSelect,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async receiveTransferLine(
    actor: AuthenticatedActor,
    transferId: string,
    lineId: string,
    version: number,
    idempotencyKey: string | undefined,
    dto: ReceiveAssetTransferLineDto,
  ) {
    this.requireAssetManager(actor);
    const key = idempotencyKey?.trim();
    if (!key || key.length > 100) {
      throw new UnprocessableEntityException(
        'A valid Idempotency-Key header is required',
      );
    }
    if (
      dto.result === 'RECEIVED' &&
      (!dto.conditionAtReceipt || dto.inspectionRequired === undefined)
    ) {
      throw new UnprocessableEntityException(
        'Received assets require condition and inspection confirmation',
      );
    }
    if (dto.result !== 'RECEIVED' && !dto.exceptionNote?.trim()) {
      throw new UnprocessableEntityException(
        'Missing or rejected assets require an exception note',
      );
    }
    const canonicalPayload = JSON.stringify({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      operation: 'asset-transfer.receive-line',
      transferId,
      lineId,
      result: dto.result,
      conditionAtReceipt: dto.conditionAtReceipt ?? null,
      inspectionRequired: dto.inspectionRequired ?? null,
      exceptionNote: dto.exceptionNote?.trim() ?? null,
    });
    const payloadHash = createHash('sha256')
      .update(canonicalPayload)
      .digest('hex');
    const accessibleLocationIds =
      (await this.locations.getAccessibleLocationIds(actor)) ?? [];

    return this.prisma.$transaction(
      async (tx) => {
        const line = await tx.assetTransferLine.findFirst({
          where: {
            id: lineId,
            organizationId: actor.organizationId,
            transferId,
          },
          select: {
            id: true,
            assetId: true,
            assetVersionAtDispatch: true,
            status: true,
            version: true,
            receiptIdempotencyKey: true,
            receiptPayloadHash: true,
            transfer: {
              select: {
                id: true,
                status: true,
                version: true,
                sourceLocationId: true,
                destinationLocationId: true,
              },
            },
          },
        });
        if (
          !line ||
          !accessibleLocationIds.includes(line.transfer.sourceLocationId) ||
          !accessibleLocationIds.includes(line.transfer.destinationLocationId)
        ) {
          throw new NotFoundException('Transfer line not found');
        }
        if (
          line.transfer.status === AssetTransferStatus.DRAFT ||
          line.transfer.status === AssetTransferStatus.CANCELLED
        ) {
          throw new ConflictException(
            'Only dispatched transfer lines can be received',
          );
        }
        if (
          line.receiptIdempotencyKey === key &&
          line.receiptPayloadHash === payloadHash
        ) {
          return tx.assetTransfer.findFirstOrThrow({
            where: { id: transferId, organizationId: actor.organizationId },
            select: assetTransferSelect,
          });
        }
        if (line.receiptIdempotencyKey === key) {
          throw new ConflictException(
            'This Idempotency-Key was already used with a different receipt result',
          );
        }
        if (line.status !== AssetTransferLineStatus.IN_TRANSIT) {
          throw new ConflictException(
            line.status === AssetTransferLineStatus.MISSING ||
              line.status === AssetTransferLineStatus.REJECTED
              ? 'Discrepancy reconciliation requires an approved recovery workflow'
              : 'This transfer line is already closed',
          );
        }
        if (line.version !== version) {
          throw new ConflictException(
            'The transfer line changed since it was loaded. Reload before receiving it.',
          );
        }
        if (line.assetVersionAtDispatch === null) {
          throw new ConflictException(
            'The transfer line has no recorded dispatch version',
          );
        }

        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(
            hashtext(${actor.organizationId}),
            hashtext(${line.assetId})
          )
        `;
        if (dto.result === 'RECEIVED') {
          const availability =
            dto.inspectionRequired ||
            dto.conditionAtReceipt === AssetCondition.DAMAGED ||
            dto.conditionAtReceipt === AssetCondition.NONFUNCTIONAL
              ? AssetAvailability.QUARANTINED
              : AssetAvailability.AVAILABLE;
          const assetUpdated = await tx.asset.updateMany({
            where: {
              id: line.assetId,
              organizationId: actor.organizationId,
              locationId: line.transfer.sourceLocationId,
              availability: AssetAvailability.IN_TRANSIT,
              version: line.assetVersionAtDispatch,
            },
            data: {
              locationId: line.transfer.destinationLocationId,
              availability,
              condition: dto.conditionAtReceipt,
              version: { increment: 1 },
            },
          });
          if (assetUpdated.count !== 1) {
            throw new ConflictException(
              'The asset changed before its transfer receipt was recorded',
            );
          }
        }

        const nextStatus =
          dto.result === 'RECEIVED'
            ? AssetTransferLineStatus.RECEIVED
            : dto.result === 'MISSING'
              ? AssetTransferLineStatus.MISSING
              : AssetTransferLineStatus.REJECTED;
        const receivedAt = new Date();
        const lineUpdated = await tx.assetTransferLine.updateMany({
          where: {
            id: lineId,
            organizationId: actor.organizationId,
            version,
            status: {
              in: [
                AssetTransferLineStatus.IN_TRANSIT,
                AssetTransferLineStatus.MISSING,
                AssetTransferLineStatus.REJECTED,
              ],
            },
          },
          data: {
            status: nextStatus,
            version: { increment: 1 },
            receivedAt,
            receivedByUserId: actor.userId,
            conditionAtReceipt:
              dto.result === 'RECEIVED' ? dto.conditionAtReceipt : null,
            inspectionRequired:
              dto.result === 'RECEIVED' ? dto.inspectionRequired : null,
            exceptionNote: dto.exceptionNote?.trim() || null,
            receiptIdempotencyKey: key,
            receiptPayloadHash: payloadHash,
          },
        });
        if (lineUpdated.count !== 1) {
          throw new ConflictException(
            'The transfer line changed during receipt',
          );
        }

        const lines = await tx.assetTransferLine.findMany({
          where: { organizationId: actor.organizationId, transferId },
          select: { status: true },
        });
        const transferStatus = lines.every(
          (item) => item.status === AssetTransferLineStatus.RECEIVED,
        )
          ? AssetTransferStatus.RECEIVED
          : lines.some(
                (item) => item.status !== AssetTransferLineStatus.IN_TRANSIT,
              )
            ? AssetTransferStatus.PARTIALLY_RECEIVED
            : AssetTransferStatus.IN_TRANSIT;
        const transferUpdated = await tx.assetTransfer.updateMany({
          where: {
            id: transferId,
            organizationId: actor.organizationId,
            version: line.transfer.version,
          },
          data: {
            status: transferStatus,
            version: { increment: 1 },
          },
        });
        if (transferUpdated.count !== 1) {
          throw new ConflictException('The transfer changed during receipt');
        }
        await tx.assetHistoryEvent.create({
          data: {
            organizationId: actor.organizationId,
            assetId: line.assetId,
            actorUserId: actor.userId,
            eventType:
              dto.result === 'RECEIVED'
                ? AssetHistoryEventType.TRANSFER_RECEIVED
                : AssetHistoryEventType.TRANSFER_EXCEPTION,
            details: {
              transferId,
              result: dto.result,
              destinationLocationId: line.transfer.destinationLocationId,
            },
          },
        });
        return tx.assetTransfer.findFirstOrThrow({
          where: { id: transferId, organizationId: actor.organizationId },
          select: assetTransferSelect,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async listTransfers(
    actor: AuthenticatedActor,
    query: ListAssetReservationsQueryDto,
  ) {
    this.requireAssetManager(actor);
    const accessibleLocationIds =
      (await this.locations.getAccessibleLocationIds(actor)) ?? [];
    const filters: Prisma.AssetTransferWhereInput[] = [
      {
        OR: [
          { sourceLocationId: { in: accessibleLocationIds } },
          { destinationLocationId: { in: accessibleLocationIds } },
        ],
      },
    ];
    if (query.search) {
      filters.push({
        OR: [
          { reason: { contains: query.search, mode: 'insensitive' } },
          {
            lines: {
              some: {
                asset: {
                  assetTag: { contains: query.search, mode: 'insensitive' },
                },
              },
            },
          },
        ],
      });
    }
    const where: Prisma.AssetTransferWhereInput = {
      organizationId: actor.organizationId,
      AND: filters,
    };
    const [items, total] = await Promise.all([
      this.prisma.assetTransfer.findMany({
        where,
        select: assetTransferSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.assetTransfer.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async get(actor: AuthenticatedActor, assetId: string) {
    this.requireAssetReader(actor);
    const accessibleLocationIds =
      await this.locations.getAccessibleLocationIds(actor);
    const asset = await this.prisma.asset.findFirst({
      where: {
        id: assetId,
        organizationId: actor.organizationId,
        ...(accessibleLocationIds
          ? { locationId: { in: accessibleLocationIds } }
          : {}),
      },
      select: assetSelect,
    });
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }
    const activeReservation = await this.prisma.assetReservation.findFirst({
      where: {
        organizationId: actor.organizationId,
        assetId,
        cancelledAt: null,
        startDate: {
          lte: new Date(`${utcDateOnly(new Date())}T00:00:00.000Z`),
        },
        expiresOn: {
          gte: new Date(`${utcDateOnly(new Date())}T00:00:00.000Z`),
        },
      },
      select: { id: true },
    });
    return activeReservation &&
      asset.availability === AssetAvailability.AVAILABLE
      ? { ...asset, availability: AssetAvailability.RESERVED }
      : asset;
  }

  async history(actor: AuthenticatedActor, assetId: string) {
    this.requireAssetReader(actor);
    const accessibleLocationIds =
      await this.locations.getAccessibleLocationIds(actor);
    const asset = await this.prisma.asset.findFirst({
      where: {
        id: assetId,
        organizationId: actor.organizationId,
        ...(accessibleLocationIds
          ? { locationId: { in: accessibleLocationIds } }
          : {}),
      },
      select: { id: true },
    });
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    return this.prisma.assetHistoryEvent.findMany({
      where: { organizationId: actor.organizationId, assetId },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        eventType: true,
        details: true,
        occurredAt: true,
        actor: { select: { displayName: true } },
      },
    });
  }

  async componentInstallations(actor: AuthenticatedActor, assetId: string) {
    this.requireAssetReader(actor);
    const accessibleLocationIds =
      await this.locations.getAccessibleLocationIds(actor);
    const asset = await this.prisma.asset.findFirst({
      where: {
        id: assetId,
        organizationId: actor.organizationId,
        ...(accessibleLocationIds
          ? { locationId: { in: accessibleLocationIds } }
          : {}),
      },
      select: { id: true },
    });
    if (!asset) throw new NotFoundException('Asset not found');
    return this.prisma.componentInstallation.findMany({
      where: {
        organizationId: actor.organizationId,
        OR: accessibleLocationIds
          ? [
              {
                hostAssetId: assetId,
                componentAsset: {
                  locationId: { in: accessibleLocationIds },
                },
              },
              {
                componentAssetId: assetId,
                hostAsset: { locationId: { in: accessibleLocationIds } },
              },
            ]
          : [{ hostAssetId: assetId }, { componentAssetId: assetId }],
      },
      select: componentInstallationSelect,
      orderBy: [{ installedAt: 'desc' }, { id: 'desc' }],
    });
  }

  async installComponent(
    actor: AuthenticatedActor,
    hostAssetId: string,
    idempotencyKey: string | undefined,
    dto: InstallAssetComponentDto,
  ) {
    this.requireAssetManager(actor);
    const key = idempotencyKey?.trim();
    if (!key || key.length > 100) {
      throw new UnprocessableEntityException(
        'A valid Idempotency-Key header is required',
      );
    }
    if (hostAssetId === dto.componentAssetId) {
      throw new UnprocessableEntityException(
        'An asset cannot be installed inside itself',
      );
    }
    const accessibleLocationIds =
      (await this.locations.getAccessibleLocationIds(actor)) ?? [];
    const payloadHash = createHash('sha256')
      .update(
        JSON.stringify({
          organizationId: actor.organizationId,
          actorId: actor.userId,
          operation: 'asset-component.install',
          hostAssetId,
          componentAssetId: dto.componentAssetId,
          installNote: dto.installNote?.trim() || null,
        }),
      )
      .digest('hex');
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.componentInstallation.findFirst({
            where: {
              organizationId: actor.organizationId,
              installedByUserId: actor.userId,
              installIdempotencyKey: key,
            },
            select: componentInstallationCommandSelect,
          });
          if (existing) {
            this.assertComponentInstallationVisible(
              actor,
              accessibleLocationIds,
              existing,
            );
            if (existing.installPayloadHash !== payloadHash) {
              throw new ConflictException(
                'This Idempotency-Key was already used with a different component installation',
              );
            }
            return this.componentInstallationResponse(existing);
          }

          await tx.$queryRaw`
            SELECT pg_advisory_xact_lock(
              hashtext(${actor.organizationId}),
              hashtext('asset-relationships')
            )
          `;
          for (const id of [hostAssetId, dto.componentAssetId].sort()) {
            await tx.$queryRaw`
              SELECT pg_advisory_xact_lock(
                hashtext(${actor.organizationId}),
                hashtext(${id})
              )
            `;
          }
          const assets = await tx.asset.findMany({
            where: {
              organizationId: actor.organizationId,
              id: { in: [hostAssetId, dto.componentAssetId] },
              locationId: { in: accessibleLocationIds },
            },
            select: {
              id: true,
              lifecycle: true,
              availability: true,
            },
          });
          if (assets.length !== 2) {
            throw new NotFoundException('Asset not found');
          }
          if (
            assets.some(
              (asset) =>
                asset.lifecycle !== AssetLifecycle.ACTIVE ||
                asset.availability !== AssetAvailability.AVAILABLE,
            )
          ) {
            throw new ConflictException(
              'Only active, available assets can be installed as components',
            );
          }
          const today = new Date(`${utcDateOnly(new Date())}T00:00:00.000Z`);
          const [
            reservations,
            assignments,
            transferLines,
            existingInstall,
            link,
          ] = await Promise.all([
            tx.assetReservation.findMany({
              where: {
                organizationId: actor.organizationId,
                assetId: { in: [hostAssetId, dto.componentAssetId] },
                cancelledAt: null,
                expiresOn: { gte: today },
              },
              select: { assetId: true },
            }),
            tx.assetAssignment.findMany({
              where: {
                organizationId: actor.organizationId,
                assetId: { in: [hostAssetId, dto.componentAssetId] },
                returnedAt: null,
              },
              select: { assetId: true },
            }),
            tx.assetTransferLine.findMany({
              where: {
                organizationId: actor.organizationId,
                assetId: { in: [hostAssetId, dto.componentAssetId] },
                status: {
                  in: [
                    AssetTransferLineStatus.DRAFT,
                    AssetTransferLineStatus.IN_TRANSIT,
                    AssetTransferLineStatus.MISSING,
                    AssetTransferLineStatus.REJECTED,
                  ],
                },
              },
              select: { assetId: true },
            }),
            tx.componentInstallation.findFirst({
              where: {
                organizationId: actor.organizationId,
                componentAssetId: dto.componentAssetId,
                removedAt: null,
              },
              select: { id: true },
            }),
            tx.assetRelationship.findFirst({
              where: {
                organizationId: actor.organizationId,
                parentAssetId: hostAssetId,
                childAssetId: dto.componentAssetId,
                endedAt: null,
              },
              select: { id: true },
            }),
          ]);
          if (
            reservations.length ||
            assignments.length ||
            transferLines.length
          ) {
            throw new ConflictException(
              'Host and component must not have open reservations, assignments, or transfers',
            );
          }
          if (existingInstall) {
            throw new ConflictException(
              'This component is already installed in another asset',
            );
          }
          if (link) {
            throw new ConflictException(
              'End the existing parent-child link before recording an installation',
            );
          }
          await this.assertNoAssetStructureCycle(
            tx,
            actor.organizationId,
            hostAssetId,
            dto.componentAssetId,
          );
          const installation = await tx.componentInstallation.create({
            data: {
              organizationId: actor.organizationId,
              hostAssetId,
              componentAssetId: dto.componentAssetId,
              installedByUserId: actor.userId,
              installNote: dto.installNote?.trim() || null,
              installIdempotencyKey: key,
              installPayloadHash: payloadHash,
            },
            select: componentInstallationSelect,
          });
          await Promise.all([
            tx.assetHistoryEvent.create({
              data: {
                organizationId: actor.organizationId,
                assetId: hostAssetId,
                actorUserId: actor.userId,
                eventType: AssetHistoryEventType.COMPONENT_INSTALLED,
                details: {
                  componentAssetId: dto.componentAssetId,
                  installationId: installation.id,
                },
              },
            }),
            tx.assetHistoryEvent.create({
              data: {
                organizationId: actor.organizationId,
                assetId: dto.componentAssetId,
                actorUserId: actor.userId,
                eventType: AssetHistoryEventType.COMPONENT_INSTALLED,
                details: {
                  hostAssetId,
                  installationId: installation.id,
                },
              },
            }),
          ]);
          return installation;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.componentInstallation.findFirst({
          where: {
            organizationId: actor.organizationId,
            installedByUserId: actor.userId,
            installIdempotencyKey: key,
          },
          select: componentInstallationCommandSelect,
        });
        if (existing) {
          this.assertComponentInstallationVisible(
            actor,
            accessibleLocationIds,
            existing,
          );
          if (existing.installPayloadHash === payloadHash) {
            return this.componentInstallationResponse(existing);
          }
        }
        throw new ConflictException(
          'A component is already installed or the Idempotency-Key was reused',
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'Asset relationships changed concurrently. Retry with the same Idempotency-Key.',
        );
      }
      throw error;
    }
  }

  async removeComponent(
    actor: AuthenticatedActor,
    hostAssetId: string,
    installationId: string,
    version: number,
    idempotencyKey: string | undefined,
    dto: RemoveAssetComponentDto,
  ) {
    this.requireAssetManager(actor);
    const key = idempotencyKey?.trim();
    if (!key || key.length > 100) {
      throw new UnprocessableEntityException(
        'A valid Idempotency-Key header is required',
      );
    }
    const accessibleLocationIds =
      (await this.locations.getAccessibleLocationIds(actor)) ?? [];
    const payloadHash = createHash('sha256')
      .update(
        JSON.stringify({
          organizationId: actor.organizationId,
          actorId: actor.userId,
          operation: 'asset-component.remove',
          hostAssetId,
          installationId,
          removalNote: dto.removalNote?.trim() || null,
        }),
      )
      .digest('hex');
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const installation = await tx.componentInstallation.findFirst({
            where: {
              id: installationId,
              organizationId: actor.organizationId,
              hostAssetId,
            },
            select: componentInstallationCommandSelect,
          });
          if (!installation) {
            throw new NotFoundException('Component installation not found');
          }
          this.assertComponentInstallationVisible(
            actor,
            accessibleLocationIds,
            installation,
          );
          if (
            installation.removalIdempotencyKey === key &&
            installation.removalPayloadHash === payloadHash
          ) {
            return this.componentInstallationResponse(installation);
          }
          if (installation.removalIdempotencyKey === key) {
            throw new ConflictException(
              'This Idempotency-Key was already used with a different removal request',
            );
          }
          if (installation.removedAt) {
            throw new ConflictException(
              'This component installation has already ended',
            );
          }
          if (installation.version !== version) {
            throw new ConflictException(
              'The component installation changed. Reload before removing it.',
            );
          }

          await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(
            hashtext(${actor.organizationId}),
            hashtext('asset-relationships')
          )
        `;
          for (const id of [
            hostAssetId,
            installation.componentAssetId,
          ].sort()) {
            await tx.$queryRaw`
            SELECT pg_advisory_xact_lock(
              hashtext(${actor.organizationId}),
              hashtext(${id})
            )
          `;
          }
          const assets = await tx.asset.findMany({
            where: {
              organizationId: actor.organizationId,
              id: { in: [hostAssetId, installation.componentAssetId] },
              locationId: { in: accessibleLocationIds },
              lifecycle: AssetLifecycle.ACTIVE,
              availability: AssetAvailability.AVAILABLE,
            },
            select: { id: true },
          });
          if (assets.length !== 2) {
            throw new ConflictException(
              'Both host and component must be active and available before removal',
            );
          }
          const today = new Date(`${utcDateOnly(new Date())}T00:00:00.000Z`);
          const [reservations, assignments, transferLines] = await Promise.all([
            tx.assetReservation.findMany({
              where: {
                organizationId: actor.organizationId,
                assetId: { in: [hostAssetId, installation.componentAssetId] },
                cancelledAt: null,
                expiresOn: { gte: today },
              },
              select: { id: true },
            }),
            tx.assetAssignment.findMany({
              where: {
                organizationId: actor.organizationId,
                assetId: { in: [hostAssetId, installation.componentAssetId] },
                returnedAt: null,
              },
              select: { id: true },
            }),
            tx.assetTransferLine.findMany({
              where: {
                organizationId: actor.organizationId,
                assetId: { in: [hostAssetId, installation.componentAssetId] },
                status: {
                  in: [
                    AssetTransferLineStatus.DRAFT,
                    AssetTransferLineStatus.IN_TRANSIT,
                    AssetTransferLineStatus.MISSING,
                    AssetTransferLineStatus.REJECTED,
                  ],
                },
              },
              select: { id: true },
            }),
          ]);
          if (
            reservations.length ||
            assignments.length ||
            transferLines.length
          ) {
            throw new ConflictException(
              'Resolve reservations, assignments, or transfers before removing a component',
            );
          }
          const removedAt = new Date();
          const updated = await tx.componentInstallation.updateMany({
            where: {
              id: installationId,
              organizationId: actor.organizationId,
              version,
              removedAt: null,
            },
            data: {
              removedAt,
              removedByUserId: actor.userId,
              removalNote: dto.removalNote?.trim() || null,
              removalIdempotencyKey: key,
              removalPayloadHash: payloadHash,
              version: { increment: 1 },
            },
          });
          if (updated.count !== 1) {
            throw new ConflictException(
              'The component installation changed before it could be removed',
            );
          }
          await Promise.all([
            tx.assetHistoryEvent.create({
              data: {
                organizationId: actor.organizationId,
                assetId: hostAssetId,
                actorUserId: actor.userId,
                eventType: AssetHistoryEventType.COMPONENT_REMOVED,
                details: {
                  componentAssetId: installation.componentAssetId,
                  installationId,
                },
              },
            }),
            tx.assetHistoryEvent.create({
              data: {
                organizationId: actor.organizationId,
                assetId: installation.componentAssetId,
                actorUserId: actor.userId,
                eventType: AssetHistoryEventType.COMPONENT_REMOVED,
                details: { hostAssetId, installationId },
              },
            }),
          ]);
          const result = await tx.componentInstallation.findFirstOrThrow({
            where: { id: installationId, organizationId: actor.organizationId },
            select: componentInstallationSelect,
          });
          return result;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'This Idempotency-Key was already used with a different component removal',
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'The component installation changed concurrently. Retry with the same Idempotency-Key.',
        );
      }
      throw error;
    }
  }

  async relationships(actor: AuthenticatedActor, assetId: string) {
    this.requireAssetReader(actor);
    const accessibleLocationIds =
      await this.locations.getAccessibleLocationIds(actor);
    const asset = await this.prisma.asset.findFirst({
      where: {
        id: assetId,
        organizationId: actor.organizationId,
        ...(accessibleLocationIds
          ? { locationId: { in: accessibleLocationIds } }
          : {}),
      },
      select: { id: true },
    });
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    return this.prisma.assetRelationship.findMany({
      where: {
        organizationId: actor.organizationId,
        endedAt: null,
        OR: accessibleLocationIds
          ? [
              {
                parentAssetId: assetId,
                childAsset: { locationId: { in: accessibleLocationIds } },
              },
              {
                childAssetId: assetId,
                parentAsset: { locationId: { in: accessibleLocationIds } },
              },
            ]
          : [{ parentAssetId: assetId }, { childAssetId: assetId }],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: assetRelationshipSelect,
    });
  }

  async addRelationship(
    actor: AuthenticatedActor,
    parentAssetId: string,
    childAssetId: string,
  ) {
    this.requireAssetManager(actor);
    if (parentAssetId === childAssetId) {
      throw new UnprocessableEntityException(
        'An asset cannot be its own parent or child',
      );
    }
    const accessibleLocationIds =
      (await this.locations.getAccessibleLocationIds(actor)) ?? [];

    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(
            hashtext(${actor.organizationId}),
            hashtext('asset-relationships')
          )
        `;

        const assets = await tx.asset.findMany({
          where: {
            organizationId: actor.organizationId,
            id: { in: [parentAssetId, childAssetId] },
            locationId: { in: accessibleLocationIds },
          },
          select: { id: true },
        });
        if (assets.length !== 2) {
          throw new NotFoundException('Asset not found');
        }

        const installedComponent = await tx.componentInstallation.findFirst({
          where: {
            organizationId: actor.organizationId,
            hostAssetId: parentAssetId,
            componentAssetId: childAssetId,
            removedAt: null,
          },
          select: { id: true },
        });
        if (installedComponent) {
          throw new ConflictException(
            'An installed component already links these assets',
          );
        }
        const existing = await tx.assetRelationship.findFirst({
          where: {
            organizationId: actor.organizationId,
            parentAssetId,
            childAssetId,
            endedAt: null,
          },
          select: assetRelationshipSelect,
        });
        if (existing) return existing;

        await this.assertNoAssetStructureCycle(
          tx,
          actor.organizationId,
          parentAssetId,
          childAssetId,
        );

        const relationship = await tx.assetRelationship.create({
          data: {
            organizationId: actor.organizationId,
            parentAssetId,
            childAssetId,
            createdByUserId: actor.userId,
          },
          select: assetRelationshipSelect,
        });
        await Promise.all([
          tx.assetHistoryEvent.create({
            data: {
              organizationId: actor.organizationId,
              assetId: parentAssetId,
              actorUserId: actor.userId,
              eventType: AssetHistoryEventType.RELATIONSHIP_ADDED,
              details: { relatedAssetId: childAssetId, role: 'PARENT' },
            },
          }),
          tx.assetHistoryEvent.create({
            data: {
              organizationId: actor.organizationId,
              assetId: childAssetId,
              actorUserId: actor.userId,
              eventType: AssetHistoryEventType.RELATIONSHIP_ADDED,
              details: { relatedAssetId: parentAssetId, role: 'CHILD' },
            },
          }),
        ]);
        return relationship;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async endRelationship(
    actor: AuthenticatedActor,
    assetId: string,
    relationshipId: string,
  ) {
    this.requireAssetManager(actor);
    const accessibleLocationIds =
      (await this.locations.getAccessibleLocationIds(actor)) ?? [];

    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(
            hashtext(${actor.organizationId}),
            hashtext('asset-relationships')
          )
        `;
        const relationship = await tx.assetRelationship.findFirst({
          where: {
            id: relationshipId,
            organizationId: actor.organizationId,
            OR: [{ parentAssetId: assetId }, { childAssetId: assetId }],
          },
          select: {
            id: true,
            parentAssetId: true,
            childAssetId: true,
            endedAt: true,
          },
        });
        if (!relationship) {
          throw new NotFoundException('Asset relationship not found');
        }
        const inScope = await tx.asset.findMany({
          where: {
            organizationId: actor.organizationId,
            id: {
              in: [relationship.parentAssetId, relationship.childAssetId],
            },
            locationId: { in: accessibleLocationIds },
          },
          select: { id: true },
        });
        if (inScope.length !== 2) {
          throw new NotFoundException('Asset relationship not found');
        }
        if (relationship.endedAt) {
          return tx.assetRelationship.findFirstOrThrow({
            where: {
              id: relationship.id,
              organizationId: actor.organizationId,
            },
            select: assetRelationshipSelect,
          });
        }

        const endedAt = new Date();
        const updated = await tx.assetRelationship.updateMany({
          where: {
            id: relationshipId,
            organizationId: actor.organizationId,
            endedAt: null,
          },
          data: { endedAt, endedByUserId: actor.userId },
        });
        if (updated.count !== 1) {
          throw new ConflictException(
            'The asset relationship changed before it could be ended',
          );
        }
        await Promise.all([
          tx.assetHistoryEvent.create({
            data: {
              organizationId: actor.organizationId,
              assetId: relationship.parentAssetId,
              actorUserId: actor.userId,
              eventType: AssetHistoryEventType.RELATIONSHIP_REMOVED,
              details: {
                relatedAssetId: relationship.childAssetId,
                role: 'PARENT',
              },
            },
          }),
          tx.assetHistoryEvent.create({
            data: {
              organizationId: actor.organizationId,
              assetId: relationship.childAssetId,
              actorUserId: actor.userId,
              eventType: AssetHistoryEventType.RELATIONSHIP_REMOVED,
              details: {
                relatedAssetId: relationship.parentAssetId,
                role: 'CHILD',
              },
            },
          }),
        ]);
        return tx.assetRelationship.findFirstOrThrow({
          where: { id: relationshipId, organizationId: actor.organizationId },
          select: assetRelationshipSelect,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async commission(
    actor: AuthenticatedActor,
    assetId: string,
    version: number,
    commissioningDate: string,
  ) {
    this.requireAssetManager(actor);
    const accessibleLocationIds =
      (await this.locations.getAccessibleLocationIds(actor)) ?? [];
    const where = {
      id: assetId,
      organizationId: actor.organizationId,
      locationId: { in: accessibleLocationIds },
    };

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.asset.findFirst({
        where,
        select: { id: true, lifecycle: true },
      });
      if (!current) {
        throw new NotFoundException('Asset not found');
      }
      if (current.lifecycle !== AssetLifecycle.RECEIVED) {
        throw new ConflictException('Only received assets can be commissioned');
      }

      const updated = await tx.asset.updateMany({
        where: { ...where, lifecycle: AssetLifecycle.RECEIVED, version },
        data: {
          lifecycle: AssetLifecycle.ACTIVE,
          commissioningDate: new Date(commissioningDate),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          'The asset changed since it was loaded. Reload and review its current state before retrying.',
        );
      }
      await tx.assetHistoryEvent.create({
        data: {
          organizationId: actor.organizationId,
          assetId,
          actorUserId: actor.userId,
          eventType: AssetHistoryEventType.COMMISSIONED,
          details: { commissioningDate },
        },
      });
      return tx.asset.findFirstOrThrow({ where, select: assetSelect });
    });
  }

  async updateProfile(
    actor: AuthenticatedActor,
    assetId: string,
    version: number,
    dto: UpdateAssetProfileDto,
  ) {
    this.requireAssetManager(actor);
    const accessibleLocationIds =
      (await this.locations.getAccessibleLocationIds(actor)) ?? [];
    const where = {
      id: assetId,
      organizationId: actor.organizationId,
      locationId: { in: accessibleLocationIds },
    };

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.asset.findFirst({
        where,
        select: {
          id: true,
          manufacturer: true,
          model: true,
          serialNumber: true,
          sourceReference: true,
          notes: true,
          specifications: true,
          criticality: true,
          purchaseDate: true,
          warrantyExpiresOn: true,
          warrantyReference: true,
          category: { select: { specificationFields: true } },
        },
      });
      if (!current) {
        throw new NotFoundException('Asset not found');
      }
      const specifications =
        dto.specifications === undefined
          ? undefined
          : this.validateAssetSpecifications(
              current.category.specificationFields,
              dto.specifications,
            );
      const purchaseDate =
        dto.purchaseDate === undefined
          ? undefined
          : dto.purchaseDate === null
            ? null
            : this.parseDateOnly(dto.purchaseDate, 'Purchase date');
      const warrantyExpiresOn =
        dto.warrantyExpiresOn === undefined
          ? undefined
          : dto.warrantyExpiresOn === null
            ? null
            : this.parseDateOnly(dto.warrantyExpiresOn, 'Warranty expiry date');
      const updated = await tx.asset.updateMany({
        where: { ...where, version },
        data: {
          manufacturer: dto.manufacturer || null,
          model: dto.model || null,
          serialNumber: dto.serialNumber || null,
          sourceReference: dto.sourceReference || null,
          notes: dto.notes || null,
          ...(specifications !== undefined
            ? {
                specifications: specifications ?? Prisma.DbNull,
              }
            : {}),
          ...(dto.purchaseDate !== undefined ? { purchaseDate } : {}),
          ...(dto.warrantyExpiresOn !== undefined ? { warrantyExpiresOn } : {}),
          ...(dto.warrantyReference !== undefined
            ? { warrantyReference: dto.warrantyReference || null }
            : {}),
          ...(dto.criticality !== undefined
            ? { criticality: dto.criticality }
            : {}),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          'The asset changed since it was loaded. Reload and review the latest profile before saving again.',
        );
      }
      const changedFields = (
        [
          ['manufacturer', current.manufacturer, dto.manufacturer || null],
          ['model', current.model, dto.model || null],
          ['serialNumber', current.serialNumber, dto.serialNumber || null],
          [
            'sourceReference',
            current.sourceReference,
            dto.sourceReference || null,
          ],
          ['notes', current.notes, dto.notes || null],
          [
            'criticality',
            current.criticality,
            dto.criticality === undefined ? current.criticality : dto.criticality,
          ],
          [
            'specifications',
            JSON.stringify(current.specifications),
            JSON.stringify(specifications ?? current.specifications),
          ],
          [
            'purchaseDate',
            current.purchaseDate ? utcDateOnly(current.purchaseDate) : null,
            purchaseDate === undefined
              ? current.purchaseDate
                ? utcDateOnly(current.purchaseDate)
                : null
              : purchaseDate
                ? utcDateOnly(purchaseDate)
                : null,
          ],
          [
            'warrantyExpiresOn',
            current.warrantyExpiresOn
              ? utcDateOnly(current.warrantyExpiresOn)
              : null,
            warrantyExpiresOn === undefined
              ? current.warrantyExpiresOn
                ? utcDateOnly(current.warrantyExpiresOn)
                : null
              : warrantyExpiresOn
                ? utcDateOnly(warrantyExpiresOn)
                : null,
          ],
          [
            'warrantyReference',
            current.warrantyReference,
            dto.warrantyReference === undefined
              ? current.warrantyReference
              : dto.warrantyReference || null,
          ],
        ] as const
      )
        .filter(([, previous, next]) => previous !== next)
        .map(([field]) => field);
      await tx.assetHistoryEvent.create({
        data: {
          organizationId: actor.organizationId,
          assetId,
          actorUserId: actor.userId,
          eventType: AssetHistoryEventType.PROFILE_UPDATED,
          details: { fields: changedFields },
        },
      });
      return tx.asset.findFirstOrThrow({ where, select: assetSelect });
    });
  }

  async getManagedAssetLocationIds(
    actor: AuthenticatedActor,
  ): Promise<string[]> {
    this.requireAssetManager(actor);
    return (await this.locations.getAccessibleLocationIds(actor)) ?? [];
  }

  async getVerificationSnapshot(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    locationId: string,
  ) {
    this.requireAssetManager(actor);
    const accessibleLocationIds =
      (await this.locations.getAccessibleLocationIds(actor)) ?? [];
    if (!accessibleLocationIds.includes(locationId)) {
      throw new NotFoundException('Location not found');
    }
    const location = await tx.location.findFirst({
      where: {
        id: locationId,
        organizationId: actor.organizationId,
        isActive: true,
      },
      select: { id: true, code: true, name: true },
    });
    if (!location) {
      throw new NotFoundException('Location not found');
    }
    const assets = await tx.asset.findMany({
      where: {
        organizationId: actor.organizationId,
        locationId,
        lifecycle: { not: AssetLifecycle.DISPOSED },
      },
      select: {
        id: true,
        assetTag: true,
        lifecycle: true,
        condition: true,
        version: true,
        category: { select: { code: true, name: true } },
      },
      orderBy: [{ assetTag: 'asc' }, { id: 'asc' }],
    });
    return { location, assets };
  }

  async reconcileVerification(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    assetId: string,
    expectedVersion: number,
    verification: AssetVerification,
    campaignId: string,
    observationId: string,
  ) {
    this.requireAssetManager(actor);
    const accessibleLocationIds =
      (await this.locations.getAccessibleLocationIds(actor)) ?? [];
    const where = {
      id: assetId,
      organizationId: actor.organizationId,
      locationId: { in: accessibleLocationIds },
    };
    const updated = await tx.asset.updateMany({
      where: { ...where, version: expectedVersion },
      data: { verification, version: { increment: 1 } },
    });
    if (updated.count !== 1) {
      const current = await tx.asset.findFirst({
        where,
        select: { id: true },
      });
      if (!current) throw new NotFoundException('Asset not found');
      throw new ConflictException(
        'The asset changed after this verification snapshot. Review the current asset before reconciling again.',
      );
    }
    await tx.assetHistoryEvent.create({
      data: {
        organizationId: actor.organizationId,
        assetId,
        actorUserId: actor.userId,
        eventType: AssetHistoryEventType.VERIFICATION_RECONCILED,
        details: { campaignId, observationId, verification },
      },
    });
  }

  async getRetirementTarget(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    assetId: string,
  ) {
    this.requireAssetManager(actor);
    const accessibleLocationIds =
      (await this.locations.getAccessibleLocationIds(actor)) ?? [];
    const asset = await tx.asset.findFirst({
      where: {
        id: assetId,
        organizationId: actor.organizationId,
        locationId: { in: accessibleLocationIds },
      },
      select: {
        id: true,
        assetTag: true,
        lifecycle: true,
        availability: true,
        version: true,
        locationId: true,
      },
    });
    if (!asset) throw new NotFoundException('Asset not found');
    if (
      asset.lifecycle === AssetLifecycle.RETIRED ||
      asset.lifecycle === AssetLifecycle.DISPOSED
    ) {
      throw new ConflictException(
        'A retired or disposed asset cannot receive a retirement request',
      );
    }
    return asset;
  }

  async recordRetirementRequested(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    assetId: string,
    retirementRequestId: string,
  ): Promise<void> {
    this.requireAssetManager(actor);
    await tx.assetHistoryEvent.create({
      data: {
        organizationId: actor.organizationId,
        assetId,
        actorUserId: actor.userId,
        eventType: AssetHistoryEventType.RETIREMENT_REQUESTED,
        details: { retirementRequestId },
      },
    });
  }

  async create(actor: AuthenticatedActor, dto: CreateAssetDto) {
    this.requireAssetManager(actor);
    this.validateReceivedState(dto.availability, dto.condition);
    const accessibleLocationIds =
      (await this.locations.getAccessibleLocationIds(actor)) ?? [];
    if (!accessibleLocationIds.includes(dto.locationId)) {
      throw new NotFoundException('Location not found');
    }

    const [category, location] = await Promise.all([
      this.prisma.assetCategory.findFirst({
        where: {
          id: dto.categoryId,
          organizationId: actor.organizationId,
          isActive: true,
        },
        select: {
          id: true,
          trackingMode: true,
          specificationFields: true,
        },
      }),
      this.prisma.location.findFirst({
        where: {
          id: dto.locationId,
          organizationId: actor.organizationId,
          isActive: true,
        },
        select: { id: true },
      }),
    ]);
    if (!category) {
      throw new NotFoundException('Asset category not found');
    }
    if (category.trackingMode !== AssetTrackingMode.INDIVIDUAL) {
      throw new ConflictException(
        'Quantity-tracked categories cannot be used for individually registered assets',
      );
    }
    const specifications = this.validateAssetSpecifications(
      category.specificationFields,
      dto.specifications,
    );
    if (!location) {
      throw new NotFoundException('Location not found');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const asset = await tx.asset.create({
          data: {
            organizationId: actor.organizationId,
            assetTag: dto.assetTag,
            categoryId: category.id,
            manufacturer: dto.manufacturer || null,
            model: dto.model || null,
            serialNumber: dto.serialNumber || null,
            locationId: location.id,
            lifecycle: AssetLifecycle.RECEIVED,
            availability: dto.availability,
            condition: dto.condition,
            criticality: dto.criticality ?? null,
            verification: AssetVerification.NOT_CHECKED,
            sourceReference: dto.sourceReference || null,
            notes: dto.notes || null,
            specifications: specifications ?? Prisma.DbNull,
            purchaseDate: dto.purchaseDate
              ? this.parseDateOnly(dto.purchaseDate, 'Purchase date')
              : null,
            warrantyExpiresOn: dto.warrantyExpiresOn
              ? this.parseDateOnly(
                  dto.warrantyExpiresOn,
                  'Warranty expiry date',
                )
              : null,
            warrantyReference: dto.warrantyReference || null,
            createdByUserId: actor.userId,
          },
          select: assetSelect,
        });
        await tx.assetHistoryEvent.create({
          data: {
            organizationId: actor.organizationId,
            assetId: asset.id,
            actorUserId: actor.userId,
            eventType: AssetHistoryEventType.REGISTERED,
            details: { source: 'direct_asset_registration' },
          },
        });
        return asset;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'An asset with this tag already exists in the organization',
        );
      }
      throw error;
    }
  }

  async createImportedAssets(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    importJobId: string,
    accessibleLocationIds: string[],
    rows: ImportedAssetWrite[],
  ): Promise<number> {
    this.requireAssetManager(actor);
    if (rows.some((row) => !accessibleLocationIds.includes(row.locationId))) {
      throw new NotFoundException('Location not found');
    }
    const categoryIds = [...new Set(rows.map((row) => row.categoryId))];
    const locationIds = [...new Set(rows.map((row) => row.locationId))];
    const [categories, locations] = await Promise.all([
      tx.assetCategory.findMany({
        where: {
          organizationId: actor.organizationId,
          id: { in: categoryIds },
          isActive: true,
          trackingMode: AssetTrackingMode.INDIVIDUAL,
        },
        select: { id: true, specificationFields: true },
      }),
      tx.location.findMany({
        where: {
          organizationId: actor.organizationId,
          id: { in: locationIds },
          isActive: true,
        },
        select: { id: true },
      }),
    ]);
    if (categories.length !== categoryIds.length) {
      throw new ConflictException(
        'An asset category changed after import preview',
      );
    }
    if (locations.length !== locationIds.length) {
      throw new ConflictException('A location changed after import preview');
    }
    const categoryById = new Map(
      categories.map((category) => [category.id, category]),
    );

    for (const row of rows) {
      this.validateReceivedState(row.availability, row.condition);
      const category = categoryById.get(row.categoryId);
      if (!category) {
        throw new ConflictException(
          'An asset category changed after import preview',
        );
      }
      const specifications = this.validateAssetSpecifications(
        category.specificationFields,
        row.specifications,
      );
      const asset = await tx.asset.create({
        data: {
          organizationId: actor.organizationId,
          assetTag: row.assetTag,
          categoryId: row.categoryId,
          manufacturer: row.manufacturer || null,
          model: row.model || null,
          serialNumber: row.serialNumber || null,
          locationId: row.locationId,
          lifecycle: AssetLifecycle.RECEIVED,
          availability: row.availability,
          condition: row.condition,
          criticality: row.criticality ?? null,
          verification: AssetVerification.NOT_CHECKED,
          sourceReference: row.sourceReference || null,
          notes: row.notes || null,
          specifications: specifications ?? Prisma.DbNull,
          purchaseDate: row.purchaseDate
            ? this.parseDateOnly(row.purchaseDate, 'Purchase date')
            : null,
          warrantyExpiresOn: row.warrantyExpiresOn
            ? this.parseDateOnly(row.warrantyExpiresOn, 'Warranty expiry date')
            : null,
          warrantyReference: row.warrantyReference || null,
          createdByUserId: actor.userId,
        },
        select: { id: true },
      });
      await tx.assetHistoryEvent.create({
        data: {
          organizationId: actor.organizationId,
          assetId: asset.id,
          actorUserId: actor.userId,
          eventType: AssetHistoryEventType.REGISTERED,
          details: {
            source: 'asset_import',
            importJobId,
            rowNumber: row.rowNumber,
          },
        },
      });
    }
    return rows.length;
  }

  private validateCategorySpecificationFields(
    fields: AssetCategorySpecificationFieldDto[] | undefined,
  ): AssetCategorySpecificationFieldDto[] {
    const definitions = fields ?? [];
    if (definitions.length > 20) {
      throw new UnprocessableEntityException(
        'An asset category can define at most 20 specification fields',
      );
    }
    const keys = new Set<string>();
    for (const field of definitions) {
      const key = field.key.trim().toUpperCase();
      const label = field.label.trim();
      if (!/^[A-Z][A-Z0-9_]{0,39}$/.test(key) || !label || label.length > 100) {
        throw new UnprocessableEntityException(
          'Specification fields require a valid key and label',
        );
      }
      if (keys.has(key)) {
        throw new UnprocessableEntityException(
          'Specification field keys must be unique within the category',
        );
      }
      keys.add(key);
    }
    return definitions.map((field) => ({
      key: field.key.trim().toUpperCase(),
      label: field.label.trim(),
      required: field.required,
    }));
  }

  validateAssetSpecifications(
    schema: Prisma.JsonValue,
    input: Record<string, unknown> | undefined,
  ): Record<string, string> | null {
    if (!Array.isArray(schema)) {
      throw new ConflictException(
        'The category specification schema is invalid',
      );
    }
    const definitions: Array<{ key: string; required: boolean }> = [];
    for (const entry of schema) {
      if (
        typeof entry !== 'object' ||
        entry === null ||
        Array.isArray(entry) ||
        typeof entry.key !== 'string' ||
        typeof entry.required !== 'boolean'
      ) {
        throw new ConflictException(
          'The category specification schema is invalid',
        );
      }
      definitions.push({ key: entry.key, required: entry.required });
    }
    if (definitions.length === 0) {
      if (input && Object.keys(input).length > 0) {
        throw new UnprocessableEntityException(
          'This asset category does not define specification fields',
        );
      }
      return null;
    }
    const values = input ?? {};
    const allowedKeys = new Set(definitions.map((field) => field.key));
    const unknownKey = Object.keys(values).find((key) => !allowedKeys.has(key));
    if (unknownKey) {
      throw new UnprocessableEntityException(
        'Specification contains a field not defined by the asset category',
      );
    }

    const output: Record<string, string> = {};
    for (const field of definitions) {
      const value = values[field.key];
      if (value === undefined || value === null) {
        if (field.required) {
          throw new UnprocessableEntityException(
            `${field.key} is required by the asset category`,
          );
        }
        continue;
      }
      if (typeof value !== 'string' || value.length > 2000) {
        throw new UnprocessableEntityException(
          `${field.key} must be text no longer than 2,000 characters`,
        );
      }
      const trimmed = value.trim();
      if (!trimmed) {
        if (field.required) {
          throw new UnprocessableEntityException(
            `${field.key} is required by the asset category`,
          );
        }
        continue;
      }
      output[field.key] = trimmed;
    }
    return output;
  }

  private assertComponentInstallationVisible(
    actor: AuthenticatedActor,
    accessibleLocationIds: string[],
    installation: ComponentInstallationCommand,
  ): void {
    if (
      installation.organizationId !== actor.organizationId ||
      !accessibleLocationIds.includes(installation.hostAsset.location.id) ||
      !accessibleLocationIds.includes(installation.componentAsset.location.id)
    ) {
      throw new NotFoundException('Component installation not found');
    }
  }

  private componentInstallationResponse(
    installation: ComponentInstallationCommand,
  ) {
    const {
      installIdempotencyKey: _installKey,
      installPayloadHash: _installHash,
      removalIdempotencyKey: _removalKey,
      removalPayloadHash: _removalHash,
      ...result
    } = installation;
    return result;
  }

  private async assertNoAssetStructureCycle(
    tx: Prisma.TransactionClient,
    organizationId: string,
    parentAssetId: string,
    childAssetId: string,
  ): Promise<void> {
    const [relationships, installations] = await Promise.all([
      tx.assetRelationship.findMany({
        where: { organizationId, endedAt: null },
        select: { parentAssetId: true, childAssetId: true },
      }),
      tx.componentInstallation.findMany({
        where: { organizationId, removedAt: null },
        select: { hostAssetId: true, componentAssetId: true },
      }),
    ]);
    const childrenByParent = new Map<string, string[]>();
    for (const edge of [
      ...relationships.map((edge) => ({
        parentAssetId: edge.parentAssetId,
        childAssetId: edge.childAssetId,
      })),
      ...installations.map((installation) => ({
        parentAssetId: installation.hostAssetId,
        childAssetId: installation.componentAssetId,
      })),
    ]) {
      const children = childrenByParent.get(edge.parentAssetId) ?? [];
      children.push(edge.childAssetId);
      childrenByParent.set(edge.parentAssetId, children);
    }
    const pending = [childAssetId];
    const visited = new Set<string>();
    while (pending.length > 0) {
      const current = pending.pop();
      if (!current || visited.has(current)) continue;
      if (current === parentAssetId) {
        throw new ConflictException(
          'This parent-child relationship would create a cycle',
        );
      }
      visited.add(current);
      pending.push(...(childrenByParent.get(current) ?? []));
    }
  }

  private validateReceivedState(
    availability: AssetAvailability,
    condition: AssetCondition,
  ): void {
    if (
      availability !== AssetAvailability.AVAILABLE &&
      availability !== AssetAvailability.QUARANTINED &&
      availability !== AssetAvailability.UNAVAILABLE
    ) {
      throw new UnprocessableEntityException(
        'New assets must be received as available, quarantined, or unavailable',
      );
    }
    if (
      condition === AssetCondition.NONFUNCTIONAL &&
      availability !== AssetAvailability.QUARANTINED &&
      availability !== AssetAvailability.UNAVAILABLE
    ) {
      throw new UnprocessableEntityException(
        'A nonfunctional asset must be quarantined or unavailable when received',
      );
    }
  }

  private parseDateOnly(value: string, label: string): Date {
    const date = parseAssetDateOnly(value);
    if (!date) {
      throw new UnprocessableEntityException(
        `${label} must be a valid YYYY-MM-DD calendar date`,
      );
    }
    return date;
  }

  private requireAssetManager(actor: AuthenticatedActor): void {
    if (actor.role !== UserRole.ASSET_MANAGER) {
      throw new ForbiddenException('Asset Manager access is required');
    }
  }

  private requireAssetReader(actor: AuthenticatedActor): void {
    if (
      actor.role !== UserRole.ADMINISTRATOR &&
      actor.role !== UserRole.ASSET_MANAGER
    ) {
      throw new ForbiddenException(
        'Asset register access is not available to this role',
      );
    }
  }

  private requireCategoryReader(actor: AuthenticatedActor): void {
    if (
      actor.role !== UserRole.ADMINISTRATOR &&
      actor.role !== UserRole.ASSET_MANAGER
    ) {
      throw new ForbiddenException(
        'Asset category access is not available to this role',
      );
    }
  }

  private requireAdministrator(actor: AuthenticatedActor): void {
    if (actor.role !== UserRole.ADMINISTRATOR) {
      throw new ForbiddenException('Administrator access is required');
    }
  }
}
