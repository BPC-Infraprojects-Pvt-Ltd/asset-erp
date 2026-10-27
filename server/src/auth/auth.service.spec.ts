import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { jest } from '@jest/globals';
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import type { LoginDto } from './dto/login.dto.js';
import type { AuthenticatedActor } from './auth.types.js';

const userId = 'c0985b17-75bb-4a80-9763-35d673ec05f2';
const organizationId = '40e9ce48-e66d-4bfc-a4ea-df85269a96c3';
const familyId = 'f810bb6e-234b-4bb0-a695-3aeef7c031f6';
const sessionId = '27ae8d6f-3848-4528-9f31-ec585d08e9b5';

describe('AuthService', () => {
  const configValues: Record<string, string | number> = {
    ACCESS_TOKEN_TTL_SECONDS: 600,
    REFRESH_TOKEN_TTL_SECONDS: 2_592_000,
    JWT_ACCESS_SECRET: 'test-access-secret-not-for-deployment-0001',
    JWT_REFRESH_SECRET: 'test-refresh-secret-not-for-deployment-0002',
  };
  const config = {
    getOrThrow: jest.fn((name: string) => configValues[name]),
  };
  const jwt = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };
  const database = {
    user: {
      findFirst: jest.fn(),
    },
    refreshSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: AuthService;
  let user: {
    id: string;
    organizationId: string;
    email: string;
    displayName: string;
    passwordHash: string;
    role: 'ADMINISTRATOR' | 'EMPLOYEE';
    isActive: boolean;
    mustChangePassword: boolean;
    version: number;
    organization: { id: string; name: string; isActive: boolean };
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    user = {
      id: userId,
      organizationId,
      email: 'person@example.com',
      displayName: 'Example Person',
      passwordHash: await bcrypt.hash('correct-password', 4),
      role: 'EMPLOYEE',
      isActive: true,
      mustChangePassword: false,
      version: 1,
      organization: {
        id: organizationId,
        name: 'Example Organization',
        isActive: true,
      },
    };
    jwt.signAsync
      .mockResolvedValueOnce('new-access-token')
      .mockResolvedValueOnce('new-refresh-token');
    service = new AuthService(
      database as unknown as PrismaService,
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
    );
  });

  it('scopes sign-in by organization and normalizes email', async () => {
    database.user.findFirst.mockResolvedValue(user);
    database.refreshSession.create.mockResolvedValue({});

    const result = await service.login({
      organizationId,
      email: ' Person@Example.com ',
      password: 'correct-password',
    } satisfies LoginDto);

    expect(database.user.findFirst).toHaveBeenCalledWith({
      where: { organizationId, email: 'person@example.com' },
      include: { organization: true },
    });
    expect(database.refreshSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId, userId }),
      }),
    );
    expect(result).toMatchObject({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      user: {
        id: userId,
        role: 'EMPLOYEE',
        organization: { id: organizationId, name: 'Example Organization' },
      },
    });
  });

  it("rejects a password that exceeds bcrypt's byte limit", async () => {
    await expect(
      service.login({
        organizationId,
        email: 'person@example.com',
        password: 'é'.repeat(37),
      }),
    ).rejects.toThrow('Invalid organization, email, or password');
    expect(database.user.findFirst).not.toHaveBeenCalled();
  });

  it('does not treat an incorrect current password as an expired session', async () => {
    database.user.findFirst.mockResolvedValue(user);
    const actor = {
      userId,
      organizationId,
      sessionId,
      familyId,
      email: user.email,
      displayName: user.displayName,
      organizationName: user.organization.name,
      role: user.role,
      mustChangePassword: false,
      version: user.version,
    } satisfies AuthenticatedActor;

    await expect(
      service.changePassword(actor, {
        currentPassword: 'incorrect-password',
        newPassword: 'new-password',
      }),
    ).rejects.toThrow('The current password is incorrect');
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it('rotates refresh tokens transactionally', async () => {
    const rawToken = 'old-refresh-token';
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    database.refreshSession.findUnique.mockResolvedValue({
      id: sessionId,
      familyId,
      organizationId,
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
      rotatedAt: null,
      revokedAt: null,
      user,
    });
    const transaction = {
      refreshSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    database.$transaction.mockImplementation(
      async (callback: (tx: typeof transaction) => Promise<boolean>) =>
        callback(transaction),
    );
    jwt.verifyAsync.mockResolvedValue({
      tokenUse: 'refresh',
      sub: userId,
      organizationId,
      sessionId,
      familyId,
      version: 1,
    });

    const result = await service.refresh(rawToken);

    expect(transaction.refreshSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: sessionId,
          tokenHash,
          rotatedAt: null,
          revokedAt: null,
        }),
      }),
    );
    expect(transaction.refreshSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId,
          userId,
          familyId,
          tokenHash: createHash('sha256')
            .update('new-refresh-token')
            .digest('hex'),
        }),
      }),
    );
    expect(result.accessToken).toBe('new-access-token');
  });

  it('revokes the refresh family when a rotated token is reused', async () => {
    const rawToken = 'replayed-refresh-token';
    database.refreshSession.findUnique.mockResolvedValue({
      id: sessionId,
      familyId,
      organizationId,
      userId,
      tokenHash: createHash('sha256').update(rawToken).digest('hex'),
      expiresAt: new Date(Date.now() + 60_000),
      rotatedAt: new Date(),
      revokedAt: null,
      user,
    });
    database.refreshSession.updateMany.mockResolvedValue({ count: 1 });
    jwt.verifyAsync.mockResolvedValue({
      tokenUse: 'refresh',
      sub: userId,
      organizationId,
      sessionId,
      familyId,
      version: 1,
    });

    await expect(service.refresh(rawToken)).rejects.toThrow(
      'Refresh-token reuse detected',
    );
    expect(database.refreshSession.updateMany).toHaveBeenCalledWith({
      where: { organizationId, userId, familyId, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
