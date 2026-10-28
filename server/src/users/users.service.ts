import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { UserRole } from '../generated/prisma/enums.js';
import bcrypt from 'bcryptjs';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateUserDto } from './dto/create-user.dto.js';

const publicUserSelect = {
  id: true,
  organizationId: true,
  email: true,
  displayName: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
  locationScopes: {
    where: { revokedAt: null },
    select: {
      id: true,
      locationId: true,
      location: { select: { code: true, name: true } },
    },
  },
} satisfies Prisma.UserSelect;

type ManagedUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list(actor: AuthenticatedActor): Promise<ManagedUser[]> {
    this.requireAdministrator(actor);
    return this.prisma.user.findMany({
      where: { organizationId: actor.organizationId },
      select: publicUserSelect,
      orderBy: [{ displayName: 'asc' }, { email: 'asc' }],
    });
  }

  async create(
    actor: AuthenticatedActor,
    dto: CreateUserDto,
  ): Promise<ManagedUser> {
    this.requireAdministrator(actor);
    if (Buffer.byteLength(dto.temporaryPassword, 'utf8') > 72) {
      throw new BadRequestException(
        'Temporary password exceeds the supported byte-length limit',
      );
    }

    const passwordHash = await bcrypt.hash(dto.temporaryPassword, 12);
    try {
      return await this.prisma.user.create({
        data: {
          organizationId: actor.organizationId,
          email: dto.email,
          displayName: dto.displayName,
          passwordHash,
          role: dto.role,
          mustChangePassword: true,
        },
        select: publicUserSelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A user with this email already exists in the organization',
        );
      }
      throw error;
    }
  }

  changeRole(
    actor: AuthenticatedActor,
    userId: string,
    role: UserRole,
  ): Promise<ManagedUser> {
    this.requireAdministrator(actor);
    if (actor.userId === userId) {
      throw new ForbiddenException('You cannot change your own role');
    }

    return this.runSerializable(async (transaction) => {
      const target = await transaction.user.findFirst({
        where: { id: userId, organizationId: actor.organizationId },
        select: { id: true, role: true, isActive: true, version: true },
      });
      if (!target) {
        throw new NotFoundException('User not found');
      }
      if (target.role === role) {
        return transaction.user.findFirstOrThrow({
          where: { id: target.id, organizationId: actor.organizationId },
          select: publicUserSelect,
        });
      }

      if (
        target.isActive &&
        target.role === UserRole.ADMINISTRATOR &&
        role !== UserRole.ADMINISTRATOR
      ) {
        await this.requireAnotherActiveAdministrator(
          transaction,
          actor.organizationId,
          target.id,
        );
      }

      const updated = await transaction.user.updateMany({
        where: {
          id: target.id,
          organizationId: actor.organizationId,
          version: target.version,
          isActive: target.isActive,
        },
        data: { role, version: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new ConflictException('The user changed; reload and try again');
      }
      await this.revokeSessions(transaction, actor.organizationId, target.id);
      if (
        target.role !== role &&
        role !== UserRole.ASSET_MANAGER &&
        role !== UserRole.PROCUREMENT_FINANCE
      ) {
        await transaction.userLocationScope.updateMany({
          where: {
            organizationId: actor.organizationId,
            userId: target.id,
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
            revokedByUserId: actor.userId,
          },
        });
      }
      return transaction.user.findFirstOrThrow({
        where: { id: target.id, organizationId: actor.organizationId },
        select: publicUserSelect,
      });
    });
  }

  async resetPassword(
    actor: AuthenticatedActor,
    userId: string,
    temporaryPassword: string,
  ): Promise<ManagedUser> {
    this.requireAdministrator(actor);
    if (actor.userId === userId) {
      throw new ForbiddenException(
        'Use the password-change flow to update your own password',
      );
    }
    if (Buffer.byteLength(temporaryPassword, 'utf8') > 72) {
      throw new BadRequestException(
        'Temporary password exceeds the supported byte-length limit',
      );
    }
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    return this.runSerializable(async (transaction) => {
      const target = await transaction.user.findFirst({
        where: { id: userId, organizationId: actor.organizationId },
        select: { id: true, isActive: true, version: true },
      });
      if (!target) {
        throw new NotFoundException('User not found');
      }

      const updated = await transaction.user.updateMany({
        where: {
          id: target.id,
          organizationId: actor.organizationId,
          version: target.version,
          isActive: target.isActive,
        },
        data: {
          passwordHash,
          isActive: true,
          mustChangePassword: true,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('The user changed; reload and try again');
      }
      await this.revokeSessions(transaction, actor.organizationId, target.id);
      return transaction.user.findFirstOrThrow({
        where: { id: target.id, organizationId: actor.organizationId },
        select: publicUserSelect,
      });
    });
  }

  setLocationScope(
    actor: AuthenticatedActor,
    userId: string,
    locationIds: string[],
  ): Promise<ManagedUser> {
    this.requireAdministrator(actor);
    if (locationIds.length !== new Set(locationIds).size) {
      throw new BadRequestException('Location IDs must be unique');
    }
    return this.runSerializable(async (transaction) => {
      const target = await transaction.user.findFirst({
        where: { id: userId, organizationId: actor.organizationId },
        select: { id: true, role: true },
      });
      if (!target) {
        throw new NotFoundException('User not found');
      }
      if (
        target.role !== UserRole.ASSET_MANAGER &&
        target.role !== UserRole.PROCUREMENT_FINANCE
      ) {
        throw new BadRequestException(
          'Location scopes apply only to Asset Manager and Procurement/Finance roles',
        );
      }

      const locations = await transaction.location.findMany({
        where: {
          organizationId: actor.organizationId,
          isActive: true,
          id: { in: locationIds },
        },
        select: { id: true },
      });
      if (locations.length !== new Set(locationIds).size) {
        throw new BadRequestException(
          'One or more selected locations are unavailable in this organization',
        );
      }

      const current = await transaction.userLocationScope.findMany({
        where: {
          organizationId: actor.organizationId,
          userId: target.id,
          revokedAt: null,
        },
        select: { id: true, locationId: true },
      });
      const requestedIds = new Set(locationIds);
      const currentIds = new Set(current.map(({ locationId }) => locationId));
      const removedIds = current
        .filter(({ locationId }) => !requestedIds.has(locationId))
        .map(({ id }) => id);
      const addedIds = locationIds.filter(
        (locationId) => !currentIds.has(locationId),
      );
      const now = new Date();

      if (removedIds.length > 0) {
        await transaction.userLocationScope.updateMany({
          where: {
            organizationId: actor.organizationId,
            id: { in: removedIds },
            revokedAt: null,
          },
          data: {
            revokedAt: now,
            revokedByUserId: actor.userId,
          },
        });
      }
      if (addedIds.length > 0) {
        await transaction.userLocationScope.createMany({
          data: addedIds.map((locationId) => ({
            organizationId: actor.organizationId,
            userId: target.id,
            locationId,
            assignedByUserId: actor.userId,
          })),
        });
      }
      return transaction.user.findFirstOrThrow({
        where: { id: target.id, organizationId: actor.organizationId },
        select: publicUserSelect,
      });
    });
  }

  deactivate(actor: AuthenticatedActor, userId: string): Promise<void> {
    this.requireAdministrator(actor);
    if (actor.userId === userId) {
      throw new ForbiddenException('You cannot deactivate your own account');
    }

    return this.runSerializable(async (transaction) => {
      const target = await transaction.user.findFirst({
        where: { id: userId, organizationId: actor.organizationId },
        select: { id: true, role: true, isActive: true, version: true },
      });
      if (!target) {
        throw new NotFoundException('User not found');
      }
      if (!target.isActive) {
        return;
      }

      if (target.role === UserRole.ADMINISTRATOR) {
        await this.requireAnotherActiveAdministrator(
          transaction,
          actor.organizationId,
          target.id,
        );
      }

      const updated = await transaction.user.updateMany({
        where: {
          id: target.id,
          organizationId: actor.organizationId,
          version: target.version,
          isActive: true,
        },
        data: { isActive: false, version: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new ConflictException('The user changed; reload and try again');
      }
      await this.revokeSessions(transaction, actor.organizationId, target.id);
    });
  }

  private async requireAnotherActiveAdministrator(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    excludedUserId: string,
  ): Promise<void> {
    const count = await transaction.user.count({
      where: {
        organizationId,
        isActive: true,
        role: UserRole.ADMINISTRATOR,
        id: { not: excludedUserId },
      },
    });
    if (count === 0) {
      throw new ConflictException(
        'The organization must retain an active Administrator',
      );
    }
  }

  private requireAdministrator(actor: AuthenticatedActor): void {
    if (actor.role !== UserRole.ADMINISTRATOR) {
      throw new ForbiddenException('Administrator access is required');
    }
  }

  private async revokeSessions(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    userId: string,
  ): Promise<void> {
    await transaction.refreshSession.updateMany({
      where: { organizationId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async runSerializable<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(operation, {
        isolationLevel: 'Serializable',
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2034' || error.code === 'P2002')
      ) {
        throw new ConflictException(
          'A concurrent account change occurred; reload and try again',
        );
      }
      throw error;
    }
  }
}
