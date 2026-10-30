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
  AssetCondition,
  AssetVerification,
  UserRole,
  VerificationCampaignStatus,
  VerificationObservationResolution,
  VerificationObservationResult,
} from '../generated/prisma/enums.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AssetsService } from '../assets/assets.service.js';
import type { CreateVerificationCampaignDto } from './dto/create-verification-campaign.dto.js';
import type { CreateVerificationObservationDto } from './dto/create-verification-observation.dto.js';
import type { ListVerificationQueryDto } from './dto/list-verification-query.dto.js';
import type { ReconcileVerificationObservationDto } from './dto/reconcile-verification-observation.dto.js';

const campaignSelect = {
  id: true,
  organizationId: true,
  locationId: true,
  name: true,
  status: true,
  version: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  completedByUserId: true,
  location: { select: { id: true, code: true, name: true } },
  _count: { select: { expectedAssets: true, observations: true } },
} satisfies Prisma.VerificationCampaignSelect;

const observationSelect = {
  id: true,
  organizationId: true,
  campaignId: true,
  expectedAssetId: true,
  observedAssetId: true,
  observedTag: true,
  observedLocationId: true,
  observedCustodianId: true,
  observedCondition: true,
  result: true,
  notes: true,
  observedAt: true,
  observedByUserId: true,
  resolution: true,
  version: true,
  reconciledByUserId: true,
  reconciledAt: true,
  resolutionNote: true,
  expectedAsset: {
    select: {
      id: true,
      expectedAssetTag: true,
      expectedLocationCode: true,
      expectedLocationName: true,
      expectedCategoryCode: true,
      expectedCategoryName: true,
      expectedLifecycle: true,
      expectedCondition: true,
    },
  },
  observedCustodian: {
    select: { id: true, employeeNumber: true, displayName: true },
  },
  observedBy: { select: { id: true, displayName: true } },
  reconciledBy: { select: { id: true, displayName: true } },
} satisfies Prisma.VerificationObservationSelect;

const expectedAssetSelect = {
  id: true,
  campaignId: true,
  assetId: true,
  expectedAssetTag: true,
  expectedLocationId: true,
  expectedLocationCode: true,
  expectedLocationName: true,
  expectedCategoryCode: true,
  expectedCategoryName: true,
  expectedLifecycle: true,
  expectedCondition: true,
  expectedAssetVersion: true,
  createdAt: true,
  observations: {
    orderBy: [{ observedAt: 'desc' }, { id: 'desc' }],
    take: 1,
    select: observationSelect,
  },
} satisfies Prisma.VerificationCampaignAssetSelect;

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
  ) {}

  async listCampaigns(
    actor: AuthenticatedActor,
    query: ListVerificationQueryDto,
  ) {
    this.requireAssetManager(actor);
    const locationIds = await this.assets.getManagedAssetLocationIds(actor);
    const where: Prisma.VerificationCampaignWhereInput = {
      organizationId: actor.organizationId,
      locationId: { in: locationIds },
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.verificationCampaign.findMany({
        where,
        select: campaignSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.verificationCampaign.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async getCampaign(actor: AuthenticatedActor, campaignId: string) {
    this.requireAssetManager(actor);
    const locationIds = await this.assets.getManagedAssetLocationIds(actor);
    const campaign = await this.prisma.verificationCampaign.findFirst({
      where: {
        id: campaignId,
        organizationId: actor.organizationId,
        locationId: { in: locationIds },
      },
      select: campaignSelect,
    });
    if (!campaign)
      throw new NotFoundException('Verification campaign not found');
    return campaign;
  }

  async createCampaign(
    actor: AuthenticatedActor,
    idempotencyKey: string | undefined,
    dto: CreateVerificationCampaignDto,
  ) {
    this.requireAssetManager(actor);
    const key = this.requireIdempotencyKey(idempotencyKey);
    const payloadHash = this.hash({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      operation: 'verification.campaign.create',
      locationId: dto.locationId,
      name: dto.name,
    });
    const locationIds = await this.assets.getManagedAssetLocationIds(actor);
    if (!locationIds.includes(dto.locationId)) {
      throw new NotFoundException('Location not found');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(
            hashtext(${actor.organizationId}),
            hashtext(${key})
          )
        `;
        const existing = await tx.verificationCampaign.findFirst({
          where: {
            organizationId: actor.organizationId,
            createdByUserId: actor.userId,
            createIdempotencyKey: key,
          },
          select: { ...campaignSelect, createPayloadHash: true },
        });
        if (existing) {
          if (existing.createPayloadHash !== payloadHash) {
            throw new ConflictException(
              'This Idempotency-Key was already used with a different verification campaign',
            );
          }
          const { createPayloadHash: _hash, ...campaign } = existing;
          return campaign;
        }

        const snapshot = await this.assets.getVerificationSnapshot(
          tx,
          actor,
          dto.locationId,
        );
        if (snapshot.assets.length === 0) {
          throw new UnprocessableEntityException(
            'A verification campaign requires at least one non-disposed asset at the selected location',
          );
        }
        const campaign = await tx.verificationCampaign.create({
          data: {
            organizationId: actor.organizationId,
            locationId: snapshot.location.id,
            name: dto.name,
            createdByUserId: actor.userId,
            createIdempotencyKey: key,
            createPayloadHash: payloadHash,
            expectedAssets: {
              createMany: {
                data: snapshot.assets.map((asset) => ({
                  organizationId: actor.organizationId,
                  assetId: asset.id,
                  expectedAssetTag: asset.assetTag,
                  expectedLocationId: snapshot.location.id,
                  expectedLocationCode: snapshot.location.code,
                  expectedLocationName: snapshot.location.name,
                  expectedCategoryCode: asset.category.code,
                  expectedCategoryName: asset.category.name,
                  expectedLifecycle: asset.lifecycle,
                  expectedCondition: asset.condition,
                  expectedAssetVersion: asset.version,
                })),
              },
            },
          },
          select: campaignSelect,
        });
        return campaign;
      });
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;
      const existing = await this.prisma.verificationCampaign.findFirst({
        where: {
          organizationId: actor.organizationId,
          createdByUserId: actor.userId,
          createIdempotencyKey: key,
        },
        select: { ...campaignSelect, createPayloadHash: true },
      });
      if (!existing) throw error;
      if (existing.createPayloadHash !== payloadHash) {
        throw new ConflictException(
          'This Idempotency-Key was already used with a different verification campaign',
        );
      }
      const { createPayloadHash: _hash, ...campaign } = existing;
      return campaign;
    }
  }

  async listExpectedAssets(
    actor: AuthenticatedActor,
    campaignId: string,
    query: ListVerificationQueryDto,
  ) {
    await this.getCampaign(actor, campaignId);
    const where: Prisma.VerificationCampaignAssetWhereInput = {
      organizationId: actor.organizationId,
      campaignId,
      ...(query.search
        ? {
            OR: [
              {
                expectedAssetTag: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                expectedCategoryName: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.verificationCampaignAsset.findMany({
        where,
        select: expectedAssetSelect,
        orderBy: [{ expectedAssetTag: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.verificationCampaignAsset.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async listObservations(
    actor: AuthenticatedActor,
    campaignId: string,
    query: ListVerificationQueryDto,
  ) {
    await this.getCampaign(actor, campaignId);
    const where = { organizationId: actor.organizationId, campaignId };
    const [items, total] = await Promise.all([
      this.prisma.verificationObservation.findMany({
        where,
        select: observationSelect,
        orderBy: [{ observedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.verificationObservation.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async recordObservation(
    actor: AuthenticatedActor,
    campaignId: string,
    expectedAssetId: string | undefined,
    idempotencyKey: string | undefined,
    dto: CreateVerificationObservationDto,
  ) {
    this.requireAssetManager(actor);
    const key = this.requireIdempotencyKey(idempotencyKey);
    const payloadHash = this.hash({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      operation: 'verification.observation.create',
      campaignId,
      expectedAssetId: expectedAssetId ?? null,
      found: dto.found,
      observedTag: dto.observedTag ?? null,
      observedLocationId: dto.observedLocationId ?? null,
      observedCustodianId: dto.observedCustodianId ?? null,
      observedCustodianNumber: dto.observedCustodianNumber ?? null,
      observedCondition: dto.observedCondition ?? null,
      notes: dto.notes ?? null,
    });
    const locationIds = await this.assets.getManagedAssetLocationIds(actor);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(
            hashtext(${actor.organizationId}),
            hashtext(${campaignId})
          )
        `;
        const campaign = await tx.verificationCampaign.findFirst({
          where: {
            id: campaignId,
            organizationId: actor.organizationId,
            locationId: { in: locationIds },
          },
          select: { id: true, status: true, locationId: true },
        });
        if (!campaign) {
          throw new NotFoundException('Verification campaign not found');
        }
        const existing = await tx.verificationObservation.findFirst({
          where: {
            organizationId: actor.organizationId,
            observedByUserId: actor.userId,
            idempotencyKey: key,
          },
          select: { ...observationSelect, payloadHash: true },
        });
        if (existing) {
          if (
            existing.payloadHash !== payloadHash ||
            existing.campaignId !== campaignId
          ) {
            throw new ConflictException(
              'This Idempotency-Key was already used with a different observation',
            );
          }
          const { payloadHash: _hash, ...observation } = existing;
          return observation;
        }
        if (campaign.status !== VerificationCampaignStatus.OPEN) {
          throw new ConflictException(
            'Observations cannot be added to a completed campaign',
          );
        }
        if (
          !dto.found &&
          (dto.observedTag ||
            dto.observedLocationId ||
            dto.observedCustodianId ||
            dto.observedCustodianNumber ||
            dto.observedCondition)
        ) {
          throw new UnprocessableEntityException(
            'A missing observation cannot include present-asset details',
          );
        }
        if (!expectedAssetId && !dto.found) {
          throw new UnprocessableEntityException(
            'Unexpected-asset observations must describe an asset that was found',
          );
        }
        if (
          dto.found &&
          (!dto.observedTag ||
            !dto.observedLocationId ||
            !dto.observedCondition)
        ) {
          throw new UnprocessableEntityException(
            'Found assets require an observed tag, location, and condition',
          );
        }

        const expected = expectedAssetId
          ? await tx.verificationCampaignAsset.findFirst({
              where: {
                id: expectedAssetId,
                organizationId: actor.organizationId,
                campaignId,
              },
              select: {
                id: true,
                assetId: true,
                expectedAssetTag: true,
                expectedLocationId: true,
              },
            })
          : null;
        if (expectedAssetId && !expected) {
          throw new NotFoundException('Expected asset not found');
        }

        if (dto.observedLocationId) {
          if (!locationIds.includes(dto.observedLocationId)) {
            throw new NotFoundException('Observed location not found');
          }
          const observedLocation = await tx.location.findFirst({
            where: {
              id: dto.observedLocationId,
              organizationId: actor.organizationId,
            },
            select: { id: true },
          });
          if (!observedLocation) {
            throw new NotFoundException('Observed location not found');
          }
        }
        if (dto.observedCustodianId && dto.observedCustodianNumber) {
          throw new UnprocessableEntityException(
            'Provide an observed custodian ID or employee number, not both',
          );
        }
        let observedCustodianId = dto.observedCustodianId;
        if (dto.observedCustodianNumber) {
          const custodian = await tx.employee.findFirst({
            where: {
              employeeNumber: dto.observedCustodianNumber,
              organizationId: actor.organizationId,
            },
            select: { id: true },
          });
          if (!custodian) {
            throw new NotFoundException('Observed custodian not found');
          }
          observedCustodianId = custodian.id;
        } else if (observedCustodianId) {
          const custodian = await tx.employee.findFirst({
            where: {
              id: observedCustodianId,
              organizationId: actor.organizationId,
            },
            select: { id: true },
          });
          if (!custodian) {
            throw new NotFoundException('Observed custodian not found');
          }
        }

        const observedAsset =
          dto.found && dto.observedTag
            ? await tx.asset.findFirst({
                where: {
                  organizationId: actor.organizationId,
                  assetTag: dto.observedTag,
                  locationId: { in: locationIds },
                },
                select: { id: true },
              })
            : null;
        let result: VerificationObservationResult;
        if (!expected) {
          const isExpectedInCampaign = observedAsset
            ? await tx.verificationCampaignAsset.findFirst({
                where: {
                  organizationId: actor.organizationId,
                  campaignId,
                  assetId: observedAsset.id,
                },
                select: { id: true },
              })
            : null;
          result = isExpectedInCampaign
            ? VerificationObservationResult.DUPLICATE
            : VerificationObservationResult.UNEXPECTED;
        } else if (!dto.found) {
          result = VerificationObservationResult.MISSING;
        } else if (dto.observedTag !== expected.expectedAssetTag) {
          result = VerificationObservationResult.TAG_MISMATCH;
        } else if (dto.observedLocationId !== expected.expectedLocationId) {
          result = VerificationObservationResult.MISPLACED;
        } else if (
          dto.observedCondition === AssetCondition.DAMAGED ||
          dto.observedCondition === AssetCondition.NONFUNCTIONAL
        ) {
          result = VerificationObservationResult.DAMAGED;
        } else {
          result = VerificationObservationResult.VERIFIED;
        }

        return tx.verificationObservation.create({
          data: {
            organizationId: actor.organizationId,
            campaignId,
            expectedAssetId: expected?.id ?? null,
            observedAssetId: observedAsset?.id ?? null,
            observedTag: dto.found ? dto.observedTag : null,
            observedLocationId: dto.found ? dto.observedLocationId : null,
            observedCustodianId: dto.found
              ? (observedCustodianId ?? null)
              : null,
            observedCondition: dto.found
              ? (dto.observedCondition ?? null)
              : null,
            result,
            notes: dto.notes || null,
            observedByUserId: actor.userId,
            idempotencyKey: key,
            payloadHash,
          },
          select: observationSelect,
        });
      });
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;
      const existing = await this.prisma.verificationObservation.findFirst({
        where: {
          organizationId: actor.organizationId,
          observedByUserId: actor.userId,
          idempotencyKey: key,
        },
        select: { ...observationSelect, payloadHash: true },
      });
      if (!existing) throw error;
      if (existing.payloadHash !== payloadHash) {
        throw new ConflictException(
          'This Idempotency-Key was already used with a different observation',
        );
      }
      const { payloadHash: _hash, ...observation } = existing;
      return observation;
    }
  }

  async reconcileObservation(
    actor: AuthenticatedActor,
    campaignId: string,
    observationId: string,
    version: number,
    idempotencyKey: string | undefined,
    dto: ReconcileVerificationObservationDto,
  ) {
    this.requireAssetManager(actor);
    const key = this.requireIdempotencyKey(idempotencyKey);
    const payloadHash = this.hash({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      operation: 'verification.observation.reconcile',
      campaignId,
      observationId,
      version,
      applyFinding: dto.applyFinding,
      note: dto.note ?? null,
    });
    const locationIds = await this.assets.getManagedAssetLocationIds(actor);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(
            hashtext(${actor.organizationId}),
            hashtext(${campaignId})
          )
        `;
        const observation = await tx.verificationObservation.findFirst({
          where: {
            id: observationId,
            campaignId,
            organizationId: actor.organizationId,
            campaign: { locationId: { in: locationIds } },
          },
          select: {
            id: true,
            campaignId: true,
            expectedAssetId: true,
            result: true,
            resolution: true,
            version: true,
            expectedAsset: {
              select: { assetId: true, expectedAssetVersion: true },
            },
          },
        });
        if (!observation) {
          throw new NotFoundException('Verification observation not found');
        }
        const replay = await tx.verificationObservation.findFirst({
          where: {
            organizationId: actor.organizationId,
            reconciledByUserId: actor.userId,
            resolutionIdempotencyKey: key,
          },
          select: { ...observationSelect, resolutionPayloadHash: true },
        });
        if (replay) {
          if (
            replay.resolutionPayloadHash !== payloadHash ||
            replay.id !== observationId ||
            replay.campaignId !== campaignId
          ) {
            throw new ConflictException(
              'This Idempotency-Key was already used with a different reconciliation',
            );
          }
          const { resolutionPayloadHash: _hash, ...observation } = replay;
          return observation;
        }
        if (
          observation.resolution !== VerificationObservationResolution.PENDING
        ) {
          throw new ConflictException(
            'This observation has already been reviewed',
          );
        }
        if (dto.applyFinding && !observation.expectedAsset) {
          throw new UnprocessableEntityException(
            'An unexpected asset observation cannot update an asset verification state',
          );
        }

        if (dto.applyFinding && observation.expectedAsset) {
          const verification =
            observation.result === VerificationObservationResult.VERIFIED
              ? AssetVerification.VERIFIED
              : observation.result === VerificationObservationResult.MISSING
                ? AssetVerification.MISSING
                : AssetVerification.DISPUTED;
          await this.assets.reconcileVerification(
            tx,
            actor,
            observation.expectedAsset.assetId,
            observation.expectedAsset.expectedAssetVersion,
            verification,
            campaignId,
            observation.id,
          );
        }

        const updated = await tx.verificationObservation.updateMany({
          where: {
            id: observationId,
            organizationId: actor.organizationId,
            campaignId,
            version,
            resolution: VerificationObservationResolution.PENDING,
          },
          data: {
            resolution: dto.applyFinding
              ? VerificationObservationResolution.RECONCILED
              : VerificationObservationResolution.DISMISSED,
            reconciledByUserId: actor.userId,
            reconciledAt: new Date(),
            resolutionIdempotencyKey: key,
            resolutionPayloadHash: payloadHash,
            resolutionNote: dto.note || null,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException(
            'The observation changed while it was being reviewed',
          );
        }
        return tx.verificationObservation.findFirstOrThrow({
          where: {
            id: observationId,
            organizationId: actor.organizationId,
            campaignId,
          },
          select: observationSelect,
        });
      });
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;
      const replay = await this.prisma.verificationObservation.findFirst({
        where: {
          organizationId: actor.organizationId,
          reconciledByUserId: actor.userId,
          resolutionIdempotencyKey: key,
        },
        select: { ...observationSelect, resolutionPayloadHash: true },
      });
      if (!replay) throw error;
      if (
        replay.resolutionPayloadHash !== payloadHash ||
        replay.id !== observationId
      ) {
        throw new ConflictException(
          'This Idempotency-Key was already used with a different reconciliation',
        );
      }
      const { resolutionPayloadHash: _hash, ...observation } = replay;
      return observation;
    }
  }

  async completeCampaign(
    actor: AuthenticatedActor,
    campaignId: string,
    version: number,
    idempotencyKey: string | undefined,
  ) {
    this.requireAssetManager(actor);
    const key = this.requireIdempotencyKey(idempotencyKey);
    const payloadHash = this.hash({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      operation: 'verification.campaign.complete',
      campaignId,
      version,
    });
    const locationIds = await this.assets.getManagedAssetLocationIds(actor);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(
            hashtext(${actor.organizationId}),
            hashtext(${campaignId})
          )
        `;
        const campaign = await tx.verificationCampaign.findFirst({
          where: {
            id: campaignId,
            organizationId: actor.organizationId,
            locationId: { in: locationIds },
          },
          select: { id: true, status: true, version: true },
        });
        if (!campaign) {
          throw new NotFoundException('Verification campaign not found');
        }
        const replay = await tx.verificationCampaign.findFirst({
          where: {
            organizationId: actor.organizationId,
            completedByUserId: actor.userId,
            completionIdempotencyKey: key,
          },
          select: { ...campaignSelect, completionPayloadHash: true },
        });
        if (replay) {
          if (
            replay.completionPayloadHash !== payloadHash ||
            replay.id !== campaignId
          ) {
            throw new ConflictException(
              'This Idempotency-Key was already used with a different campaign completion',
            );
          }
          const { completionPayloadHash: _hash, ...campaign } = replay;
          return campaign;
        }
        if (campaign.status !== VerificationCampaignStatus.OPEN) {
          throw new ConflictException('This campaign is already complete');
        }
        if (campaign.version !== version) {
          throw new ConflictException(
            'The campaign changed since it was loaded. Reload before completing it.',
          );
        }

        const unresolved = await tx.$queryRaw<Array<{ unresolved: boolean }>>`
          SELECT EXISTS (
            SELECT 1
            FROM "verification_campaign_assets" expected
            LEFT JOIN LATERAL (
              SELECT observation."resolution"
              FROM "verification_observations" observation
              WHERE observation."organization_id" = expected."organization_id"
                AND observation."expected_asset_id" = expected."id"
              ORDER BY observation."observed_at" DESC, observation."id" DESC
              LIMIT 1
            ) latest ON TRUE
            WHERE expected."organization_id" = ${actor.organizationId}::uuid
              AND expected."campaign_id" = ${campaignId}::uuid
              AND (latest."resolution" IS NULL OR latest."resolution" = 'PENDING')
          ) AS unresolved
        `;
        const pendingUnexpected = await tx.verificationObservation.count({
          where: {
            organizationId: actor.organizationId,
            campaignId,
            expectedAssetId: null,
            resolution: VerificationObservationResolution.PENDING,
          },
        });
        if (unresolved[0]?.unresolved || pendingUnexpected > 0) {
          throw new UnprocessableEntityException(
            'Every expected asset and unexpected-asset observation must be reviewed before completing the campaign',
          );
        }

        const updated = await tx.verificationCampaign.updateMany({
          where: {
            id: campaignId,
            organizationId: actor.organizationId,
            locationId: { in: locationIds },
            status: VerificationCampaignStatus.OPEN,
            version,
          },
          data: {
            status: VerificationCampaignStatus.COMPLETED,
            completedAt: new Date(),
            completedByUserId: actor.userId,
            completionIdempotencyKey: key,
            completionPayloadHash: payloadHash,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException(
            'The campaign changed while it was being completed',
          );
        }
        return tx.verificationCampaign.findFirstOrThrow({
          where: { id: campaignId, organizationId: actor.organizationId },
          select: campaignSelect,
        });
      });
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;
      const replay = await this.prisma.verificationCampaign.findFirst({
        where: {
          organizationId: actor.organizationId,
          completedByUserId: actor.userId,
          completionIdempotencyKey: key,
        },
        select: { ...campaignSelect, completionPayloadHash: true },
      });
      if (!replay) throw error;
      if (
        replay.completionPayloadHash !== payloadHash ||
        replay.id !== campaignId
      ) {
        throw new ConflictException(
          'This Idempotency-Key was already used with a different campaign completion',
        );
      }
      const { completionPayloadHash: _hash, ...campaign } = replay;
      return campaign;
    }
  }

  private requireAssetManager(actor: AuthenticatedActor): void {
    if (actor.role !== UserRole.ASSET_MANAGER) {
      throw new ForbiddenException(
        'Physical verification is available to Asset Managers only',
      );
    }
  }

  private requireIdempotencyKey(value: string | undefined): string {
    const key = value?.trim();
    if (!key || key.length > 100) {
      throw new UnprocessableEntityException(
        'A valid Idempotency-Key header is required',
      );
    }
    return key;
  }

  private hash(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private isUniqueViolation(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
