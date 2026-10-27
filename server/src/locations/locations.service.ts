import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { UserRole } from '../generated/prisma/enums.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateLocationDto } from './dto/create-location.dto.js';
import type { CreateStoreDto } from './dto/create-store.dto.js';

const locationSelect = {
  id: true,
  organizationId: true,
  parentLocationId: true,
  code: true,
  name: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.LocationSelect;

const storeSelect = {
  id: true,
  organizationId: true,
  locationId: true,
  code: true,
  name: true,
  isActive: true,
  createdAt: true,
  location: { select: { code: true, name: true } },
} satisfies Prisma.StoreSelect;

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listLocations(actor: AuthenticatedActor) {
    const locationIds = await this.accessibleLocationIds(actor);
    return this.prisma.location.findMany({
      where: {
        organizationId: actor.organizationId,
        isActive: true,
        ...(locationIds ? { id: { in: locationIds } } : {}),
      },
      select: locationSelect,
      orderBy: [{ code: 'asc' }],
    });
  }

  async listStores(actor: AuthenticatedActor) {
    const locationIds = await this.accessibleLocationIds(actor);
    return this.prisma.store.findMany({
      where: {
        organizationId: actor.organizationId,
        isActive: true,
        ...(locationIds
          ? { locationId: { in: locationIds } }
          : { location: { isActive: true } }),
      },
      select: storeSelect,
      orderBy: [{ code: 'asc' }],
    });
  }

  async createLocation(actor: AuthenticatedActor, dto: CreateLocationDto) {
    this.requireAdministrator(actor);
    if (dto.parentLocationId) {
      const parent = await this.prisma.location.findFirst({
        where: {
          id: dto.parentLocationId,
          organizationId: actor.organizationId,
          isActive: true,
        },
        select: { id: true },
      });
      if (!parent) {
        throw new NotFoundException('Parent location not found');
      }
    }

    try {
      return await this.prisma.location.create({
        data: {
          organizationId: actor.organizationId,
          parentLocationId: dto.parentLocationId ?? null,
          code: dto.code,
          name: dto.name,
        },
        select: locationSelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A location with this code already exists in the organization',
        );
      }
      throw error;
    }
  }

  async createStore(actor: AuthenticatedActor, dto: CreateStoreDto) {
    this.requireAdministrator(actor);
    const location = await this.prisma.location.findFirst({
      where: {
        id: dto.locationId,
        organizationId: actor.organizationId,
        isActive: true,
      },
      select: { id: true },
    });
    if (!location) {
      throw new NotFoundException('Location not found');
    }

    try {
      return await this.prisma.store.create({
        data: {
          organizationId: actor.organizationId,
          locationId: location.id,
          code: dto.code,
          name: dto.name,
        },
        select: storeSelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A store with this code already exists in the organization',
        );
      }
      throw error;
    }
  }

  private async accessibleLocationIds(
    actor: AuthenticatedActor,
  ): Promise<string[] | null> {
    if (actor.role === UserRole.ADMINISTRATOR) {
      return null;
    }
    if (
      actor.role !== UserRole.ASSET_MANAGER &&
      actor.role !== UserRole.PROCUREMENT_FINANCE
    ) {
      throw new ForbiddenException(
        'This role cannot read location and store records',
      );
    }

    const [locations, grants] = await Promise.all([
      this.prisma.location.findMany({
        where: {
          organizationId: actor.organizationId,
          isActive: true,
        },
        select: { id: true, parentLocationId: true },
      }),
      this.prisma.userLocationScope.findMany({
        where: {
          organizationId: actor.organizationId,
          userId: actor.userId,
          revokedAt: null,
        },
        select: { locationId: true },
      }),
    ]);

    const childrenByParent = new Map<string, string[]>();
    const activeLocationIds = new Set(locations.map(({ id }) => id));
    for (const location of locations) {
      if (!location.parentLocationId) continue;
      const children = childrenByParent.get(location.parentLocationId) ?? [];
      children.push(location.id);
      childrenByParent.set(location.parentLocationId, children);
    }

    const accessible = new Set<string>();
    const queue = grants
      .map(({ locationId }) => locationId)
      .filter((locationId) => activeLocationIds.has(locationId));
    while (queue.length > 0) {
      const locationId = queue.pop();
      if (!locationId || accessible.has(locationId)) continue;
      accessible.add(locationId);
      queue.push(...(childrenByParent.get(locationId) ?? []));
    }
    return [...accessible];
  }

  getAccessibleLocationIds(
    actor: AuthenticatedActor,
  ): Promise<string[] | null> {
    return this.accessibleLocationIds(actor);
  }

  private requireAdministrator(actor: AuthenticatedActor): void {
    if (actor.role !== UserRole.ADMINISTRATOR) {
      throw new ForbiddenException('Administrator access is required');
    }
  }
}
