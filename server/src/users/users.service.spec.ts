import { jest } from '@jest/globals';
import { UserRole } from '../generated/prisma/enums.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from './users.service.js';

const organizationId = '40e9ce48-e66d-4bfc-a4ea-df85269a96c3';
const administratorId = 'c0985b17-75bb-4a80-9763-35d673ec05f2';
const userId = '27ae8d6f-3848-4528-9f31-ec585d08e9b5';

describe('UsersService', () => {
  const actor = {
    userId: administratorId,
    organizationId,
    sessionId: 'session-id',
    familyId: 'family-id',
    email: 'admin@example.com',
    displayName: 'Administrator',
    organizationName: 'Example Organization',
    role: UserRole.ADMINISTRATOR,
    mustChangePassword: false,
    version: 1,
  } satisfies AuthenticatedActor;

  const database = {
    user: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    location: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const transaction = {
    user: {
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    location: {
      findMany: jest.fn(),
    },
    userLocationScope: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      createMany: jest.fn(),
    },
    refreshSession: {
      updateMany: jest.fn(),
    },
  };
  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    database.$transaction.mockImplementation(
      async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );
    service = new UsersService(database as unknown as PrismaService);
  });

  it('scopes the user list to the authenticated organization', async () => {
    database.user.findMany.mockResolvedValue([]);

    await service.list(actor);

    expect(database.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId },
        orderBy: [{ displayName: 'asc' }, { email: 'asc' }],
      }),
    );
  });

  it('prevents deactivating the final active Administrator', async () => {
    transaction.user.findFirst.mockResolvedValue({
      id: userId,
      role: UserRole.ADMINISTRATOR,
      isActive: true,
      version: 3,
    });
    transaction.user.count.mockResolvedValue(0);

    await expect(service.deactivate(actor, userId)).rejects.toThrow(
      'The organization must retain an active Administrator',
    );

    expect(transaction.user.updateMany).not.toHaveBeenCalled();
    expect(transaction.refreshSession.updateMany).not.toHaveBeenCalled();
  });

  it('prevents administrators from deactivating their own account', async () => {
    expect(() => service.deactivate(actor, administratorId)).toThrow(
      'You cannot deactivate your own account',
    );
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it('reactivates an account with a new forced-change password', async () => {
    transaction.user.findFirst.mockResolvedValue({
      id: userId,
      isActive: false,
      version: 4,
    });
    transaction.user.updateMany.mockResolvedValue({ count: 1 });
    transaction.user.findFirstOrThrow.mockResolvedValue({
      id: userId,
      organizationId,
      email: 'person@example.com',
      displayName: 'Example Person',
      role: UserRole.EMPLOYEE,
      isActive: true,
      mustChangePassword: true,
      createdAt: new Date(),
    });
    transaction.refreshSession.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.resetPassword(
      actor,
      userId,
      'temporary-password',
    );

    expect(result).toMatchObject({
      id: userId,
      isActive: true,
      mustChangePassword: true,
    });
    expect(transaction.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isActive: true,
          mustChangePassword: true,
          version: { increment: 1 },
        }),
      }),
    );
    expect(transaction.refreshSession.updateMany).toHaveBeenCalled();
  });

  it('rejects temporary passwords beyond bcrypt’s byte limit', async () => {
    await expect(
      service.create(actor, {
        email: 'person@example.com',
        displayName: 'Example Person',
        role: UserRole.EMPLOYEE,
        temporaryPassword: 'é'.repeat(37),
      }),
    ).rejects.toThrow('Temporary password exceeds the supported byte-length');
    expect(database.user.create).not.toHaveBeenCalled();
  });

  it('rejects location scopes that are outside the organization', async () => {
    transaction.user.findFirst.mockResolvedValue({
      id: userId,
      role: UserRole.ASSET_MANAGER,
    });
    transaction.location.findMany.mockResolvedValue([]);

    await expect(
      service.setLocationScope(actor, userId, [
        '9c73dc96-27d7-4e8d-ae3b-0af4e9e9a1f2',
      ]),
    ).rejects.toThrow(
      'One or more selected locations are unavailable in this organization',
    );
    expect(transaction.userLocationScope.createMany).not.toHaveBeenCalled();
  });

  it('revokes location grants when a user changes to an unscoped role', async () => {
    transaction.user.findFirst.mockResolvedValue({
      id: userId,
      role: UserRole.ASSET_MANAGER,
      isActive: true,
      version: 2,
    });
    transaction.user.updateMany.mockResolvedValue({ count: 1 });
    transaction.user.findFirstOrThrow.mockResolvedValue({
      id: userId,
      organizationId,
      email: 'person@example.com',
      displayName: 'Example Person',
      role: UserRole.EMPLOYEE,
      isActive: true,
      mustChangePassword: false,
      createdAt: new Date(),
      locationScopes: [],
    });
    transaction.refreshSession.updateMany.mockResolvedValue({ count: 1 });
    transaction.userLocationScope.updateMany.mockResolvedValue({ count: 1 });

    await service.changeRole(actor, userId, UserRole.EMPLOYEE);

    expect(transaction.userLocationScope.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId,
          userId,
          revokedAt: null,
        },
        data: expect.objectContaining({
          revokedByUserId: administratorId,
          revokedAt: expect.any(Date),
        }),
      }),
    );
  });
});
