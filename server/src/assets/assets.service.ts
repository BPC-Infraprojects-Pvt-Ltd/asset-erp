import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import {
  AssetAvailability,
  AssetCondition,
  AssetLifecycle,
  AssetVerification,
  UserRole,
} from '../generated/prisma/enums.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { LocationsService } from '../locations/locations.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateAssetCategoryDto } from './dto/create-asset-category.dto.js';
import type { CreateAssetDto } from './dto/create-asset.dto.js';
import type { ListAssetCategoriesQueryDto } from './dto/list-asset-categories-query.dto.js';
import type { ListAssetsQueryDto } from './dto/list-assets-query.dto.js';
import type { UpdateAssetProfileDto } from './dto/update-asset-profile.dto.js';

const categorySelect = {
  id: true,
  organizationId: true,
  code: true,
  name: true,
  isActive: true,
  createdAt: true,
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
  sourceReference: true,
  notes: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, code: true, name: true } },
  location: { select: { id: true, code: true, name: true } },
} satisfies Prisma.AssetSelect;

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
    const where: Prisma.AssetCategoryWhereInput = {
      organizationId: actor.organizationId,
      isActive: true,
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

  async createCategory(actor: AuthenticatedActor, dto: CreateAssetCategoryDto) {
    this.requireAdministrator(actor);
    try {
      return await this.prisma.assetCategory.create({
        data: {
          organizationId: actor.organizationId,
          code: dto.code,
          name: dto.name,
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

  async list(actor: AuthenticatedActor, query: ListAssetsQueryDto) {
    this.requireAssetManager(actor);
    const accessibleLocationIds =
      (await this.locations.getAccessibleLocationIds(actor)) ?? [];
    if (query.locationId && !accessibleLocationIds.includes(query.locationId)) {
      throw new NotFoundException('Location not found');
    }

    const where: Prisma.AssetWhereInput = {
      organizationId: actor.organizationId,
      locationId: {
        in: query.locationId ? [query.locationId] : accessibleLocationIds,
      },
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.lifecycle ? { lifecycle: query.lifecycle } : {}),
      ...(query.availability ? { availability: query.availability } : {}),
      ...(query.condition ? { condition: query.condition } : {}),
      ...(query.search
        ? {
            OR: [
              { assetTag: { contains: query.search, mode: 'insensitive' } },
              { serialNumber: { contains: query.search, mode: 'insensitive' } },
              { manufacturer: { contains: query.search, mode: 'insensitive' } },
              { model: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
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

    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async get(actor: AuthenticatedActor, assetId: string) {
    this.requireAssetManager(actor);
    const accessibleLocationIds =
      (await this.locations.getAccessibleLocationIds(actor)) ?? [];
    const asset = await this.prisma.asset.findFirst({
      where: {
        id: assetId,
        organizationId: actor.organizationId,
        locationId: { in: accessibleLocationIds },
      },
      select: assetSelect,
    });
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }
    return asset;
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
      const asset = await tx.asset.findFirst({
        where,
        select: { id: true },
      });
      if (!asset) {
        throw new NotFoundException('Asset not found');
      }
      const updated = await tx.asset.updateMany({
        where: { ...where, version },
        data: {
          manufacturer: dto.manufacturer || null,
          model: dto.model || null,
          serialNumber: dto.serialNumber || null,
          sourceReference: dto.sourceReference || null,
          notes: dto.notes || null,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          'The asset changed since it was loaded. Reload and review the latest profile before saving again.',
        );
      }
      return tx.asset.findFirstOrThrow({ where, select: assetSelect });
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
        select: { id: true },
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
    if (!location) {
      throw new NotFoundException('Location not found');
    }

    try {
      return await this.prisma.asset.create({
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
          verification: AssetVerification.NOT_CHECKED,
          sourceReference: dto.sourceReference || null,
          notes: dto.notes || null,
          createdByUserId: actor.userId,
        },
        select: assetSelect,
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

  private requireAssetManager(actor: AuthenticatedActor): void {
    if (actor.role !== UserRole.ASSET_MANAGER) {
      throw new ForbiddenException('Asset Manager access is required');
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
