import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { UserRole } from '../generated/prisma/enums.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { AssetsService } from '../assets/assets.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateRetirementRequestDto } from './dto/create-retirement-request.dto.js';
import type { ListRetirementRequestsQueryDto } from './dto/list-retirement-requests-query.dto.js';

const retirementRequestSelect = {
  id: true,
  organizationId: true,
  assetId: true,
  requestedByUserId: true,
  reason: true,
  impactReview: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  asset: {
    select: {
      id: true,
      assetTag: true,
      lifecycle: true,
      availability: true,
      location: { select: { id: true, code: true, name: true } },
      category: { select: { code: true, name: true } },
    },
  },
  requestedBy: { select: { id: true, displayName: true } },
} satisfies Prisma.RetirementRequestSelect;

@Injectable()
export class RetirementRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
  ) {}

  async list(actor: AuthenticatedActor, query: ListRetirementRequestsQueryDto) {
    this.requireAssetManager(actor);
    const locationIds = await this.assets.getManagedAssetLocationIds(actor);
    const where: Prisma.RetirementRequestWhereInput = {
      organizationId: actor.organizationId,
      asset: { locationId: { in: locationIds } },
      ...(query.search
        ? {
            OR: [
              {
                asset: {
                  assetTag: { contains: query.search, mode: 'insensitive' },
                },
              },
              { reason: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.retirementRequest.findMany({
        where,
        select: retirementRequestSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.retirementRequest.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async create(
    actor: AuthenticatedActor,
    assetId: string,
    idempotencyKey: string | undefined,
    dto: CreateRetirementRequestDto,
  ) {
    this.requireAssetManager(actor);
    const key = idempotencyKey?.trim();
    if (!key || key.length > 100) {
      throw new UnprocessableEntityException(
        'A valid Idempotency-Key header is required',
      );
    }
    const payloadHash = createHash('sha256')
      .update(
        JSON.stringify({
          organizationId: actor.organizationId,
          actorId: actor.userId,
          operation: 'retirement-request.create',
          assetId,
          reason: dto.reason,
          impactReview: dto.impactReview,
        }),
      )
      .digest('hex');

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(
            hashtext(${actor.organizationId}),
            hashtext(${assetId})
          )
        `;
        await this.assets.getRetirementTarget(tx, actor, assetId);
        const existing = await tx.retirementRequest.findFirst({
          where: {
            organizationId: actor.organizationId,
            requestedByUserId: actor.userId,
            idempotencyKey: key,
          },
          select: { ...retirementRequestSelect, payloadHash: true },
        });
        if (existing) {
          if (
            existing.payloadHash !== payloadHash ||
            existing.assetId !== assetId
          ) {
            throw new ConflictException(
              'This Idempotency-Key was already used with a different retirement request',
            );
          }
          const { payloadHash: _hash, ...retirementRequest } = existing;
          return retirementRequest;
        }

        const existingRequest = await tx.retirementRequest.findFirst({
          where: { organizationId: actor.organizationId, assetId },
          select: { id: true },
        });
        if (existingRequest) {
          throw new ConflictException(
            'A retirement request is already pending for this asset',
          );
        }
        const retirementRequest = await tx.retirementRequest.create({
          data: {
            organizationId: actor.organizationId,
            assetId,
            requestedByUserId: actor.userId,
            reason: dto.reason,
            impactReview: dto.impactReview,
            idempotencyKey: key,
            payloadHash,
          },
          select: retirementRequestSelect,
        });
        await this.assets.recordRetirementRequested(
          tx,
          actor,
          assetId,
          retirementRequest.id,
        );
        return retirementRequest;
      });
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;
      const existing = await this.prisma.retirementRequest.findFirst({
        where: {
          organizationId: actor.organizationId,
          requestedByUserId: actor.userId,
          idempotencyKey: key,
        },
        select: { ...retirementRequestSelect, payloadHash: true },
      });
      if (!existing) {
        throw new ConflictException(
          'A retirement request is already pending for this asset',
        );
      }
      if (
        existing.payloadHash !== payloadHash ||
        existing.assetId !== assetId
      ) {
        throw new ConflictException(
          'This Idempotency-Key was already used with a different retirement request',
        );
      }
      const { payloadHash: _hash, ...retirementRequest } = existing;
      return retirementRequest;
    }
  }

  private requireAssetManager(actor: AuthenticatedActor): void {
    if (actor.role !== UserRole.ASSET_MANAGER) {
      throw new ForbiddenException(
        'Retirement requests are available to Asset Managers only',
      );
    }
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
