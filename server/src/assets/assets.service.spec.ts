import { jest } from '@jest/globals';
import { createHash } from 'node:crypto';
import {
  AssetHistoryEventType,
  AssetTrackingMode,
  AssetVerification,
  UserRole,
} from '../generated/prisma/enums.js';
import { Prisma } from '../generated/prisma/client.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { LocationsService } from '../locations/locations.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AssetsService } from './assets.service.js';

const organizationId = '40e9ce48-e66d-4bfc-a4ea-df85269a96c3';
const managerId = 'c0985b17-75bb-4a80-9763-35d673ec05f2';
const locationId = '27ae8d6f-3848-4528-9f31-ec585d08e9b5';
const destinationLocationId = '6c438b8e-e311-4fe9-89ac-9a7d61ab7e5b';
const categoryId = '9c73dc96-27d7-4e8d-ae3b-0af4e9e9a1f2';
const assetId = '8e626601-b894-4f2e-acac-85104a978eea';
const employeeId = '62cbad18-2387-4264-8cf1-83fd5b0d5eb1';
const transferId = 'c0d0e786-1bc0-4553-a2d7-9c2a442eb067';
const transferLineId = '5f920760-4bd0-45b0-a6ac-9084f3166300';
const administrator = {
  userId: managerId,
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

describe('AssetsService', () => {
  const assetManager = {
    userId: managerId,
    organizationId,
    sessionId: 'session-id',
    familyId: 'family-id',
    email: 'manager@example.com',
    displayName: 'Asset Manager',
    organizationName: 'Example Organization',
    role: UserRole.ASSET_MANAGER,
    mustChangePassword: false,
    version: 1,
  } satisfies AuthenticatedActor;

  const prisma = {
    assetCategory: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
    asset: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
    assetHistoryEvent: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    assetRelationship: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
    assetReservation: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
    assetAssignment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
    assetReturn: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    assetTransfer: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
    assetTransferLine: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
    componentInstallation: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
    employee: {
      findFirst: jest.fn(),
    },
    location: {
      findFirst: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  const locations = {
    getAccessibleLocationIds: jest.fn(),
  };
  let service: AssetsService;

  beforeEach(() => {
    jest.resetAllMocks();
    locations.getAccessibleLocationIds.mockResolvedValue([locationId]);
    prisma.componentInstallation.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(prisma),
    );
    service = new AssetsService(
      prisma as unknown as PrismaService,
      locations as unknown as LocationsService,
    );
  });

  it('scopes paginated searches to assigned locations and organization', async () => {
    prisma.asset.findMany.mockResolvedValue([]);
    prisma.asset.count.mockResolvedValue(0);

    const result = await service.list(assetManager, {
      page: 2,
      pageSize: 10,
      search: 'serial',
      serialNumberExact: '000123',
      condition: 'GOOD',
      verification: 'MISSING',
    });

    expect(result).toEqual({ items: [], page: 2, pageSize: 10, total: 0 });
    expect(prisma.asset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId,
          locationId: { in: [locationId] },
          condition: 'GOOD',
          verification: 'MISSING',
          serialNumber: '000123',
          AND: expect.arrayContaining([
            {
              OR: expect.arrayContaining([
                { serialNumber: { contains: 'serial', mode: 'insensitive' } },
              ]),
            },
          ]),
        }),
        skip: 10,
        take: 10,
      }),
    );
  });

  it('resolves exact scanned asset IDs within organization and location scope', async () => {
    prisma.asset.findMany.mockResolvedValue([]);
    prisma.asset.count.mockResolvedValue(0);

    await service.list(assetManager, {
      page: 1,
      pageSize: 1,
      assetIdExact: assetId,
    });

    expect(prisma.asset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId,
          locationId: { in: [locationId] },
          id: assetId,
        },
        skip: 0,
        take: 1,
      }),
    );
    expect(prisma.asset.count).toHaveBeenCalledWith({
      where: {
        organizationId,
        locationId: { in: [locationId] },
        id: assetId,
      },
    });
  });

  it('filters assets by an inclusive date-only warranty expiry range', async () => {
    prisma.asset.findMany.mockResolvedValue([]);
    prisma.asset.count.mockResolvedValue(0);

    await service.list(assetManager, {
      page: 1,
      pageSize: 20,
      warrantyExpiresOnFrom: '2026-01-01',
      warrantyExpiresOnTo: '2026-12-31',
    });

    expect(prisma.asset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId,
          locationId: { in: [locationId] },
          warrantyExpiresOn: {
            gte: new Date('2026-01-01T00:00:00.000Z'),
            lte: new Date('2026-12-31T00:00:00.000Z'),
          },
        }),
      }),
    );
  });

  it('rejects reversed warranty expiry ranges before querying assets', async () => {
    await expect(
      service.list(assetManager, {
        page: 1,
        pageSize: 20,
        warrantyExpiresOnFrom: '2026-12-31',
        warrantyExpiresOnTo: '2026-01-01',
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.asset.findMany).not.toHaveBeenCalled();
  });

  it('projects active reservations as RESERVED without overwriting asset state', async () => {
    prisma.asset.findMany.mockResolvedValue([
      { id: assetId, availability: 'AVAILABLE' },
    ]);
    prisma.asset.count.mockResolvedValue(1);
    prisma.assetReservation.findMany.mockResolvedValue([{ assetId }]);

    const result = await service.list(assetManager, {
      page: 1,
      pageSize: 20,
    });

    expect(result.items[0]?.availability).toBe('RESERVED');
    expect(prisma.asset.updateMany).not.toHaveBeenCalled();
  });

  it('creates a scoped verification snapshot excluding disposed assets', async () => {
    prisma.location.findFirst.mockResolvedValue({
      id: locationId,
      code: 'PUNE',
      name: 'Pune Office',
    });
    prisma.asset.findMany.mockResolvedValue([]);

    await expect(
      service.getVerificationSnapshot(
        prisma as unknown as Prisma.TransactionClient,
        assetManager,
        locationId,
      ),
    ).resolves.toEqual({
      location: { id: locationId, code: 'PUNE', name: 'Pune Office' },
      assets: [],
    });
    expect(prisma.asset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId,
          locationId,
          lifecycle: { not: 'DISPOSED' },
        },
        orderBy: [{ assetTag: 'asc' }, { id: 'asc' }],
      }),
    );
  });

  it('reconciles only verification state with the expected asset version', async () => {
    prisma.asset.updateMany.mockResolvedValue({ count: 1 });

    await service.reconcileVerification(
      prisma as unknown as Prisma.TransactionClient,
      assetManager,
      assetId,
      4,
      AssetVerification.MISSING,
      'campaign-id',
      'observation-id',
    );

    expect(prisma.asset.updateMany).toHaveBeenCalledWith({
      where: {
        id: assetId,
        organizationId,
        locationId: { in: [locationId] },
        version: 4,
      },
      data: {
        verification: AssetVerification.MISSING,
        version: { increment: 1 },
      },
    });
    expect(prisma.assetHistoryEvent.create).toHaveBeenCalledWith({
      data: {
        organizationId,
        assetId,
        actorUserId: managerId,
        eventType: AssetHistoryEventType.VERIFICATION_RECONCILED,
        details: {
          campaignId: 'campaign-id',
          observationId: 'observation-id',
          verification: AssetVerification.MISSING,
        },
      },
    });
  });

  it('resolves retirement targets within the Asset Manager location scope', async () => {
    prisma.asset.findFirst.mockResolvedValue({
      id: assetId,
      lifecycle: 'ACTIVE',
    });

    await expect(
      service.getRetirementTarget(
        prisma as unknown as Prisma.TransactionClient,
        assetManager,
        assetId,
      ),
    ).resolves.toMatchObject({ id: assetId, lifecycle: 'ACTIVE' });
    expect(prisma.asset.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: assetId,
          organizationId,
          locationId: { in: [locationId] },
        },
      }),
    );
  });

  it.each(['RETIRED', 'DISPOSED'])(
    'rejects retirement requests for assets already %s',
    async (lifecycle) => {
      prisma.asset.findFirst.mockResolvedValue({ id: assetId, lifecycle });

      await expect(
        service.getRetirementTarget(
          prisma as unknown as Prisma.TransactionClient,
          assetManager,
          assetId,
        ),
      ).rejects.toMatchObject({ status: 409 });
    },
  );

  it('records retirement request history without changing lifecycle or custody', async () => {
    await service.recordRetirementRequested(
      prisma as unknown as Prisma.TransactionClient,
      assetManager,
      assetId,
      'retirement-request-id',
    );

    expect(prisma.assetHistoryEvent.create).toHaveBeenCalledWith({
      data: {
        organizationId,
        assetId,
        actorUserId: managerId,
        eventType: AssetHistoryEventType.RETIREMENT_REQUESTED,
        details: { retirementRequestId: 'retirement-request-id' },
      },
    });
    expect(prisma.asset.updateMany).not.toHaveBeenCalled();
  });

  it('allows Administrators to view assets across their organization', async () => {
    locations.getAccessibleLocationIds.mockResolvedValue(null);
    prisma.asset.findMany.mockResolvedValue([]);
    prisma.asset.count.mockResolvedValue(0);

    await expect(
      service.list(administrator, { page: 1, pageSize: 20 }),
    ).resolves.toEqual({ items: [], page: 1, pageSize: 20, total: 0 });

    expect(prisma.asset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId },
        skip: 0,
        take: 20,
      }),
    );
    expect(prisma.asset.count).toHaveBeenCalledWith({
      where: { organizationId },
    });
  });

  it('allows Administrators to view asset details within their organization', async () => {
    locations.getAccessibleLocationIds.mockResolvedValue(null);
    prisma.asset.findFirst.mockResolvedValue({ id: assetId });

    await expect(service.get(administrator, assetId)).resolves.toEqual({
      id: assetId,
    });

    expect(prisma.asset.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: assetId, organizationId },
      }),
    );
  });

  it('returns asset history only after checking the actor resource scope', async () => {
    prisma.asset.findFirst.mockResolvedValue({ id: assetId });
    prisma.assetHistoryEvent.findMany.mockResolvedValue([
      { id: 'event-1', eventType: AssetHistoryEventType.REGISTERED },
    ]);

    await expect(service.history(assetManager, assetId)).resolves.toEqual([
      { id: 'event-1', eventType: AssetHistoryEventType.REGISTERED },
    ]);
    expect(prisma.asset.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: assetId,
          organizationId,
          locationId: { in: [locationId] },
        },
        select: { id: true },
      }),
    );
    expect(prisma.assetHistoryEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId, assetId },
      }),
    );
  });

  it('creates an idempotent parent-child relationship and records both timelines', async () => {
    prisma.asset.findMany.mockResolvedValue([
      { id: assetId },
      { id: categoryId },
    ]);
    prisma.assetRelationship.findFirst.mockResolvedValue(null);
    prisma.assetRelationship.findMany.mockResolvedValue([]);
    const relationship = {
      id: 'relationship-id',
      parentAssetId: assetId,
      childAssetId: categoryId,
    };
    prisma.assetRelationship.create.mockResolvedValue(relationship);

    await expect(
      service.addRelationship(assetManager, assetId, categoryId),
    ).resolves.toEqual(relationship);

    expect(prisma.assetRelationship.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          organizationId,
          parentAssetId: assetId,
          childAssetId: categoryId,
          createdByUserId: managerId,
        },
      }),
    );
    expect(prisma.assetHistoryEvent.create).toHaveBeenCalledTimes(2);
  });

  it('returns an existing active relationship on a retry', async () => {
    const relationship = { id: 'relationship-id' };
    prisma.asset.findMany.mockResolvedValue([
      { id: assetId },
      { id: categoryId },
    ]);
    prisma.assetRelationship.findFirst.mockResolvedValue(relationship);

    await expect(
      service.addRelationship(assetManager, assetId, categoryId),
    ).resolves.toEqual(relationship);
    expect(prisma.assetRelationship.create).not.toHaveBeenCalled();
  });

  it('lists relationships only when both linked assets are in location scope', async () => {
    prisma.asset.findFirst.mockResolvedValue({ id: assetId });
    prisma.assetRelationship.findMany.mockResolvedValue([]);

    await expect(service.relationships(assetManager, assetId)).resolves.toEqual(
      [],
    );

    expect(prisma.assetRelationship.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId,
          endedAt: null,
          OR: [
            {
              parentAssetId: assetId,
              childAsset: { locationId: { in: [locationId] } },
            },
            {
              childAssetId: assetId,
              parentAsset: { locationId: { in: [locationId] } },
            },
          ],
        },
      }),
    );
  });

  it('ends a relationship without deleting its record and records both timelines', async () => {
    const relationship = {
      id: 'relationship-id',
      parentAssetId: assetId,
      childAssetId: categoryId,
      endedAt: null,
    };
    prisma.assetRelationship.findFirst.mockResolvedValue(relationship);
    prisma.asset.findMany.mockResolvedValue([
      { id: assetId },
      { id: categoryId },
    ]);
    prisma.assetRelationship.updateMany.mockResolvedValue({ count: 1 });
    prisma.assetRelationship.findFirstOrThrow.mockResolvedValue({
      ...relationship,
      endedAt: new Date('2026-10-29T12:00:00.000Z'),
    });

    await expect(
      service.endRelationship(assetManager, assetId, relationship.id),
    ).resolves.toMatchObject({
      id: relationship.id,
      endedAt: expect.any(Date),
    });
    expect(prisma.assetRelationship.updateMany).toHaveBeenCalledWith({
      where: {
        id: relationship.id,
        organizationId,
        endedAt: null,
      },
      data: { endedAt: expect.any(Date), endedByUserId: managerId },
    });
    expect(prisma.assetHistoryEvent.create).toHaveBeenCalledTimes(2);
  });

  it('rejects self-links and cycles before writing relationships', async () => {
    await expect(
      service.addRelationship(assetManager, assetId, assetId),
    ).rejects.toThrow('An asset cannot be its own parent or child');
    expect(prisma.assetRelationship.create).not.toHaveBeenCalled();

    prisma.asset.findMany.mockResolvedValue([
      { id: assetId },
      { id: categoryId },
    ]);
    prisma.assetRelationship.findFirst.mockResolvedValue(null);
    prisma.assetRelationship.findMany.mockResolvedValue([
      { parentAssetId: categoryId, childAssetId: assetId },
    ]);

    await expect(
      service.addRelationship(assetManager, assetId, categoryId),
    ).rejects.toThrow('This parent-child relationship would create a cycle');
    expect(prisma.assetRelationship.create).not.toHaveBeenCalled();
  });

  it('records an installed component with scope, locking, and history', async () => {
    prisma.componentInstallation.findFirst.mockResolvedValue(null);
    prisma.asset.findMany.mockResolvedValue([
      {
        id: assetId,
        lifecycle: 'ACTIVE',
        availability: 'AVAILABLE',
      },
      {
        id: categoryId,
        lifecycle: 'ACTIVE',
        availability: 'AVAILABLE',
      },
    ]);
    prisma.assetReservation.findMany.mockResolvedValue([]);
    prisma.assetAssignment.findMany.mockResolvedValue([]);
    prisma.assetTransferLine.findMany.mockResolvedValue([]);
    prisma.assetRelationship.findFirst.mockResolvedValue(null);
    prisma.assetRelationship.findMany.mockResolvedValue([]);
    prisma.componentInstallation.create.mockResolvedValue({
      id: 'installation-id',
      hostAssetId: assetId,
      componentAssetId: categoryId,
    });

    await expect(
      service.installComponent(assetManager, assetId, 'install-key', {
        componentAssetId: categoryId,
        installNote: 'Installed during repair',
      }),
    ).resolves.toMatchObject({
      id: 'installation-id',
      hostAssetId: assetId,
      componentAssetId: categoryId,
    });
    expect(prisma.componentInstallation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId,
          hostAssetId: assetId,
          componentAssetId: categoryId,
          installedByUserId: managerId,
          installIdempotencyKey: 'install-key',
          installNote: 'Installed during repair',
        }),
      }),
    );
    expect(prisma.assetHistoryEvent.create).toHaveBeenCalledTimes(2);
    expect(prisma.assetHistoryEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: AssetHistoryEventType.COMPONENT_INSTALLED,
        }),
      }),
    );
  });

  it('rejects component installation that creates a cycle across equipment links', async () => {
    prisma.componentInstallation.findFirst.mockResolvedValue(null);
    prisma.asset.findMany.mockResolvedValue([
      { id: assetId, lifecycle: 'ACTIVE', availability: 'AVAILABLE' },
      { id: categoryId, lifecycle: 'ACTIVE', availability: 'AVAILABLE' },
    ]);
    prisma.assetReservation.findMany.mockResolvedValue([]);
    prisma.assetAssignment.findMany.mockResolvedValue([]);
    prisma.assetTransferLine.findMany.mockResolvedValue([]);
    prisma.assetRelationship.findFirst.mockResolvedValue(null);
    prisma.assetRelationship.findMany.mockResolvedValue([
      { parentAssetId: categoryId, childAssetId: assetId },
    ]);

    await expect(
      service.installComponent(assetManager, assetId, 'install-key', {
        componentAssetId: categoryId,
      }),
    ).rejects.toThrow('This parent-child relationship would create a cycle');
    expect(prisma.componentInstallation.create).not.toHaveBeenCalled();
  });

  it('removes components with a version check and preserves the installation record', async () => {
    const installation = {
      id: 'installation-id',
      organizationId,
      hostAssetId: assetId,
      componentAssetId: categoryId,
      installedByUserId: managerId,
      installedAt: new Date('2026-10-29T10:00:00.000Z'),
      installNote: null,
      removedByUserId: null,
      removedAt: null,
      removalNote: null,
      version: 1,
      createdAt: new Date('2026-10-29T10:00:00.000Z'),
      updatedAt: new Date('2026-10-29T10:00:00.000Z'),
      hostAsset: {
        id: assetId,
        location: { id: locationId },
      },
      componentAsset: {
        id: categoryId,
        location: { id: locationId },
      },
      installedBy: { displayName: 'Asset Manager' },
      removedBy: null,
      installIdempotencyKey: 'install-key',
      installPayloadHash: 'a'.repeat(64),
      removalIdempotencyKey: null,
      removalPayloadHash: null,
    };
    prisma.componentInstallation.findFirst.mockResolvedValue(installation);
    prisma.asset.findMany.mockResolvedValue([
      { id: assetId },
      { id: categoryId },
    ]);
    prisma.assetReservation.findMany.mockResolvedValue([]);
    prisma.assetAssignment.findMany.mockResolvedValue([]);
    prisma.assetTransferLine.findMany.mockResolvedValue([]);
    prisma.componentInstallation.updateMany.mockResolvedValue({ count: 1 });
    prisma.componentInstallation.findFirstOrThrow.mockResolvedValue({
      ...installation,
      removedAt: new Date('2026-10-29T11:00:00.000Z'),
      removedByUserId: managerId,
      removalNote: 'Replaced component',
      version: 2,
    });

    await expect(
      service.removeComponent(
        assetManager,
        assetId,
        installation.id,
        1,
        'remove-key',
        { removalNote: 'Replaced component' },
      ),
    ).resolves.toMatchObject({
      id: installation.id,
      removedByUserId: managerId,
      removalNote: 'Replaced component',
      version: 2,
    });
    expect(prisma.componentInstallation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: installation.id,
          version: 1,
          removedAt: null,
        }),
        data: expect.objectContaining({
          removedByUserId: managerId,
          removalIdempotencyKey: 'remove-key',
          version: { increment: 1 },
        }),
      }),
    );
    expect(prisma.assetHistoryEvent.create).toHaveBeenCalledTimes(2);
  });

  it('keeps Administrator asset access read-only', async () => {
    await expect(
      service.create(administrator, {
        assetTag: 'LAP-001',
        categoryId,
        locationId,
        availability: 'AVAILABLE',
        condition: 'GOOD',
      }),
    ).rejects.toThrow('Asset Manager access is required');
    await expect(
      service.updateProfile(administrator, assetId, 1, {
        manufacturer: '',
        model: '',
        serialNumber: '',
        sourceReference: '',
        notes: '',
      }),
    ).rejects.toThrow('Asset Manager access is required');
    expect(prisma.asset.create).not.toHaveBeenCalled();
    expect(prisma.asset.updateMany).not.toHaveBeenCalled();
  });

  it('paginates organization-scoped category lookups', async () => {
    prisma.assetCategory.findMany.mockResolvedValue([]);
    prisma.assetCategory.count.mockResolvedValue(0);

    const result = await service.listCategories(assetManager, {
      page: 2,
      pageSize: 10,
      search: 'laptop',
    });

    expect(result).toEqual({ items: [], page: 2, pageSize: 10, total: 0 });
    expect(prisma.assetCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId,
          isActive: true,
          OR: expect.arrayContaining([
            { name: { contains: 'laptop', mode: 'insensitive' } },
          ]),
        }),
        skip: 10,
        take: 10,
      }),
    );
  });

  it('lets only Administrators include inactive categories', async () => {
    await expect(
      service.listCategories(assetManager, {
        page: 1,
        pageSize: 20,
        includeInactive: true,
      }),
    ).rejects.toThrow('Administrator access is required');
    expect(prisma.assetCategory.findMany).not.toHaveBeenCalled();
  });

  it('reads active or inactive category detail within the organization', async () => {
    prisma.assetCategory.findFirst.mockResolvedValue({
      id: categoryId,
      isActive: false,
      version: 4,
    });

    await expect(
      service.getCategory(administrator, categoryId),
    ).resolves.toMatchObject({ isActive: false, version: 4 });
    expect(prisma.assetCategory.findFirst).toHaveBeenCalledWith({
      where: { id: categoryId, organizationId },
      select: expect.objectContaining({ version: true, isActive: true }),
    });
  });

  it('does not disclose category detail outside the organization', async () => {
    prisma.assetCategory.findFirst.mockResolvedValue(null);

    await expect(
      service.getCategory(administrator, categoryId),
    ).rejects.toThrow('Asset category not found');
  });

  it('lists inactive categories only within the Administrator organization', async () => {
    prisma.assetCategory.findMany.mockResolvedValue([]);
    prisma.assetCategory.count.mockResolvedValue(0);

    await service.listCategories(administrator, {
      page: 1,
      pageSize: 20,
      includeInactive: true,
    });

    expect(prisma.assetCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId },
      }),
    );
  });

  it('deactivates a category without deleting historical references', async () => {
    prisma.assetCategory.updateMany.mockResolvedValue({ count: 1 });
    prisma.assetCategory.findFirstOrThrow.mockResolvedValue({
      id: categoryId,
      isActive: false,
    });

    await expect(
      service.setCategoryActive(administrator, categoryId, false),
    ).resolves.toMatchObject({ id: categoryId, isActive: false });
    expect(prisma.assetCategory.updateMany).toHaveBeenCalledWith({
      where: { id: categoryId, organizationId },
      data: { isActive: false, version: { increment: 1 } },
    });
  });

  it('reactivates an existing category in the authenticated organization', async () => {
    prisma.assetCategory.updateMany.mockResolvedValue({ count: 1 });
    prisma.assetCategory.findFirstOrThrow.mockResolvedValue({
      id: categoryId,
      isActive: true,
    });

    await expect(
      service.setCategoryActive(administrator, categoryId, true),
    ).resolves.toMatchObject({ id: categoryId, isActive: true });
    expect(prisma.assetCategory.updateMany).toHaveBeenCalledWith({
      where: { id: categoryId, organizationId },
      data: { isActive: true, version: { increment: 1 } },
    });
  });

  it('does not disclose or update categories outside the organization', async () => {
    prisma.assetCategory.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.setCategoryActive(administrator, categoryId, false),
    ).rejects.toThrow('Asset category not found');
    expect(prisma.assetCategory.findFirstOrThrow).not.toHaveBeenCalled();
  });

  it('updates categories with an organization-scoped optimistic version check', async () => {
    prisma.assetCategory.findFirst.mockResolvedValue({ id: categoryId });
    prisma.assetCategory.updateMany.mockResolvedValue({ count: 1 });
    prisma.assetCategory.findFirstOrThrow.mockResolvedValue({
      id: categoryId,
      code: 'LAPTOP',
      name: 'Portable computer',
      version: 3,
    });

    await expect(
      service.updateCategory(administrator, categoryId, 2, {
        code: 'LAPTOP',
        name: 'Portable computer',
      }),
    ).resolves.toMatchObject({ version: 3 });
    expect(prisma.assetCategory.updateMany).toHaveBeenCalledWith({
      where: { id: categoryId, organizationId, version: 2 },
      data: {
        code: 'LAPTOP',
        name: 'Portable computer',
        version: { increment: 1 },
      },
    });
  });

  it('rejects stale category versions without returning a successful update', async () => {
    prisma.assetCategory.findFirst.mockResolvedValue({ id: categoryId });
    prisma.assetCategory.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.updateCategory(administrator, categoryId, 1, {
        code: 'LAPTOP',
        name: 'Portable computer',
      }),
    ).rejects.toThrow('changed since it was loaded');
    expect(prisma.assetCategory.findFirstOrThrow).not.toHaveBeenCalled();
  });

  it('rejects category code conflicts in the organization', async () => {
    prisma.assetCategory.findFirst.mockResolvedValue({ id: categoryId });
    const uniqueError = new Prisma.PrismaClientKnownRequestError(
      'unique constraint',
      {
        code: 'P2002',
        clientVersion: '7.10.1',
      },
    );
    prisma.assetCategory.updateMany.mockRejectedValue(uniqueError);

    await expect(
      service.updateCategory(administrator, categoryId, 1, {
        code: 'LAPTOP',
        name: 'Laptop',
      }),
    ).rejects.toThrow(
      'An asset category with this code already exists in the organization',
    );
  });

  it('reserves asset category creation for Administrators', async () => {
    await expect(
      service.createCategory(assetManager, {
        code: 'LAPTOP',
        name: 'Laptop',
      }),
    ).rejects.toThrow('Administrator access is required');
    expect(prisma.assetCategory.create).not.toHaveBeenCalled();
  });

  it('creates categories with an explicit tracking mode and defaults legacy callers to individual', async () => {
    prisma.assetCategory.create
      .mockResolvedValueOnce({
        id: categoryId,
        trackingMode: AssetTrackingMode.QUANTITY,
      })
      .mockResolvedValueOnce({
        id: categoryId,
        trackingMode: AssetTrackingMode.INDIVIDUAL,
      });

    await service.createCategory(administrator, {
      code: 'SPARES',
      name: 'Spare parts',
      trackingMode: AssetTrackingMode.QUANTITY,
    });
    await service.createCategory(administrator, {
      code: 'LAPTOP',
      name: 'Laptop',
    });

    expect(prisma.assetCategory.create.mock.calls[0]?.[0].data).toMatchObject({
      trackingMode: AssetTrackingMode.QUANTITY,
    });
    expect(prisma.assetCategory.create.mock.calls[1]?.[0].data).toMatchObject({
      trackingMode: AssetTrackingMode.INDIVIDUAL,
    });
  });

  it('does not disclose assets outside the assigned location scope', async () => {
    await expect(service.get(assetManager, assetId)).rejects.toThrow(
      'Asset not found',
    );
    expect(prisma.asset.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: assetId,
          organizationId,
          locationId: { in: [locationId] },
        },
      }),
    );
  });

  it('rejects a requested location outside the assigned scope', async () => {
    await expect(
      service.list(assetManager, {
        page: 1,
        pageSize: 20,
        locationId: 'f810bb6e-234b-4bb0-a695-3aeef7c031f6',
      }),
    ).rejects.toThrow('Location not found');
    expect(prisma.asset.findMany).not.toHaveBeenCalled();
  });

  it('rejects registration in an unassigned location before checking references', async () => {
    await expect(
      service.create(assetManager, {
        assetTag: 'LAP-001',
        categoryId,
        locationId: 'f810bb6e-234b-4bb0-a695-3aeef7c031f6',
        availability: 'AVAILABLE',
        condition: 'GOOD',
      }),
    ).rejects.toThrow('Location not found');
    expect(prisma.assetCategory.findFirst).not.toHaveBeenCalled();
    expect(prisma.asset.create).not.toHaveBeenCalled();
  });

  it('creates only received assets and derives organization and actor server-side', async () => {
    prisma.assetCategory.findFirst.mockResolvedValue({
      id: categoryId,
      trackingMode: 'INDIVIDUAL',
      specificationFields: [],
    });
    prisma.location.findFirst.mockResolvedValue({ id: locationId });
    prisma.asset.create.mockResolvedValue({ id: assetId });

    await service.create(assetManager, {
      assetTag: 'LAP-001',
      categoryId,
      locationId,
      availability: 'AVAILABLE',
      condition: 'GOOD',
    });

    expect(prisma.asset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId,
          createdByUserId: managerId,
          lifecycle: 'RECEIVED',
          availability: 'AVAILABLE',
          condition: 'GOOD',
          verification: 'NOT_CHECKED',
        }),
      }),
    );
    expect(prisma.assetHistoryEvent.create).toHaveBeenCalledWith({
      data: {
        organizationId,
        assetId,
        actorUserId: managerId,
        eventType: AssetHistoryEventType.REGISTERED,
        details: { source: 'direct_asset_registration' },
      },
    });
  });

  it('requires and persists category-specific specification values', async () => {
    prisma.assetCategory.findFirst.mockResolvedValue({
      id: categoryId,
      trackingMode: AssetTrackingMode.INDIVIDUAL,
      specificationFields: [{ key: 'RAM_GB', label: 'Memory', required: true }],
    });
    prisma.location.findFirst.mockResolvedValue({ id: locationId });
    prisma.asset.create.mockResolvedValue({ id: assetId });

    await expect(
      service.create(assetManager, {
        assetTag: 'LAP-100',
        categoryId,
        locationId,
        availability: 'AVAILABLE',
        condition: 'GOOD',
      }),
    ).rejects.toThrow('RAM_GB is required by the asset category');
    expect(prisma.asset.create).not.toHaveBeenCalled();

    await expect(
      service.create(assetManager, {
        assetTag: 'LAP-101',
        categoryId,
        locationId,
        availability: 'AVAILABLE',
        condition: 'GOOD',
        specifications: { RAM_GB: '16 GB' },
      }),
    ).resolves.toMatchObject({ id: assetId });
    expect(prisma.asset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          specifications: { RAM_GB: '16 GB' },
        }),
      }),
    );
  });

  it('prevents quantity categories from entering the individually tracked asset register', async () => {
    prisma.assetCategory.findFirst.mockResolvedValue({
      id: categoryId,
      trackingMode: AssetTrackingMode.QUANTITY,
    });
    prisma.location.findFirst.mockResolvedValue({ id: locationId });

    await expect(
      service.create(assetManager, {
        assetTag: 'SPARE-001',
        categoryId,
        locationId,
        availability: 'AVAILABLE',
        condition: 'GOOD',
      }),
    ).rejects.toThrow(
      'Quantity-tracked categories cannot be used for individually registered assets',
    );
    expect(prisma.asset.create).not.toHaveBeenCalled();
  });

  it('commissions a received asset using a version-checked command and records history', async () => {
    prisma.asset.findFirst.mockResolvedValue({
      id: assetId,
      lifecycle: 'RECEIVED',
    });
    prisma.asset.updateMany.mockResolvedValue({ count: 1 });
    const commissioned = {
      id: assetId,
      lifecycle: 'ACTIVE',
      commissioningDate: new Date('2026-10-29'),
      version: 3,
    };
    prisma.asset.findFirstOrThrow.mockResolvedValue(commissioned);

    await expect(
      service.commission(assetManager, assetId, 2, '2026-10-29'),
    ).resolves.toEqual(commissioned);

    expect(prisma.asset.updateMany).toHaveBeenCalledWith({
      where: {
        id: assetId,
        organizationId,
        locationId: { in: [locationId] },
        lifecycle: 'RECEIVED',
        version: 2,
      },
      data: {
        lifecycle: 'ACTIVE',
        commissioningDate: new Date('2026-10-29'),
        version: { increment: 1 },
      },
    });
    expect(prisma.assetHistoryEvent.create).toHaveBeenCalledWith({
      data: {
        organizationId,
        assetId,
        actorUserId: managerId,
        eventType: AssetHistoryEventType.COMMISSIONED,
        details: { commissioningDate: '2026-10-29' },
      },
    });
  });

  it('creates a scoped date-window reservation with an idempotency fingerprint', async () => {
    const reservation = {
      id: 'reservation-id',
      organizationId,
      assetId,
      employeeId,
      startDate: new Date('2099-01-01T00:00:00.000Z'),
      expiresOn: new Date('2099-01-02T00:00:00.000Z'),
      reason: 'New starter equipment',
      createdByUserId: managerId,
      cancelledByUserId: null,
      cancelledAt: null,
      version: 1,
      createdAt: new Date('2026-10-29T00:00:00.000Z'),
      updatedAt: new Date('2026-10-29T00:00:00.000Z'),
      asset: {
        id: assetId,
        assetTag: 'LAP-001',
        location: { id: locationId, code: 'HQ', name: 'HQ' },
        category: { id: categoryId, code: 'LAP', name: 'Laptop' },
      },
      employee: {
        id: employeeId,
        employeeNumber: '0001',
        displayName: 'Example Employee',
      },
    };
    prisma.asset.findFirst.mockResolvedValue({
      id: assetId,
      lifecycle: 'ACTIVE',
      availability: 'AVAILABLE',
    });
    prisma.assetReservation.findFirst.mockResolvedValue(null);
    prisma.employee.findFirst.mockResolvedValue({ id: employeeId });
    prisma.assetReservation.create.mockResolvedValue(reservation);

    const created = await service.createReservation(
      assetManager,
      'reservation-command-key',
      {
        assetId,
        employeeId,
        startDate: '2099-01-01',
        expiresOn: '2099-01-02',
        reason: 'New starter equipment',
      },
    );

    expect(created).toMatchObject({
      id: 'reservation-id',
      status: 'SCHEDULED',
      assetId,
      employeeId,
    });
    const createCall = prisma.assetReservation.create.mock.calls[0]?.[0];
    expect(createCall.data).toMatchObject({
      organizationId,
      assetId,
      employeeId,
      createdByUserId: managerId,
      idempotencyKey: 'reservation-command-key',
    });
    expect(createCall.data.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(prisma.assetHistoryEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: AssetHistoryEventType.RESERVATION_CREATED,
        }),
      }),
    );
  });

  it('replays a reservation only when its key and canonical payload match', async () => {
    const input = {
      assetId,
      employeeId,
      startDate: '2099-01-01',
      expiresOn: '2099-01-02',
      reason: 'New starter equipment',
    };
    const payloadHash = createHash('sha256')
      .update(
        JSON.stringify({
          organizationId,
          actorId: managerId,
          operation: 'asset-reservation.create',
          ...input,
        }),
      )
      .digest('hex');
    const reservation = {
      id: 'reservation-id',
      organizationId,
      ...input,
      startDate: new Date(`${input.startDate}T00:00:00.000Z`),
      expiresOn: new Date(`${input.expiresOn}T00:00:00.000Z`),
      createdByUserId: managerId,
      cancelledByUserId: null,
      cancelledAt: null,
      version: 1,
      createdAt: new Date('2026-10-29T00:00:00.000Z'),
      updatedAt: new Date('2026-10-29T00:00:00.000Z'),
      payloadHash,
      asset: {
        id: assetId,
        assetTag: 'LAP-001',
        location: { id: locationId, code: 'HQ', name: 'HQ' },
        category: { id: categoryId, code: 'LAP', name: 'Laptop' },
      },
      employee: {
        id: employeeId,
        employeeNumber: '0001',
        displayName: 'Example Employee',
      },
    };
    prisma.asset.findFirst.mockResolvedValue({
      id: assetId,
      lifecycle: 'ACTIVE',
      availability: 'AVAILABLE',
    });
    prisma.assetReservation.findFirst.mockResolvedValue(reservation);

    await expect(
      service.createReservation(assetManager, 'reservation-command-key', input),
    ).resolves.toMatchObject({ id: 'reservation-id', status: 'SCHEDULED' });
    expect(prisma.assetReservation.create).not.toHaveBeenCalled();

    await expect(
      service.createReservation(assetManager, 'reservation-command-key', {
        ...input,
        reason: 'Different request',
      }),
    ).rejects.toThrow(
      'This Idempotency-Key was already used with a different reservation request',
    );
    expect(prisma.assetReservation.create).not.toHaveBeenCalled();
  });

  it('rejects overlapping reservations without creating a second hold', async () => {
    prisma.asset.findFirst.mockResolvedValue({
      id: assetId,
      lifecycle: 'ACTIVE',
      availability: 'AVAILABLE',
    });
    prisma.assetReservation.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'existing-reservation' });
    prisma.employee.findFirst.mockResolvedValue({ id: employeeId });

    await expect(
      service.createReservation(assetManager, 'reservation-command-key', {
        assetId,
        employeeId,
        startDate: '2099-01-01',
        expiresOn: '2099-01-02',
        reason: 'New starter equipment',
      }),
    ).rejects.toThrow(
      'This asset already has a reservation that overlaps those dates',
    );
    expect(prisma.assetReservation.create).not.toHaveBeenCalled();
  });

  it('creates a location-scoped assignment and derives asset custody state', async () => {
    prisma.asset.findFirst.mockResolvedValue({
      id: assetId,
      lifecycle: 'ACTIVE',
      availability: 'AVAILABLE',
      condition: 'GOOD',
      version: 4,
    });
    prisma.assetReservation.findFirst.mockResolvedValue(null);
    prisma.assetAssignment.findFirst.mockResolvedValue(null);
    prisma.employee.findFirst.mockResolvedValue({ id: employeeId });
    prisma.asset.updateMany.mockResolvedValue({ count: 1 });
    const assignment = {
      id: 'assignment-id',
      organizationId,
      assetId,
      recipientType: 'EMPLOYEE',
      employeeId,
      recipientLabel: null,
      issuedByUserId: managerId,
      issuedAt: new Date('2026-10-29T12:00:00.000Z'),
      expectedReturnDate: null,
      conditionAtIssue: 'GOOD',
      accessoriesAtIssue: null,
      purpose: 'New starter equipment',
      acknowledgedAt: null,
      returnedAt: null,
      version: 1,
      createdAt: new Date('2026-10-29T12:00:00.000Z'),
      updatedAt: new Date('2026-10-29T12:00:00.000Z'),
      asset: {
        id: assetId,
        assetTag: 'LAP-001',
        location: { id: locationId, code: 'HQ', name: 'HQ' },
        category: { id: categoryId, code: 'LAP', name: 'Laptop' },
      },
      employee: {
        id: employeeId,
        employeeNumber: '0001',
        displayName: 'Example Employee',
      },
      returnRecord: null,
    };
    prisma.assetAssignment.create.mockResolvedValue(assignment);

    await expect(
      service.createAssignment(assetManager, 'assignment-key', {
        assetId,
        recipientType: 'EMPLOYEE',
        employeeId,
        conditionAtIssue: 'GOOD',
        purpose: 'New starter equipment',
      }),
    ).resolves.toMatchObject({ id: 'assignment-id', status: 'OPEN' });

    expect(prisma.asset.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId,
          id: assetId,
          version: 4,
          availability: 'AVAILABLE',
        }),
        data: expect.objectContaining({
          availability: 'ASSIGNED',
          condition: 'GOOD',
        }),
      }),
    );
    expect(prisma.assetHistoryEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: AssetHistoryEventType.ASSIGNED,
        }),
      }),
    );
  });

  it('returns an assignment and quarantines an asset requiring inspection', async () => {
    const assignment = {
      id: 'assignment-id',
      organizationId,
      assetId,
      recipientType: 'EMPLOYEE',
      employeeId,
      recipientLabel: null,
      issuedByUserId: managerId,
      issuedAt: new Date('2026-10-29T12:00:00.000Z'),
      expectedReturnDate: null,
      conditionAtIssue: 'GOOD',
      accessoriesAtIssue: null,
      purpose: 'New starter equipment',
      acknowledgedAt: null,
      returnedAt: null,
      version: 1,
      createdAt: new Date('2026-10-29T12:00:00.000Z'),
      updatedAt: new Date('2026-10-29T12:00:00.000Z'),
      asset: {
        id: assetId,
        version: 5,
        availability: 'ASSIGNED',
      },
      employee: {
        id: employeeId,
        employeeNumber: '0001',
        displayName: 'Example Employee',
      },
      returnRecord: null,
    };
    prisma.assetReturn.findFirst.mockResolvedValue(null);
    prisma.assetAssignment.findFirst.mockResolvedValue(assignment);
    prisma.asset.updateMany.mockResolvedValue({ count: 1 });
    prisma.assetAssignment.updateMany.mockResolvedValue({ count: 1 });
    prisma.assetAssignment.findFirstOrThrow.mockResolvedValue({
      ...assignment,
      returnedAt: new Date('2026-10-29T13:00:00.000Z'),
      version: 2,
      returnRecord: { conditionAtReturn: 'DAMAGED', inspectionRequired: true },
    });

    await expect(
      service.returnAssignment(assetManager, assignment.id, 1, 'return-key', {
        conditionAtReturn: 'DAMAGED',
        inspectionRequired: true,
      }),
    ).resolves.toMatchObject({
      id: assignment.id,
      status: 'RETURNED',
      returnRecord: { conditionAtReturn: 'DAMAGED', inspectionRequired: true },
    });
    expect(prisma.asset.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          availability: 'QUARANTINED',
          condition: 'DAMAGED',
        }),
      }),
    );
    expect(prisma.assetReturn.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId,
          assignmentId: assignment.id,
          receivedByUserId: managerId,
          idempotencyKey: 'return-key',
          inspectionRequired: true,
        }),
      }),
    );
  });

  it('does not re-commission an asset that has already left the received state', async () => {
    prisma.asset.findFirst.mockResolvedValue({
      id: assetId,
      lifecycle: 'ACTIVE',
    });

    await expect(
      service.commission(assetManager, assetId, 2, '2026-10-29'),
    ).rejects.toThrow('Only received assets can be commissioned');
    expect(prisma.asset.updateMany).not.toHaveBeenCalled();
    expect(prisma.assetHistoryEvent.create).not.toHaveBeenCalled();
  });

  it('rejects invalid initial availability and nonfunctional state combinations', async () => {
    await expect(
      service.create(assetManager, {
        assetTag: 'LAP-001',
        categoryId,
        locationId,
        availability: 'ASSIGNED',
        condition: 'GOOD',
      }),
    ).rejects.toThrow(
      'New assets must be received as available, quarantined, or unavailable',
    );
    await expect(
      service.create(assetManager, {
        assetTag: 'LAP-001',
        categoryId,
        locationId,
        availability: 'AVAILABLE',
        condition: 'NONFUNCTIONAL',
      }),
    ).rejects.toThrow(
      'A nonfunctional asset must be quarantined or unavailable when received',
    );
    expect(prisma.asset.create).not.toHaveBeenCalled();
  });

  it('rejects categories outside the authenticated organization', async () => {
    prisma.assetCategory.findFirst.mockResolvedValue(null);
    prisma.location.findFirst.mockResolvedValue({ id: locationId });

    await expect(
      service.create(assetManager, {
        assetTag: 'LAP-001',
        categoryId,
        locationId,
        availability: 'AVAILABLE',
        condition: 'GOOD',
      }),
    ).rejects.toThrow('Asset category not found');
    expect(prisma.asset.create).not.toHaveBeenCalled();
  });

  it('denies asset reads to roles without register access', async () => {
    await expect(
      service.list(
        { ...assetManager, role: UserRole.EMPLOYEE },
        { page: 1, pageSize: 20 },
      ),
    ).rejects.toThrow('Asset register access is not available to this role');
    expect(locations.getAccessibleLocationIds).not.toHaveBeenCalled();
  });

  const profile = {
    manufacturer: 'Manufacturer',
    model: 'Model',
    serialNumber: '000123',
    sourceReference: '',
    notes: 'Revised description',
  };

  it('conditionally updates only descriptive fields within organization and location scope', async () => {
    prisma.asset.findFirst.mockResolvedValue({ id: assetId });
    prisma.asset.updateMany.mockResolvedValue({ count: 1 });
    const updated = { id: assetId, ...profile, version: 3 };
    prisma.asset.findFirstOrThrow.mockResolvedValue(updated);

    await expect(
      service.updateProfile(assetManager, assetId, 2, profile),
    ).resolves.toEqual(updated);
    expect(prisma.asset.updateMany).toHaveBeenCalledWith({
      where: {
        id: assetId,
        organizationId,
        locationId: { in: [locationId] },
        version: 2,
      },
      data: { ...profile, sourceReference: null, version: { increment: 1 } },
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.asset.findFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: assetId,
          organizationId,
          locationId: { in: [locationId] },
        },
      }),
    );
    expect(prisma.assetHistoryEvent.create).toHaveBeenCalledWith({
      data: {
        organizationId,
        assetId,
        actorUserId: managerId,
        eventType: AssetHistoryEventType.PROFILE_UPDATED,
        details: {
          fields: [
            'manufacturer',
            'model',
            'serialNumber',
            'sourceReference',
            'notes',
          ],
        },
      },
    });
  });

  it('updates validated category-specific specification values and histories the field change', async () => {
    prisma.asset.findFirst.mockResolvedValue({
      id: assetId,
      ...profile,
      specifications: { RAM_GB: '8 GB' },
      category: {
        specificationFields: [
          { key: 'RAM_GB', label: 'Memory', required: true },
        ],
      },
    });
    prisma.asset.updateMany.mockResolvedValue({ count: 1 });
    prisma.asset.findFirstOrThrow.mockResolvedValue({
      id: assetId,
      ...profile,
      specifications: { RAM_GB: '16 GB' },
      version: 3,
    });

    await expect(
      service.updateProfile(assetManager, assetId, 2, {
        ...profile,
        specifications: { RAM_GB: '16 GB' },
      }),
    ).resolves.toMatchObject({ specifications: { RAM_GB: '16 GB' } });
    expect(prisma.asset.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          specifications: { RAM_GB: '16 GB' },
        }),
      }),
    );
    expect(prisma.assetHistoryEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          details: expect.objectContaining({
            fields: expect.arrayContaining(['specifications']),
          }),
        }),
      }),
    );
  });

  it('updates purchase and warranty details as validated date-only profile fields', async () => {
    prisma.asset.findFirst.mockResolvedValue({
      id: assetId,
      manufacturer: 'Manufacturer',
      model: null,
      serialNumber: '000123',
      sourceReference: null,
      notes: null,
      specifications: null,
      purchaseDate: null,
      warrantyExpiresOn: null,
      warrantyReference: null,
      category: { specificationFields: [] },
    });
    prisma.asset.updateMany.mockResolvedValue({ count: 1 });
    prisma.asset.findFirstOrThrow.mockResolvedValue({
      id: assetId,
      purchaseDate: new Date('2026-02-28T00:00:00.000Z'),
      warrantyExpiresOn: new Date('2029-02-28T00:00:00.000Z'),
      warrantyReference: 'WARRANTY-0001',
      version: 3,
    });

    await service.updateProfile(assetManager, assetId, 2, {
      ...profile,
      purchaseDate: '2026-02-28',
      warrantyExpiresOn: '2029-02-28',
      warrantyReference: 'WARRANTY-0001',
    });

    expect(prisma.asset.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          purchaseDate: new Date('2026-02-28T00:00:00.000Z'),
          warrantyExpiresOn: new Date('2029-02-28T00:00:00.000Z'),
          warrantyReference: 'WARRANTY-0001',
        }),
      }),
    );
    expect(prisma.assetHistoryEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          details: {
            fields: [
              'model',
              'notes',
              'purchaseDate',
              'warrantyExpiresOn',
              'warrantyReference',
            ],
          },
        }),
      }),
    );
  });

  it('rejects an impossible profile date before writing the asset', async () => {
    prisma.asset.findFirst.mockResolvedValue({
      id: assetId,
      purchaseDate: null,
      warrantyExpiresOn: null,
      warrantyReference: null,
      category: { specificationFields: [] },
    });

    await expect(
      service.updateProfile(assetManager, assetId, 2, {
        ...profile,
        purchaseDate: '2026-02-30',
      }),
    ).rejects.toMatchObject({ status: 422 });
    expect(prisma.asset.updateMany).not.toHaveBeenCalled();
  });

  it('returns 409 for a conditional write lost to a competing version without reading a success result', async () => {
    prisma.asset.findFirst.mockResolvedValue({ id: assetId });
    prisma.asset.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.updateProfile(assetManager, assetId, 2, profile),
    ).rejects.toMatchObject({ status: 409 });
    expect(prisma.asset.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.asset.findFirstOrThrow).not.toHaveBeenCalled();
  });

  it.each([
    ['another organization', [locationId]],
    ['an unassigned location', []],
  ])(
    'does not disclose or update an asset in %s',
    async (_label, accessibleLocationIds) => {
      locations.getAccessibleLocationIds.mockResolvedValue(
        accessibleLocationIds,
      );
      prisma.asset.findFirst.mockResolvedValue(null);

      await expect(
        service.updateProfile(assetManager, assetId, 1, profile),
      ).rejects.toMatchObject({ status: 404 });
      expect(prisma.asset.findFirst).toHaveBeenCalledWith({
        where: {
          id: assetId,
          organizationId,
          locationId: { in: accessibleLocationIds },
        },
        select: {
          id: true,
          manufacturer: true,
          model: true,
          serialNumber: true,
          sourceReference: true,
          notes: true,
          specifications: true,
          purchaseDate: true,
          warrantyExpiresOn: true,
          warrantyReference: true,
          category: { select: { specificationFields: true } },
        },
      });
      expect(prisma.asset.updateMany).not.toHaveBeenCalled();
    },
  );

  it('denies profile edits before scope lookup to roles without asset management access', async () => {
    await expect(
      service.updateProfile(
        { ...assetManager, role: UserRole.ADMINISTRATOR },
        assetId,
        1,
        profile,
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(locations.getAccessibleLocationIds).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('propagates a transaction failure instead of returning a successful update', async () => {
    prisma.asset.findFirst.mockResolvedValue({ id: assetId });
    prisma.asset.updateMany.mockResolvedValue({ count: 1 });
    prisma.asset.findFirstOrThrow.mockRejectedValue(new Error('Read failed'));

    await expect(
      service.updateProfile(assetManager, assetId, 1, profile),
    ).rejects.toThrow('Read failed');
  });

  it('creates a location-scoped transfer draft without moving the asset', async () => {
    locations.getAccessibleLocationIds.mockResolvedValue([
      locationId,
      destinationLocationId,
    ]);
    const transfer = {
      id: transferId,
      organizationId,
      sourceLocationId: locationId,
      destinationLocationId,
      status: 'DRAFT',
      version: 1,
      lines: [{ id: transferLineId, assetId, status: 'DRAFT' }],
    };
    prisma.assetTransfer.findFirst.mockResolvedValue(null);
    prisma.location.findFirst.mockResolvedValue({ id: destinationLocationId });
    prisma.asset.findMany.mockResolvedValue([
      {
        id: assetId,
        locationId,
        lifecycle: 'ACTIVE',
        availability: 'AVAILABLE',
        version: 3,
      },
    ]);
    prisma.assetReservation.findMany.mockResolvedValue([]);
    prisma.assetAssignment.findMany.mockResolvedValue([]);
    prisma.assetTransferLine.findMany.mockResolvedValue([]);
    prisma.assetTransfer.create.mockResolvedValue(transfer);

    await expect(
      service.createTransfer(assetManager, 'transfer-key', {
        destinationLocationId,
        assetIds: [assetId],
        reason: 'Move equipment to HQ',
      }),
    ).resolves.toMatchObject({ id: transferId, status: 'DRAFT' });

    expect(prisma.assetTransfer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId,
          sourceLocationId: locationId,
          destinationLocationId,
          idempotencyKey: 'transfer-key',
          lines: {
            create: [
              {
                organizationId,
                assetId,
                assetVersionAtCreate: 3,
              },
            ],
          },
        }),
      }),
    );
    expect(prisma.asset.updateMany).not.toHaveBeenCalled();
  });

  it('replays a transfer key only within the actor current location scope', async () => {
    locations.getAccessibleLocationIds.mockResolvedValue([
      locationId,
      destinationLocationId,
    ]);
    const input = {
      destinationLocationId,
      assetIds: [assetId],
      reason: 'Move equipment to HQ',
    };
    const payloadHash = createHash('sha256')
      .update(
        JSON.stringify({
          organizationId,
          actorId: managerId,
          operation: 'asset-transfer.create',
          destinationLocationId,
          assetIds: [assetId],
          reason: input.reason,
        }),
      )
      .digest('hex');
    const existing = {
      id: transferId,
      organizationId,
      sourceLocationId: locationId,
      destinationLocationId,
      status: 'DRAFT',
      version: 1,
      payloadHash,
      lines: [],
    };
    prisma.assetTransfer.findFirst.mockResolvedValue(existing);

    await expect(
      service.createTransfer(assetManager, 'transfer-key', input),
    ).resolves.toMatchObject({ id: transferId, status: 'DRAFT' });
    expect(prisma.assetTransfer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId,
          sourceLocationId: { in: [locationId, destinationLocationId] },
          destinationLocationId: { in: [locationId, destinationLocationId] },
        }),
      }),
    );
    expect(prisma.assetTransfer.create).not.toHaveBeenCalled();
  });

  it('dispatches all transfer assets atomically and records the post-dispatch version', async () => {
    const transfer = {
      id: transferId,
      organizationId,
      sourceLocationId: locationId,
      destinationLocationId,
      status: 'DRAFT',
      version: 1,
      lines: [
        {
          id: transferLineId,
          assetId,
          assetVersionAtCreate: 3,
          status: 'DRAFT',
        },
      ],
    };
    prisma.assetTransfer.findFirst.mockResolvedValue(transfer);
    prisma.asset.findMany.mockResolvedValue([{ id: assetId, version: 3 }]);
    prisma.asset.updateMany.mockResolvedValue({ count: 1 });
    prisma.assetTransferLine.updateMany.mockResolvedValue({ count: 1 });
    prisma.assetTransfer.updateMany.mockResolvedValue({ count: 1 });
    prisma.assetTransfer.findFirstOrThrow.mockResolvedValue({
      ...transfer,
      status: 'IN_TRANSIT',
      version: 2,
    });

    await expect(
      service.dispatchTransfer(assetManager, transferId, 1),
    ).resolves.toMatchObject({ status: 'IN_TRANSIT', version: 2 });
    expect(prisma.asset.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: assetId,
          locationId,
          version: 3,
          availability: 'AVAILABLE',
        }),
        data: expect.objectContaining({
          availability: 'IN_TRANSIT',
          version: { increment: 1 },
        }),
      }),
    );
    expect(prisma.assetTransferLine.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'IN_TRANSIT',
          assetVersionAtDispatch: 4,
        }),
      }),
    );
  });

  it('records partial transfer receipt and moves only a received asset', async () => {
    locations.getAccessibleLocationIds.mockResolvedValue([
      locationId,
      destinationLocationId,
    ]);
    prisma.assetTransferLine.findFirst.mockResolvedValue({
      id: transferLineId,
      assetId,
      assetVersionAtDispatch: 4,
      status: 'IN_TRANSIT',
      version: 2,
      receiptIdempotencyKey: null,
      receiptPayloadHash: null,
      transfer: {
        id: transferId,
        status: 'IN_TRANSIT',
        version: 2,
        sourceLocationId: locationId,
        destinationLocationId,
      },
    });
    prisma.asset.updateMany.mockResolvedValue({ count: 1 });
    prisma.assetTransferLine.updateMany.mockResolvedValue({ count: 1 });
    prisma.assetTransferLine.findMany.mockResolvedValue([
      { status: 'RECEIVED' },
      { status: 'IN_TRANSIT' },
    ]);
    prisma.assetTransfer.updateMany.mockResolvedValue({ count: 1 });
    prisma.assetTransfer.findFirstOrThrow.mockResolvedValue({
      id: transferId,
      status: 'PARTIALLY_RECEIVED',
      version: 3,
    });

    await expect(
      service.receiveTransferLine(
        assetManager,
        transferId,
        transferLineId,
        2,
        'receipt-key',
        {
          result: 'RECEIVED',
          conditionAtReceipt: 'GOOD',
          inspectionRequired: false,
        },
      ),
    ).resolves.toMatchObject({ status: 'PARTIALLY_RECEIVED' });

    expect(prisma.asset.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: assetId,
          locationId,
          version: 4,
          availability: 'IN_TRANSIT',
        }),
        data: expect.objectContaining({
          locationId: destinationLocationId,
          availability: 'AVAILABLE',
        }),
      }),
    );
    expect(prisma.assetTransfer.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PARTIALLY_RECEIVED',
        }),
      }),
    );
  });

  it('does not reconcile missing transfer assets without an approved recovery workflow', async () => {
    locations.getAccessibleLocationIds.mockResolvedValue([
      locationId,
      destinationLocationId,
    ]);
    prisma.assetTransferLine.findFirst.mockResolvedValue({
      id: transferLineId,
      assetId,
      assetVersionAtDispatch: 4,
      status: 'MISSING',
      version: 3,
      receiptIdempotencyKey: 'missing-key',
      receiptPayloadHash: 'a'.repeat(64),
      transfer: {
        id: transferId,
        status: 'PARTIALLY_RECEIVED',
        version: 3,
        sourceLocationId: locationId,
        destinationLocationId,
      },
    });

    await expect(
      service.receiveTransferLine(
        assetManager,
        transferId,
        transferLineId,
        3,
        'new-receipt-key',
        {
          result: 'RECEIVED',
          conditionAtReceipt: 'GOOD',
          inspectionRequired: false,
        },
      ),
    ).rejects.toThrow(
      'Discrepancy reconciliation requires an approved recovery workflow',
    );
    expect(prisma.asset.updateMany).not.toHaveBeenCalled();
  });

  it('cancels only version-matched transfer drafts and releases their asset lines', async () => {
    locations.getAccessibleLocationIds.mockResolvedValue([
      locationId,
      destinationLocationId,
    ]);
    prisma.assetTransfer.findFirst.mockResolvedValue({
      id: transferId,
      organizationId,
      sourceLocationId: locationId,
      destinationLocationId,
      status: 'DRAFT',
      version: 1,
      lines: [{ id: transferLineId, status: 'DRAFT' }],
    });
    prisma.assetTransferLine.updateMany.mockResolvedValue({ count: 1 });
    prisma.assetTransfer.updateMany.mockResolvedValue({ count: 1 });
    prisma.assetTransfer.findFirstOrThrow.mockResolvedValue({
      id: transferId,
      status: 'CANCELLED',
      version: 2,
    });

    await expect(
      service.cancelTransfer(assetManager, transferId, 1),
    ).resolves.toMatchObject({ status: 'CANCELLED', version: 2 });
    expect(prisma.assetTransferLine.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          transferId,
          status: 'DRAFT',
        }),
        data: expect.objectContaining({
          status: 'CANCELLED',
          version: { increment: 1 },
        }),
      }),
    );
    expect(prisma.asset.updateMany).not.toHaveBeenCalled();
  });
});
