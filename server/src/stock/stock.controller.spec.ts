import { jest } from '@jest/globals';
import {
  ValidationPipe,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { ProblemDetailsFilter } from '../http/problem-details.filter.js';
import { StockController } from './stock.controller.js';
import { StockService } from './stock.service.js';

describe('Stock HTTP contract (no database)', () => {
  let app: INestApplication;
  const itemId = '8e626601-b894-4f2e-acac-85104a978eea';
  const storeId = '1c63e385-5887-447a-b0ad-418a3f428d09';
  const reservationId = 'c0d0e786-1bc0-4553-a2d7-9c2a442eb067';
  const actor = {
    userId: 'authenticated-user',
    organizationId: 'authenticated-organization',
    role: 'ASSET_MANAGER',
  };
  const listItems = jest.fn();
  const createItem = jest.fn();
  const listMovements = jest.fn();
  const createMovement = jest.fn();
  const listReservations = jest.fn();
  const createReservation = jest.fn();
  const cancelReservation = jest.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [StockController],
      providers: [
        {
          provide: StockService,
          useValue: {
            listItems,
            createItem,
            listMovements,
            createMovement,
            listReservations,
            createReservation,
            cancelReservation,
          },
        },
      ],
    })
      .overrideGuard(AccessTokenGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          context.switchToHttp().getRequest().user = actor;
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
  });

  beforeEach(() => jest.resetAllMocks());
  afterAll(async () => app.close());

  it('routes stock movement commands with authenticated actor and idempotency key', async () => {
    const movement = { id: 'movement-id', movementType: 'RECEIPT' };
    createMovement.mockResolvedValue(movement);

    await request(app.getHttpServer())
      .post(`/api/v1/stock/items/${itemId}/movements`)
      .set('Idempotency-Key', 'receipt-command')
      .send({
        movementType: 'RECEIPT',
        destinationStoreId: storeId,
        quantity: '4',
        reason: 'Opening count receipt',
      })
      .expect(201)
      .expect(movement);
    expect(createMovement).toHaveBeenCalledWith(
      actor,
      itemId,
      'receipt-command',
      expect.objectContaining({
        movementType: 'RECEIPT',
        destinationStoreId: storeId,
        quantity: 4,
      }),
    );
  });

  it('rejects fractional quantities before calling the stock service', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/stock/items/${itemId}/movements`)
      .set('Idempotency-Key', 'fractional-command')
      .send({
        movementType: 'RECEIPT',
        destinationStoreId: storeId,
        quantity: 1.5,
        reason: 'Fractional quantity',
      })
      .expect(400);
    expect(createMovement).not.toHaveBeenCalled();
  });

  it('routes versioned reservation cancellation', async () => {
    cancelReservation.mockResolvedValue({
      id: reservationId,
      status: 'CANCELLED',
    });
    await request(app.getHttpServer())
      .post(`/api/v1/stock/reservations/${reservationId}/cancel`)
      .set('If-Match', '"3"')
      .expect(200)
      .expect({ id: reservationId, status: 'CANCELLED' });
    expect(cancelReservation).toHaveBeenCalledWith(actor, reservationId, 3);
  });
});
