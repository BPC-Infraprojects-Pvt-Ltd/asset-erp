import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import {
  AssetTrackingMode,
  StockMovementType,
  UserRole,
} from '../generated/prisma/enums.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { LocationsService } from '../locations/locations.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateStockItemDto } from './dto/create-stock-item.dto.js';
import type { CreateStockMovementDto } from './dto/create-stock-movement.dto.js';
import type { CreateStockReservationDto } from './dto/create-stock-reservation.dto.js';
import type {
  ListStockItemsQueryDto,
  ListStockMovementsQueryDto,
  ListStockReservationsQueryDto,
} from './dto/stock-queries.dto.js';

const stockItemSelect = {
  id: true,
  organizationId: true,
  categoryId: true,
  code: true,
  name: true,
  description: true,
  createdByUserId: true,
  isActive: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: { id: true, code: true, name: true, trackingMode: true },
  },
} satisfies Prisma.StockItemSelect;

const stockMovementSelect = {
  id: true,
  organizationId: true,
  stockItemId: true,
  movementType: true,
  sourceStoreId: true,
  destinationStoreId: true,
  quantity: true,
  reason: true,
  sourceReference: true,
  createdByUserId: true,
  createdAt: true,
  stockItem: { select: stockItemSelect },
  sourceStore: {
    select: {
      id: true,
      code: true,
      name: true,
      location: { select: { id: true, code: true, name: true } },
    },
  },
  destinationStore: {
    select: {
      id: true,
      code: true,
      name: true,
      location: { select: { id: true, code: true, name: true } },
    },
  },
  createdBy: { select: { id: true, displayName: true } },
} satisfies Prisma.StockMovementSelect;

const stockMovementIdempotencySelect = {
  ...stockMovementSelect,
  idempotencyKey: true,
  payloadHash: true,
} satisfies Prisma.StockMovementSelect;

const stockReservationSelect = {
  id: true,
  organizationId: true,
  stockItemId: true,
  storeId: true,
  quantity: true,
  reason: true,
  createdByUserId: true,
  cancelledByUserId: true,
  cancelledAt: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  stockItem: { select: stockItemSelect },
  store: {
    select: {
      id: true,
      code: true,
      name: true,
      location: { select: { id: true, code: true, name: true } },
    },
  },
} satisfies Prisma.StockReservationSelect;

const stockReservationIdempotencySelect = {
  ...stockReservationSelect,
  idempotencyKey: true,
  payloadHash: true,
} satisfies Prisma.StockReservationSelect;

function stockReservationResponse<T extends { cancelledAt: Date | null }>(
  reservation: T,
) {
  return {
    ...reservation,
    status: reservation.cancelledAt ? 'CANCELLED' : 'ACTIVE',
  };
}

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locations: LocationsService,
  ) {}

  async listItems(actor: AuthenticatedActor, query: ListStockItemsQueryDto) {
    this.requireManager(actor);
    const accessibleLocationIds =
      (await this.locations.getAccessibleLocationIds(actor)) ?? [];
    const stores = await this.prisma.store.findMany({
      where: {
        organizationId: actor.organizationId,
        locationId: { in: accessibleLocationIds },
      },
      select: {
        id: true,
        code: true,
        name: true,
        locationId: true,
        location: { select: { code: true, name: true } },
      },
      orderBy: [{ code: 'asc' }, { id: 'asc' }],
    });
    const storeIds = stores.map((store) => store.id);
    const where: Prisma.StockItemWhereInput = {
      organizationId: actor.organizationId,
      isActive: true,
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              {
                category: {
                  name: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.stockItem.findMany({
        where,
        select: stockItemSelect,
        orderBy: [{ code: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.stockItem.count({ where }),
    ]);
    const itemIds = items.map((item) => item.id);
    const [movements, reservations] =
      itemIds.length && storeIds.length
        ? await Promise.all([
            this.prisma.stockMovement.findMany({
              where: {
                organizationId: actor.organizationId,
                stockItemId: { in: itemIds },
                OR: [
                  { sourceStoreId: { in: storeIds } },
                  { destinationStoreId: { in: storeIds } },
                ],
              },
              select: {
                stockItemId: true,
                sourceStoreId: true,
                destinationStoreId: true,
                quantity: true,
              },
            }),
            this.prisma.stockReservation.findMany({
              where: {
                organizationId: actor.organizationId,
                stockItemId: { in: itemIds },
                storeId: { in: storeIds },
                cancelledAt: null,
              },
              select: { stockItemId: true, storeId: true, quantity: true },
            }),
          ])
        : [[], []];
    const balanceByKey = new Map<string, number>();
    for (const movement of movements) {
      if (movement.destinationStoreId) {
        const key = `${movement.stockItemId}:${movement.destinationStoreId}`;
        balanceByKey.set(key, (balanceByKey.get(key) ?? 0) + movement.quantity);
      }
      if (movement.sourceStoreId) {
        const key = `${movement.stockItemId}:${movement.sourceStoreId}`;
        balanceByKey.set(key, (balanceByKey.get(key) ?? 0) - movement.quantity);
      }
    }
    const reservedByKey = new Map<string, number>();
    for (const reservation of reservations) {
      const key = `${reservation.stockItemId}:${reservation.storeId}`;
      reservedByKey.set(
        key,
        (reservedByKey.get(key) ?? 0) + reservation.quantity,
      );
    }

    return {
      items: items.map((item) => ({
        ...item,
        unitLabel: 'units' as const,
        balances: stores.map((store) => {
          const key = `${item.id}:${store.id}`;
          const onHand = balanceByKey.get(key) ?? 0;
          const reserved = reservedByKey.get(key) ?? 0;
          return {
            store: {
              id: store.id,
              code: store.code,
              name: store.name,
              location: store.location,
            },
            onHand,
            reserved,
            available: onHand - reserved,
          };
        }),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async createItem(actor: AuthenticatedActor, dto: CreateStockItemDto) {
    this.requireManager(actor);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const category = await tx.assetCategory.findFirst({
            where: {
              id: dto.categoryId,
              organizationId: actor.organizationId,
              isActive: true,
              trackingMode: AssetTrackingMode.QUANTITY,
            },
            select: { id: true },
          });
          if (!category) {
            throw new NotFoundException('Quantity-stock category not found');
          }
          return tx.stockItem.create({
            data: {
              organizationId: actor.organizationId,
              categoryId: category.id,
              code: dto.code,
              name: dto.name,
              description: dto.description || null,
              createdByUserId: actor.userId,
            },
            select: stockItemSelect,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A stock item with this code already exists in the organization',
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'The stock category changed while creating the item. Reload and retry.',
        );
      }
      throw error;
    }
  }

  async listMovements(
    actor: AuthenticatedActor,
    query: ListStockMovementsQueryDto,
  ) {
    this.requireManager(actor);
    const storeIds = await this.getAccessibleStoreIds(actor);
    const filters: Prisma.StockMovementWhereInput[] = [
      {
        OR: [
          { sourceStoreId: { in: storeIds } },
          { destinationStoreId: { in: storeIds } },
        ],
      },
      {
        OR: [{ sourceStoreId: null }, { sourceStoreId: { in: storeIds } }],
      },
      {
        OR: [
          { destinationStoreId: null },
          { destinationStoreId: { in: storeIds } },
        ],
      },
    ];
    if (query.storeId) {
      filters.push({
        OR: [
          { sourceStoreId: query.storeId },
          { destinationStoreId: query.storeId },
        ],
      });
    }
    if (query.search) {
      filters.push({
        OR: [
          { reason: { contains: query.search, mode: 'insensitive' } },
          {
            stockItem: {
              OR: [
                { code: { contains: query.search, mode: 'insensitive' } },
                { name: { contains: query.search, mode: 'insensitive' } },
              ],
            },
          },
        ],
      });
    }
    const where: Prisma.StockMovementWhereInput = {
      organizationId: actor.organizationId,
      AND: filters,
      ...(query.stockItemId ? { stockItemId: query.stockItemId } : {}),
      ...(query.movementType ? { movementType: query.movementType } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        select: stockMovementSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async createMovement(
    actor: AuthenticatedActor,
    stockItemId: string,
    idempotencyKey: string | undefined,
    dto: CreateStockMovementDto,
  ) {
    this.requireManager(actor);
    const key = this.requireKey(idempotencyKey);
    this.validateMovementShape(dto);
    const accessibleLocationIds =
      (await this.locations.getAccessibleLocationIds(actor)) ?? [];
    const payloadHash = this.hash({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      operation: 'stock.movement.create',
      stockItemId,
      movementType: dto.movementType,
      sourceStoreId: dto.sourceStoreId ?? null,
      destinationStoreId: dto.destinationStoreId ?? null,
      quantity: dto.quantity,
      reason: dto.reason.trim(),
      sourceReference: dto.sourceReference?.trim() || null,
    });
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.stockMovement.findFirst({
            where: {
              organizationId: actor.organizationId,
              createdByUserId: actor.userId,
              idempotencyKey: key,
            },
            select: stockMovementIdempotencySelect,
          });
          if (existing) {
            await this.assertMovementVisible(
              tx,
              actor,
              existing,
              accessibleLocationIds,
            );
            if (existing.payloadHash !== payloadHash) {
              throw new ConflictException(
                'This Idempotency-Key was already used with a different stock movement',
              );
            }
            const {
              idempotencyKey: _idempotencyKey,
              payloadHash: _payloadHash,
              ...movement
            } = existing;
            return movement;
          }
          const item = await this.getActiveItem(
            tx,
            actor.organizationId,
            stockItemId,
          );
          const storeIds = [dto.sourceStoreId, dto.destinationStoreId].filter(
            (id): id is string => Boolean(id),
          );
          const stores = await tx.store.findMany({
            where: {
              organizationId: actor.organizationId,
              id: { in: storeIds },
              isActive: true,
              locationId: { in: accessibleLocationIds },
            },
            select: { id: true },
          });
          if (stores.length !== storeIds.length) {
            throw new NotFoundException('Store not found');
          }
          for (const storeId of [...storeIds].sort()) {
            await this.lockStock(tx, actor.organizationId, item.id, storeId);
          }
          for (const storeId of [dto.sourceStoreId].filter((id): id is string =>
            Boolean(id),
          )) {
            const balance = await this.balance(
              tx,
              actor.organizationId,
              item.id,
              storeId,
            );
            if (dto.quantity > balance.available) {
              throw new ConflictException(
                `Only ${balance.available} unreserved units are available at the source store`,
              );
            }
          }
          return tx.stockMovement.create({
            data: {
              organizationId: actor.organizationId,
              stockItemId: item.id,
              movementType: dto.movementType,
              sourceStoreId: dto.sourceStoreId ?? null,
              destinationStoreId: dto.destinationStoreId ?? null,
              quantity: dto.quantity,
              reason: dto.reason.trim(),
              sourceReference: dto.sourceReference?.trim() || null,
              createdByUserId: actor.userId,
              idempotencyKey: key,
              payloadHash,
            },
            select: stockMovementSelect,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.stockMovement.findFirst({
          where: {
            organizationId: actor.organizationId,
            createdByUserId: actor.userId,
            idempotencyKey: key,
          },
          select: stockMovementIdempotencySelect,
        });
        if (existing) {
          const accessibleStoreIds = await this.getAccessibleStoreIds(actor);
          const referencedStoreIds = [
            existing.sourceStoreId,
            existing.destinationStoreId,
          ].filter((id): id is string => Boolean(id));
          if (
            referencedStoreIds.some((id) => !accessibleStoreIds.includes(id))
          ) {
            throw new NotFoundException('Stock movement not found');
          }
          if (existing.payloadHash === payloadHash) {
            const {
              idempotencyKey: _idempotencyKey,
              payloadHash: _payloadHash,
              ...movement
            } = existing;
            return movement;
          }
        }
        throw new ConflictException(
          'This Idempotency-Key was already used or stock changed. Retry with the same key.',
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'Stock changed concurrently. Retry with the same Idempotency-Key.',
        );
      }
      throw error;
    }
  }

  async listReservations(
    actor: AuthenticatedActor,
    query: ListStockReservationsQueryDto,
  ) {
    this.requireManager(actor);
    const storeIds = await this.getAccessibleStoreIds(actor);
    const filters: Prisma.StockReservationWhereInput[] = [
      { storeId: { in: storeIds } },
    ];
    if (query.storeId) filters.push({ storeId: query.storeId });
    if (query.search) {
      filters.push({
        OR: [
          { reason: { contains: query.search, mode: 'insensitive' } },
          {
            stockItem: {
              OR: [
                { code: { contains: query.search, mode: 'insensitive' } },
                { name: { contains: query.search, mode: 'insensitive' } },
              ],
            },
          },
        ],
      });
    }
    const where: Prisma.StockReservationWhereInput = {
      organizationId: actor.organizationId,
      AND: filters,
      ...(query.stockItemId ? { stockItemId: query.stockItemId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.stockReservation.findMany({
        where,
        select: stockReservationSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.stockReservation.count({ where }),
    ]);
    return {
      items: items.map(stockReservationResponse),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async createReservation(
    actor: AuthenticatedActor,
    idempotencyKey: string | undefined,
    dto: CreateStockReservationDto,
  ) {
    this.requireManager(actor);
    const key = this.requireKey(idempotencyKey);
    const accessibleLocationIds =
      (await this.locations.getAccessibleLocationIds(actor)) ?? [];
    const payloadHash = this.hash({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      operation: 'stock.reservation.create',
      stockItemId: dto.stockItemId,
      storeId: dto.storeId,
      quantity: dto.quantity,
      reason: dto.reason.trim(),
    });
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.stockReservation.findFirst({
            where: {
              organizationId: actor.organizationId,
              createdByUserId: actor.userId,
              idempotencyKey: key,
            },
            select: stockReservationIdempotencySelect,
          });
          if (existing) {
            if (!accessibleLocationIds.includes(existing.store.location.id)) {
              throw new NotFoundException('Stock reservation not found');
            }
            if (existing.payloadHash !== payloadHash) {
              throw new ConflictException(
                'This Idempotency-Key was already used with a different stock reservation',
              );
            }
            const {
              idempotencyKey: _idempotencyKey,
              payloadHash: _payloadHash,
              ...reservation
            } = existing;
            return stockReservationResponse(reservation);
          }
          const item = await this.getActiveItem(
            tx,
            actor.organizationId,
            dto.stockItemId,
          );
          const store = await tx.store.findFirst({
            where: {
              id: dto.storeId,
              organizationId: actor.organizationId,
              isActive: true,
              locationId: { in: accessibleLocationIds },
            },
            select: { id: true },
          });
          if (!store) throw new NotFoundException('Store not found');
          await this.lockStock(tx, actor.organizationId, item.id, store.id);
          const balance = await this.balance(
            tx,
            actor.organizationId,
            item.id,
            store.id,
          );
          if (dto.quantity > balance.available) {
            throw new ConflictException(
              `Only ${balance.available} unreserved units are available to reserve`,
            );
          }
          const reservation = await tx.stockReservation.create({
            data: {
              organizationId: actor.organizationId,
              stockItemId: item.id,
              storeId: store.id,
              quantity: dto.quantity,
              reason: dto.reason.trim(),
              createdByUserId: actor.userId,
              idempotencyKey: key,
              payloadHash,
            },
            select: stockReservationSelect,
          });
          return stockReservationResponse(reservation);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      ) {
        if (error.code === 'P2002') {
          const existing = await this.prisma.stockReservation.findFirst({
            where: {
              organizationId: actor.organizationId,
              createdByUserId: actor.userId,
              idempotencyKey: key,
            },
            select: stockReservationIdempotencySelect,
          });
          if (
            existing &&
            !accessibleLocationIds.includes(existing.store.location.id)
          ) {
            throw new NotFoundException('Stock reservation not found');
          }
          if (existing?.payloadHash === payloadHash) {
            const {
              idempotencyKey: _idempotencyKey,
              payloadHash: _payloadHash,
              ...reservation
            } = existing;
            return stockReservationResponse(reservation);
          }
        }
        throw new ConflictException(
          'Stock changed concurrently or this Idempotency-Key was already used. Retry with the same key.',
        );
      }
      throw error;
    }
  }

  async cancelReservation(
    actor: AuthenticatedActor,
    reservationId: string,
    version: number,
  ) {
    this.requireManager(actor);
    const accessibleLocationIds =
      (await this.locations.getAccessibleLocationIds(actor)) ?? [];
    return this.prisma.$transaction(
      async (tx) => {
        const reservation = await tx.stockReservation.findFirst({
          where: {
            id: reservationId,
            organizationId: actor.organizationId,
            store: { locationId: { in: accessibleLocationIds } },
          },
          select: stockReservationSelect,
        });
        if (!reservation) {
          throw new NotFoundException('Stock reservation not found');
        }
        if (reservation.cancelledAt) {
          return stockReservationResponse(reservation);
        }
        await this.lockStock(
          tx,
          actor.organizationId,
          reservation.stockItemId,
          reservation.storeId,
        );
        const updated = await tx.stockReservation.updateMany({
          where: {
            id: reservationId,
            organizationId: actor.organizationId,
            version,
            cancelledAt: null,
          },
          data: {
            cancelledAt: new Date(),
            cancelledByUserId: actor.userId,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException(
            'The stock reservation changed before cancellation',
          );
        }
        const updatedReservation = await tx.stockReservation.findFirstOrThrow({
          where: { id: reservationId, organizationId: actor.organizationId },
          select: stockReservationSelect,
        });
        return stockReservationResponse(updatedReservation);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private requireManager(actor: AuthenticatedActor): void {
    if (actor.role !== UserRole.ASSET_MANAGER) {
      throw new ForbiddenException(
        'Stock operations are available to Asset Managers only',
      );
    }
  }

  private requireKey(value: string | undefined): string {
    const key = value?.trim();
    if (!key || key.length > 100) {
      throw new UnprocessableEntityException(
        'A valid Idempotency-Key header is required',
      );
    }
    return key;
  }

  private hash(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private validateMovementShape(dto: CreateStockMovementDto): void {
    const source = Boolean(dto.sourceStoreId);
    const destination = Boolean(dto.destinationStoreId);
    const valid =
      (dto.movementType === StockMovementType.RECEIPT &&
        !source &&
        destination) ||
      (dto.movementType === StockMovementType.RETURN &&
        !source &&
        destination) ||
      (dto.movementType === StockMovementType.ISSUE &&
        source &&
        !destination) ||
      (dto.movementType === StockMovementType.TRANSFER &&
        source &&
        destination &&
        dto.sourceStoreId !== dto.destinationStoreId);
    if (!valid) {
      throw new UnprocessableEntityException(
        'Choose the store locations required for this movement type',
      );
    }
  }

  private async getActiveItem(
    tx: Prisma.TransactionClient,
    organizationId: string,
    itemId: string,
  ) {
    const item = await tx.stockItem.findFirst({
      where: {
        id: itemId,
        organizationId,
        isActive: true,
        category: {
          isActive: true,
          trackingMode: AssetTrackingMode.QUANTITY,
        },
      },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Stock item not found');
    return item;
  }

  private async getAccessibleStoreIds(actor: AuthenticatedActor) {
    const locationIds =
      (await this.locations.getAccessibleLocationIds(actor)) ?? [];
    const stores = await this.prisma.store.findMany({
      where: {
        organizationId: actor.organizationId,
        locationId: { in: locationIds },
      },
      select: { id: true },
    });
    return stores.map((store) => store.id);
  }

  private async assertMovementVisible(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    movement: {
      sourceStoreId: string | null;
      destinationStoreId: string | null;
    },
    locationIds: string[],
  ): Promise<void> {
    const ids = [movement.sourceStoreId, movement.destinationStoreId].filter(
      (id): id is string => Boolean(id),
    );
    const stores = await tx.store.findMany({
      where: {
        organizationId: actor.organizationId,
        id: { in: ids },
        locationId: { in: locationIds },
      },
      select: { id: true },
    });
    if (stores.length !== ids.length) {
      throw new NotFoundException('Stock movement not found');
    }
  }

  private async lockStock(
    tx: Prisma.TransactionClient,
    organizationId: string,
    itemId: string,
    storeId: string,
  ): Promise<void> {
    const lockKey = `${itemId}:${storeId}`;
    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(hashtext(${organizationId}), hashtext(${lockKey}))
    `;
  }

  private async balance(
    tx: Prisma.TransactionClient,
    organizationId: string,
    itemId: string,
    storeId: string,
  ): Promise<{ onHand: number; reserved: number; available: number }> {
    const [movements, reservations] = await Promise.all([
      tx.stockMovement.findMany({
        where: {
          organizationId,
          stockItemId: itemId,
          OR: [{ sourceStoreId: storeId }, { destinationStoreId: storeId }],
        },
        select: {
          sourceStoreId: true,
          destinationStoreId: true,
          quantity: true,
        },
      }),
      tx.stockReservation.aggregate({
        where: {
          organizationId,
          stockItemId: itemId,
          storeId,
          cancelledAt: null,
        },
        _sum: { quantity: true },
      }),
    ]);
    const onHand = movements.reduce(
      (sum, movement) =>
        sum +
        (movement.destinationStoreId === storeId ? movement.quantity : 0) -
        (movement.sourceStoreId === storeId ? movement.quantity : 0),
      0,
    );
    const reserved = reservations._sum.quantity ?? 0;
    return { onHand, reserved, available: onHand - reserved };
  }
}
