import { jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { seedDevelopmentData, validateSeedTarget } from './seed-data.js';

describe('Development seed', () => {
  const env = {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://localhost/asset_erp_dev',
    CONFIRM_SEED_DATABASE: 'asset_erp_dev',
  };

  it('requires explicit development and exact database confirmation', () => {
    expect(validateSeedTarget(env)).toBe('asset_erp_dev');
    for (const invalid of [
      { ...env, NODE_ENV: 'production' },
      { ...env, NODE_ENV: undefined },
      { ...env, CONFIRM_SEED_DATABASE: undefined },
      { ...env, CONFIRM_SEED_DATABASE: 'another_database' },
      { ...env, DATABASE_URL: 'https://localhost/asset_erp_dev' },
      { ...env, DATABASE_URL: undefined },
    ]) {
      expect(() => validateSeedTarget(invalid)).toThrow();
    }
  });

  function database(organizations = 0, accounts = 0) {
    const tx = {
      organization: {
        count: jest.fn(async () => organizations),
        create: jest.fn(async () => ({})),
      },
      user: {
        count: jest.fn(async () => accounts),
        create: jest.fn(async (_args: Prisma.UserCreateArgs) => ({})),
      },
      location: { create: jest.fn(async () => ({ id: 'location' })) },
      store: { create: jest.fn(async () => ({})) },
      userLocationScope: { create: jest.fn(async () => ({})) },
      assetCategory: { create: jest.fn(async () => ({ id: 'category' })) },
      asset: { createMany: jest.fn(async () => ({ count: 2 })) },
    };
    const prisma = {
      $transaction: jest.fn(
        async (callback: (transaction: typeof tx) => Promise<void>) =>
          callback(tx),
      ),
    };
    return {
      tx,
      prisma: prisma as unknown as PrismaClient,
      transaction: prisma.$transaction,
    };
  }

  it.each([
    [1, 0],
    [0, 1],
  ])(
    'refuses existing organizations/users (%i, %i) without writes',
    async (organizations, accounts) => {
      const { prisma, tx } = database(organizations, accounts);
      await expect(seedDevelopmentData(prisma)).rejects.toThrow(
        'empty database',
      );
      expect(tx.organization.create).not.toHaveBeenCalled();
      expect(tx.user.create).not.toHaveBeenCalled();
    },
  );

  it('creates scoped sample data with hashed, unique forced-change passwords', async () => {
    const { prisma, tx, transaction } = database();
    const result = await seedDevelopmentData(prisma);
    expect(result.users.map(({ email }) => email)).toEqual([
      'admin@example.test',
      'assets@example.test',
      'finance@example.test',
    ]);
    expect(
      new Set(result.users.map(({ temporaryPassword }) => temporaryPassword))
        .size,
    ).toBe(3);
    for (const [index, account] of result.users.entries()) {
      const saved = tx.user.create.mock.calls[index]![0];
      expect(saved.data.organizationId).toBe(result.organizationId);
      expect(saved.data.mustChangePassword).toBe(true);
      expect(
        await bcrypt.compare(
          account.temporaryPassword,
          saved.data.passwordHash,
        ),
      ).toBe(true);
      expect(saved.data).not.toHaveProperty('temporaryPassword');
    }
    expect(tx.userLocationScope.create).toHaveBeenCalledTimes(2);
    expect(tx.asset.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          lifecycle: 'RECEIVED',
          availability: 'AVAILABLE',
        }),
        expect.objectContaining({
          lifecycle: 'RECEIVED',
          availability: 'QUARANTINED',
          condition: 'NONFUNCTIONAL',
        }),
      ]),
    });
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
      timeout: 30_000,
    });
  });
});
