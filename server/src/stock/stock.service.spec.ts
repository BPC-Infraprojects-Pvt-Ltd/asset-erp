import { jest } from '@jest/globals';
import { createHash } from 'node:crypto';
import { UserRole } from '../generated/prisma/enums.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { LocationsService } from '../locations/locations.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StockService } from './stock.service.js';

const organizationId = '40e9ce48-e66d-4bfc-a4ea-df85269a96c3';
const managerId = 'c0985b17-75bb-4a80-9763-35d673ec05f2';
const categoryId = '9c73dc96-27d7-4e8d-ae3b-0af4e9e9a1f2';
const stockItemId = '8e626601-b894-4f2e-acac-85104a978eea';
const locationId = '27ae8d6f-3848-4528-9f31-ec585d08e9b5';
const sourceStoreId = '1c63e385-5887-447a-b0ad-418a3f428d09';
const destinationStoreId = '6c438b8e-e311-4fe9-89ac-9a7d61ab7e5b';

const assetManager = {
  userId: managerId,
  organizationId,
  sessionId: 'session-id',
  familyId: 'family-id',
  email: 'manager@example.test',
  displayName: 'Asset Manager',
  organizationName: 'Example Organization',
  role: UserRole.ASSET_MANAGER,
  mustChangePassword: false,
  version: 1,
} satisfies AuthenticatedActor;

describe('StockService', () => {
  const prisma = {
    assetCategory: { findFirst: jest.fn() },
    stockItem: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    stockMovement: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    stockReservation: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      aggregate: jest.fn(),
      updateMany: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
    store: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  const locations = { getAccessibleLocationIds: jest.fn() };
  let service: StockService;

  beforeEach(() => {
    jest.resetAllMocks();
    locations.getAccessibleLocationIds.mockResolvedValue([locationId]);
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(prisma),
    );
    service = new StockService(
      prisma as unknown as PrismaService,
      locations as unknown as LocationsService,
    );
  });

  it('derives each store balance from movements minus active reservations', async () => {
    prisma.store.findMany.mockResolvedValue([
      {
        id: sourceStoreId,
        code: 'PUNE-IT',
        name: 'Pune IT Store',
        locationId,
        location: { code: 'PUNE', name: 'Pune HQ' },
      },
    ]);
    prisma.stockItem.findMany.mockResolvedValue([
      {
        id: stockItemId,
        code: 'USB-ADAPTER',
        name: 'USB-C power adapter',
        category: {
          id: categoryId,
          code: 'SPARES',
          name: 'Spare parts',
          trackingMode: 'QUANTITY',
        },
      },
    ]);
    prisma.stockItem.count.mockResolvedValue(1);
    prisma.stockMovement.findMany.mockResolvedValue([
      {
        stockItemId,
        sourceStoreId: null,
        destinationStoreId: sourceStoreId,
        quantity: 10,
      },
      {
        stockItemId,
        sourceStoreId,
        destinationStoreId: null,
        quantity: 3,
      },
    ]);
    prisma.stockReservation.findMany.mockResolvedValue([
      { stockItemId, storeId: sourceStoreId, quantity: 2 },
    ]);

    await expect(
      service.listItems(assetManager, { page: 1, pageSize: 20 }),
    ).resolves.toMatchObject({
      items: [
        {
          unitLabel: 'units',
          balances: [
            {
              onHand: 7,
              reserved: 2,
              available: 5,
            },
          ],
        },
      ],
      total: 1,
    });
  });

  it('creates stock items only under active quantity-tracked categories', async () => {
    prisma.assetCategory.findFirst.mockResolvedValue({ id: categoryId });
    prisma.stockItem.create.mockResolvedValue({
      id: stockItemId,
      code: 'USB-ADAPTER',
      name: 'USB-C power adapter',
      category: { trackingMode: 'QUANTITY' },
    });

    await expect(
      service.createItem(assetManager, {
        categoryId,
        code: 'USB-ADAPTER',
        name: 'USB-C power adapter',
      }),
    ).resolves.toMatchObject({ id: stockItemId });
    expect(prisma.assetCategory.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId,
          trackingMode: 'QUANTITY',
          isActive: true,
        }),
      }),
    );
  });

  it('prevents issues from consuming reserved whole units', async () => {
    prisma.stockMovement.findFirst.mockResolvedValue(null);
    prisma.stockItem.findFirst.mockResolvedValue({ id: stockItemId });
    prisma.store.findMany.mockResolvedValue([{ id: sourceStoreId }]);
    prisma.stockMovement.findMany.mockResolvedValue([
      {
        sourceStoreId: null,
        destinationStoreId: sourceStoreId,
        quantity: 5,
      },
    ]);
    prisma.stockReservation.aggregate.mockResolvedValue({
      _sum: { quantity: 4 },
    });

    await expect(
      service.createMovement(assetManager, stockItemId, 'issue-key', {
        movementType: 'ISSUE',
        sourceStoreId,
        quantity: 2,
        reason: 'Issue for support desk',
      }),
    ).rejects.toThrow(
      'Only 1 unreserved units are available at the source store',
    );
    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
  });

  it('records a store transfer as one idempotent ledger movement', async () => {
    prisma.stockMovement.findFirst.mockResolvedValue(null);
    prisma.stockItem.findFirst.mockResolvedValue({ id: stockItemId });
    prisma.store.findMany.mockResolvedValue([
      { id: sourceStoreId },
      { id: destinationStoreId },
    ]);
    prisma.stockMovement.findMany.mockResolvedValue([
      {
        sourceStoreId: null,
        destinationStoreId: sourceStoreId,
        quantity: 8,
      },
    ]);
    prisma.stockReservation.aggregate.mockResolvedValue({
      _sum: { quantity: 1 },
    });
    prisma.stockMovement.create.mockResolvedValue({
      id: 'movement-id',
      movementType: 'TRANSFER',
      quantity: 3,
    });

    await expect(
      service.createMovement(assetManager, stockItemId, 'transfer-key', {
        movementType: 'TRANSFER',
        sourceStoreId,
        destinationStoreId,
        quantity: 3,
        reason: 'Move spares to branch store',
      }),
    ).resolves.toMatchObject({ movementType: 'TRANSFER', quantity: 3 });
    expect(prisma.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId,
          stockItemId,
          movementType: 'TRANSFER',
          sourceStoreId,
          destinationStoreId,
          quantity: 3,
          idempotencyKey: 'transfer-key',
        }),
      }),
    );
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('replays a stock movement only when its key, payload, and store scope match', async () => {
    const input = {
      movementType: 'RECEIPT' as const,
      destinationStoreId: sourceStoreId,
      quantity: 3,
      reason: 'Opening count',
    };
    const payloadHash = createHash('sha256')
      .update(
        JSON.stringify({
          organizationId,
          actorId: managerId,
          operation: 'stock.movement.create',
          stockItemId,
          movementType: input.movementType,
          sourceStoreId: null,
          destinationStoreId: sourceStoreId,
          quantity: input.quantity,
          reason: input.reason,
          sourceReference: null,
        }),
      )
      .digest('hex');
    const existing = {
      id: 'movement-id',
      stockItemId,
      movementType: 'RECEIPT',
      sourceStoreId: null,
      destinationStoreId: sourceStoreId,
      quantity: 3,
      idempotencyKey: 'receipt-key',
      payloadHash,
    };
    prisma.stockMovement.findFirst.mockResolvedValue(existing);
    prisma.store.findMany.mockResolvedValue([{ id: sourceStoreId }]);

    await expect(
      service.createMovement(assetManager, stockItemId, 'receipt-key', input),
    ).resolves.toMatchObject({ id: 'movement-id', quantity: 3 });
    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
    expect(prisma.stockItem.findFirst).not.toHaveBeenCalled();
  });

  it('rejects reservations above the derived unreserved balance', async () => {
    prisma.stockReservation.findFirst.mockResolvedValue(null);
    prisma.stockItem.findFirst.mockResolvedValue({ id: stockItemId });
    prisma.store.findFirst.mockResolvedValue({ id: sourceStoreId });
    prisma.stockMovement.findMany.mockResolvedValue([
      {
        sourceStoreId: null,
        destinationStoreId: sourceStoreId,
        quantity: 6,
      },
    ]);
    prisma.stockReservation.aggregate.mockResolvedValue({
      _sum: { quantity: 2 },
    });

    await expect(
      service.createReservation(assetManager, 'reserve-key', {
        stockItemId,
        storeId: sourceStoreId,
        quantity: 5,
        reason: 'Reserve for field team',
      }),
    ).rejects.toThrow('Only 4 unreserved units are available to reserve');
    expect(prisma.stockReservation.create).not.toHaveBeenCalled();
  });

  it('denies stock access to roles outside Asset Manager without querying data', async () => {
    await expect(
      service.listItems(
        { ...assetManager, role: UserRole.ADMINISTRATOR },
        { page: 1, pageSize: 20 },
      ),
    ).rejects.toThrow('Stock operations are available to Asset Managers only');
    expect(locations.getAccessibleLocationIds).not.toHaveBeenCalled();
    expect(prisma.stockItem.findMany).not.toHaveBeenCalled();
  });

  it('keeps explicit store filters inside the authorized movement scope', async () => {
    const inaccessibleStoreId = '95e010c9-271c-47e3-bb75-ed8f1577f482';
    prisma.store.findMany.mockResolvedValue([{ id: sourceStoreId }]);
    prisma.stockMovement.findMany.mockResolvedValue([]);
    prisma.stockMovement.count.mockResolvedValue(0);

    await service.listMovements(assetManager, {
      page: 1,
      pageSize: 20,
      storeId: inaccessibleStoreId,
    });

    expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId,
          AND: expect.arrayContaining([
            {
              OR: [
                { sourceStoreId: { in: [sourceStoreId] } },
                { destinationStoreId: { in: [sourceStoreId] } },
              ],
            },
            {
              OR: [
                { sourceStoreId: inaccessibleStoreId },
                { destinationStoreId: inaccessibleStoreId },
              ],
            },
          ]),
        }),
      }),
    );
  });
});
