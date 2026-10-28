import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { PrismaClient } from '../generated/prisma/client.js';
import { UserRole } from '../generated/prisma/enums.js';

export function validateSeedTarget(env: NodeJS.ProcessEnv): string {
  if (env.NODE_ENV !== 'development') {
    throw new Error('Example data requires NODE_ENV=development');
  }
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const url = new URL(env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('DATABASE_URL must use PostgreSQL');
  }
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!database || env.CONFIRM_SEED_DATABASE !== database) {
    throw new Error(
      'Set CONFIRM_SEED_DATABASE to the exact database name to confirm a disposable development target',
    );
  }
  return database;
}

export async function seedDevelopmentData(prisma: PrismaClient) {
  const organizationId = randomUUID();
  const users = [
    {
      email: 'admin@example.test',
      displayName: 'Example Administrator',
      role: UserRole.ADMINISTRATOR,
    },
    {
      email: 'assets@example.test',
      displayName: 'Example Asset Manager',
      role: UserRole.ASSET_MANAGER,
    },
    {
      email: 'finance@example.test',
      displayName: 'Example Procurement',
      role: UserRole.PROCUREMENT_FINANCE,
    },
  ].map((user) => ({
    ...user,
    id: randomUUID(),
    temporaryPassword: randomBytes(18).toString('base64url'),
  }));
  const preparedUsers = await Promise.all(
    users.map(async ({ temporaryPassword, ...user }) => ({
      ...user,
      organizationId,
      passwordHash: await bcrypt.hash(temporaryPassword, 12),
      mustChangePassword: true,
    })),
  );
  const administrator = preparedUsers[0]!;
  const assetManager = preparedUsers[1]!;

  await prisma.$transaction(
    async (tx) => {
      const [organizations, accounts] = await Promise.all([
        tx.organization.count(),
        tx.user.count(),
      ]);
      if (organizations !== 0 || accounts !== 0) {
        throw new Error(
          'Example seed requires an empty database; existing accounts and permissions will not be overwritten',
        );
      }
      await tx.organization.create({
        data: { id: organizationId, name: 'Example IT Organization' },
      });
      for (const user of preparedUsers) await tx.user.create({ data: user });

      const headquarters = await tx.location.create({
        data: { organizationId, code: 'HQ', name: 'Headquarters' },
      });
      const itRoom = await tx.location.create({
        data: {
          organizationId,
          parentLocationId: headquarters.id,
          code: 'HQ-IT',
          name: 'IT Equipment Room',
        },
      });
      await tx.store.create({
        data: {
          organizationId,
          locationId: itRoom.id,
          code: 'IT-STORE',
          name: 'IT Equipment Store',
        },
      });
      for (const user of preparedUsers.slice(1)) {
        await tx.userLocationScope.create({
          data: {
            organizationId,
            userId: user.id,
            locationId: headquarters.id,
            assignedByUserId: administrator.id,
          },
        });
      }
      const laptopCategory = await tx.assetCategory.create({
        data: { organizationId, code: 'LAPTOP', name: 'Laptops' },
      });
      const networkCategory = await tx.assetCategory.create({
        data: { organizationId, code: 'NETWORK', name: 'Network Equipment' },
      });
      await tx.asset.createMany({
        data: [
          {
            organizationId,
            assetTag: 'EX-LAP-001',
            categoryId: laptopCategory.id,
            locationId: itRoom.id,
            manufacturer: 'Example Manufacturer',
            model: 'Example Laptop',
            serialNumber: '000001',
            lifecycle: 'RECEIVED',
            availability: 'AVAILABLE',
            condition: 'NEW',
            verification: 'NOT_CHECKED',
            createdByUserId: assetManager.id,
            notes:
              'Synthetic development example; no receipt or custody record.',
          },
          {
            organizationId,
            assetTag: 'EX-NET-001',
            categoryId: networkCategory.id,
            locationId: itRoom.id,
            manufacturer: 'Example Manufacturer',
            model: 'Example Switch',
            serialNumber: '000002',
            lifecycle: 'RECEIVED',
            availability: 'QUARANTINED',
            condition: 'NONFUNCTIONAL',
            verification: 'NOT_CHECKED',
            createdByUserId: assetManager.id,
            notes: 'Synthetic development example awaiting inspection.',
          },
        ],
      });
    },
    { isolationLevel: 'Serializable', timeout: 30_000 },
  );

  return {
    organizationId,
    organizationName: 'Example IT Organization',
    users: users.map(({ email, role, temporaryPassword }) => ({
      email,
      role,
      temporaryPassword,
    })),
  };
}
