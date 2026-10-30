import { jest } from '@jest/globals';
import {
  ConflictException,
  ValidationPipe,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { ProblemDetailsFilter } from '../http/problem-details.filter.js';
import {
  AssignmentsController,
  AssetsController,
  ReservationsController,
  TransfersController,
} from './assets.controller.js';
import { AssetsService } from './assets.service.js';

describe('Asset profile HTTP contract (no database)', () => {
  let app: INestApplication;
  const assetId = '8e626601-b894-4f2e-acac-85104a978eea';
  const actor = {
    userId: 'authenticated-user',
    organizationId: 'authenticated-org',
  };
  const updateProfile = jest.fn();
  const listCategories = jest.fn();
  const listAssets = jest.fn();
  const assetHistory = jest.fn();
  const commissionAsset = jest.fn();
  const listRelationships = jest.fn();
  const addRelationship = jest.fn();
  const endRelationship = jest.fn();
  const componentInstallations = jest.fn();
  const installComponent = jest.fn();
  const removeComponent = jest.fn();
  const getCategory = jest.fn();
  const setCategoryActive = jest.fn();
  const updateCategory = jest.fn();
  const listReservations = jest.fn();
  const createReservation = jest.fn();
  const cancelReservation = jest.fn();
  const listAssignments = jest.fn();
  const createAssignment = jest.fn();
  const returnAssignment = jest.fn();
  const listTransfers = jest.fn();
  const createTransfer = jest.fn();
  const dispatchTransfer = jest.fn();
  const cancelTransfer = jest.fn();
  const receiveTransferLine = jest.fn();
  const profile = {
    manufacturer: ' Manufacturer ',
    model: '',
    serialNumber: '000123',
    sourceReference: '',
    notes: '',
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        AssetsController,
        ReservationsController,
        AssignmentsController,
        TransfersController,
      ],
      providers: [
        {
          provide: AssetsService,
          useValue: {
            updateProfile,
            listCategories,
            list: listAssets,
            history: assetHistory,
            commission: commissionAsset,
            relationships: listRelationships,
            addRelationship,
            endRelationship,
            componentInstallations,
            installComponent,
            removeComponent,
            getCategory,
            setCategoryActive,
            updateCategory,
            listReservations,
            createReservation,
            cancelReservation,
            listAssignments,
            createAssignment,
            returnAssignment,
            listTransfers,
            createTransfer,
            dispatchTransfer,
            cancelTransfer,
            receiveTransferLine,
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

  it('binds authenticated actor, explicit version and a normalized complete profile', async () => {
    updateProfile.mockResolvedValue({ id: assetId, version: 3 });
    await request(app.getHttpServer())
      .put(`/api/v1/assets/${assetId}/profile`)
      .set('If-Match', '"2"')
      .send(profile)
      .expect(200)
      .expect({ id: assetId, version: 3 });
    expect(updateProfile).toHaveBeenCalledWith(actor, assetId, 2, {
      ...profile,
      manufacturer: 'Manufacturer',
    });
  });

  it.each([
    undefined,
    '1',
    '0',
    '"0"',
    '"01"',
    '"-1"',
    'W/"1"',
    '*',
    '"1", "2"',
    '"1.5"',
    '"2147483648"',
  ])('rejects missing or invalid If-Match: %s', async (header) => {
    const call = request(app.getHttpServer()).put(
      `/api/v1/assets/${assetId}/profile`,
    );
    if (header !== undefined) call.set('If-Match', header);
    await call.send(profile).expect(400);
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it.each([
    'organizationId',
    'assetTag',
    'categoryId',
    'locationId',
    'lifecycle',
    'availability',
    'condition',
    'verification',
    'custody',
    'version',
    'createdByUserId',
  ])(
    'rejects forbidden field %s rather than silently ignoring it',
    async (field) => {
      await request(app.getHttpServer())
        .put(`/api/v1/assets/${assetId}/profile`)
        .set('If-Match', '"1"')
        .send({ ...profile, [field]: 'not-allowed' })
        .expect(400);
      expect(updateProfile).not.toHaveBeenCalled();
    },
  );

  it.each([
    {},
    { ...profile, notes: null },
    { ...profile, model: 123 },
    { ...profile, manufacturer: 'x'.repeat(151) },
    { ...profile, model: 'x'.repeat(151) },
    { ...profile, serialNumber: 'x'.repeat(151) },
    { ...profile, sourceReference: 'x'.repeat(151) },
    { ...profile, notes: 'x'.repeat(2001) },
  ])('rejects invalid/incomplete profile %#', async (body) => {
    await request(app.getHttpServer())
      .put(`/api/v1/assets/${assetId}/profile`)
      .set('If-Match', '"1"')
      .send(body)
      .expect(400);
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('returns stale-version errors through shared problem details', async () => {
    updateProfile.mockRejectedValue(
      new ConflictException('Asset changed; reload and review'),
    );
    await request(app.getHttpServer())
      .put(`/api/v1/assets/${assetId}/profile`)
      .set('If-Match', '"1"')
      .send(profile)
      .expect(409)
      .expect('Content-Type', /application\/problem\+json/)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          status: 409,
          detail: 'Asset changed; reload and review',
        }),
      );
  });

  it('rejects invalid asset identifiers', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/assets/not-a-uuid/profile')
      .set('If-Match', '"1"')
      .send(profile)
      .expect(400);
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('passes category visibility filters to the scoped service', async () => {
    listCategories.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
    });
    await request(app.getHttpServer())
      .get('/api/v1/assets/categories?includeInactive=true')
      .expect(200)
      .expect({ items: [], page: 1, pageSize: 20, total: 0 });
    expect(listCategories).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ includeInactive: true }),
    );
  });

  it('normalizes and validates exact serial-number lookup filters', async () => {
    listAssets.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 5,
      total: 0,
    });

    await request(app.getHttpServer())
      .get('/api/v1/assets?serialNumberExact=%20000123%20&page=1&pageSize=5')
      .expect(200)
      .expect({ items: [], page: 1, pageSize: 5, total: 0 });

    expect(listAssets).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        serialNumberExact: '000123',
        page: 1,
        pageSize: 5,
      }),
    );

    await request(app.getHttpServer())
      .get(`/api/v1/assets?serialNumberExact=${'x'.repeat(151)}`)
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/v1/assets?verification=MISSING')
      .expect(200);
    expect(listAssets).toHaveBeenLastCalledWith(
      actor,
      expect.objectContaining({ verification: 'MISSING' }),
    );
    await request(app.getHttpServer())
      .get('/api/v1/assets?verification=UNKNOWN')
      .expect(400);

    await request(app.getHttpServer())
      .get(
        '/api/v1/assets?warrantyExpiresOnFrom=2026-01-01&warrantyExpiresOnTo=2026-12-31',
      )
      .expect(200);
    expect(listAssets).toHaveBeenLastCalledWith(
      actor,
      expect.objectContaining({
        warrantyExpiresOnFrom: '2026-01-01',
        warrantyExpiresOnTo: '2026-12-31',
      }),
    );
    await request(app.getHttpServer())
      .get('/api/v1/assets?warrantyExpiresOnFrom=not-a-date')
      .expect(400);
  });

  it('validates and routes exact asset IDs used by label barcodes', async () => {
    listAssets.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 1,
      total: 0,
    });

    await request(app.getHttpServer())
      .get(`/api/v1/assets?assetIdExact=${assetId}&pageSize=1`)
      .expect(200)
      .expect({ items: [], page: 1, pageSize: 1, total: 0 });

    expect(listAssets).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ assetIdExact: assetId, pageSize: 1 }),
    );

    await request(app.getHttpServer())
      .get('/api/v1/assets?assetIdExact=not-a-uuid')
      .expect(400);
  });

  it('routes asset history through the scoped service', async () => {
    assetHistory.mockResolvedValue([
      {
        id: 'history-event',
        eventType: 'REGISTERED',
        details: { source: 'direct_asset_registration' },
      },
    ]);

    await request(app.getHttpServer())
      .get(`/api/v1/assets/${assetId}/history`)
      .expect(200)
      .expect([
        {
          id: 'history-event',
          eventType: 'REGISTERED',
          details: { source: 'direct_asset_registration' },
        },
      ]);

    expect(assetHistory).toHaveBeenCalledWith(actor, assetId);
    await request(app.getHttpServer())
      .get('/api/v1/assets/not-a-uuid/history')
      .expect(400);
  });

  it('commissions an asset with an explicit current version', async () => {
    commissionAsset.mockResolvedValue({
      id: assetId,
      lifecycle: 'ACTIVE',
      commissioningDate: '2026-10-29T00:00:00.000Z',
    });

    await request(app.getHttpServer())
      .post(`/api/v1/assets/${assetId}/commission`)
      .set('If-Match', '"2"')
      .send({ commissioningDate: '2026-10-29' })
      .expect(200)
      .expect({
        id: assetId,
        lifecycle: 'ACTIVE',
        commissioningDate: '2026-10-29T00:00:00.000Z',
      });

    expect(commissionAsset).toHaveBeenCalledWith(
      actor,
      assetId,
      2,
      '2026-10-29',
    );
    await request(app.getHttpServer())
      .post(`/api/v1/assets/${assetId}/commission`)
      .set('If-Match', '"2"')
      .send({ commissioningDate: 'not-a-date' })
      .expect(400);
  });

  it('routes parent-child relationship queries and commands', async () => {
    const childAssetId = 'c0d0e786-1bc0-4553-a2d7-9c2a442eb067';
    const relationshipId = 'ca6c8c95-e4b7-417f-b34a-a3ca6699e2b9';
    listRelationships.mockResolvedValue([]);
    addRelationship.mockResolvedValue({ id: relationshipId });
    endRelationship.mockResolvedValue({ id: relationshipId, endedAt: 'now' });

    await request(app.getHttpServer())
      .get(`/api/v1/assets/${assetId}/relationships`)
      .expect(200)
      .expect([]);
    expect(listRelationships).toHaveBeenCalledWith(actor, assetId);

    await request(app.getHttpServer())
      .post(`/api/v1/assets/${assetId}/relationships`)
      .send({ childAssetId })
      .expect(201)
      .expect({ id: relationshipId });
    expect(addRelationship).toHaveBeenCalledWith(actor, assetId, childAssetId);

    await request(app.getHttpServer())
      .post(`/api/v1/assets/${assetId}/relationships/${relationshipId}/end`)
      .expect(200)
      .expect({ id: relationshipId, endedAt: 'now' });
    expect(endRelationship).toHaveBeenCalledWith(
      actor,
      assetId,
      relationshipId,
    );
  });

  it('routes versioned component installation and removal commands', async () => {
    const componentAssetId = '5f920760-4bd0-45b0-a6ac-9084f3166300';
    const installationId = 'a2fdd40c-b9e6-433c-a474-4b54ff0c6b5c';
    const installation = {
      id: installationId,
      hostAssetId: assetId,
      componentAssetId,
      version: 1,
      removedAt: null,
    };
    componentInstallations.mockResolvedValue([installation]);
    installComponent.mockResolvedValue(installation);
    removeComponent.mockResolvedValue({
      ...installation,
      removedAt: '2026-10-29T12:00:00.000Z',
      version: 2,
    });

    await request(app.getHttpServer())
      .get(`/api/v1/assets/${assetId}/components`)
      .expect(200)
      .expect([installation]);
    expect(componentInstallations).toHaveBeenCalledWith(actor, assetId);

    await request(app.getHttpServer())
      .post(`/api/v1/assets/${assetId}/components/install`)
      .set('Idempotency-Key', 'install-component-key')
      .send({ componentAssetId, installNote: 'Installed during repair' })
      .expect(201)
      .expect(installation);
    expect(installComponent).toHaveBeenCalledWith(
      actor,
      assetId,
      'install-component-key',
      expect.objectContaining({ componentAssetId }),
    );

    await request(app.getHttpServer())
      .post(`/api/v1/assets/${assetId}/components/${installationId}/remove`)
      .set('If-Match', '"1"')
      .set('Idempotency-Key', 'remove-component-key')
      .send({ removalNote: 'Replaced component' })
      .expect(200)
      .expect({
        ...installation,
        removedAt: '2026-10-29T12:00:00.000Z',
        version: 2,
      });
    expect(removeComponent).toHaveBeenCalledWith(
      actor,
      assetId,
      installationId,
      1,
      'remove-component-key',
      expect.objectContaining({ removalNote: 'Replaced component' }),
    );
  });

  it('routes scoped reservation commands with idempotency and version headers', async () => {
    const reservationId = 'c0d0e786-1bc0-4553-a2d7-9c2a442eb067';
    const reservation = { id: reservationId, status: 'SCHEDULED', version: 1 };
    listReservations.mockResolvedValue({
      items: [reservation],
      page: 1,
      pageSize: 20,
      total: 1,
    });

    createReservation.mockResolvedValue(reservation);
    cancelReservation.mockResolvedValue({
      ...reservation,
      status: 'CANCELLED',
      version: 2,
    });

    await request(app.getHttpServer())
      .get('/api/v1/reservations?page=1&pageSize=20')
      .expect(200)
      .expect({ items: [reservation], page: 1, pageSize: 20, total: 1 });
    expect(listReservations).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ page: 1, pageSize: 20 }),
    );

    await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Idempotency-Key', 'reservation-key-1')
      .send({
        assetId,
        employeeId: '62cbad18-2387-4264-8cf1-83fd5b0d5eb1',
        startDate: '2099-01-01',
        expiresOn: '2099-01-02',
        reason: 'New starter equipment',
      })
      .expect(201)
      .expect(reservation);
    expect(createReservation).toHaveBeenCalledWith(
      actor,
      'reservation-key-1',
      expect.objectContaining({ assetId, startDate: '2099-01-01' }),
    );

    await request(app.getHttpServer())
      .post(`/api/v1/reservations/${reservationId}/cancel`)
      .set('If-Match', '"1"')
      .expect(200)
      .expect({ ...reservation, status: 'CANCELLED', version: 2 });
    expect(cancelReservation).toHaveBeenCalledWith(actor, reservationId, 1);
  });

  it('routes assignment and return commands with scoped retry/version contracts', async () => {
    const assignmentId = 'c0d0e786-1bc0-4553-a2d7-9c2a442eb067';
    const assignment = { id: assignmentId, status: 'OPEN', version: 1 };
    listAssignments.mockResolvedValue({
      items: [assignment],
      page: 1,
      pageSize: 20,
      total: 1,
    });

    createAssignment.mockResolvedValue(assignment);
    returnAssignment.mockResolvedValue({
      ...assignment,
      status: 'RETURNED',
      version: 2,
    });

    await request(app.getHttpServer())
      .get('/api/v1/assignments?page=1&pageSize=20')
      .expect(200)
      .expect({ items: [assignment], page: 1, pageSize: 20, total: 1 });
    expect(listAssignments).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ page: 1, pageSize: 20 }),
    );

    await request(app.getHttpServer())
      .post('/api/v1/assignments')
      .set('Idempotency-Key', 'assignment-key-1')
      .send({
        assetId,
        recipientType: 'EMPLOYEE',
        employeeId: '62cbad18-2387-4264-8cf1-83fd5b0d5eb1',
        conditionAtIssue: 'GOOD',
        purpose: 'New starter equipment',
      })
      .expect(201)
      .expect(assignment);
    expect(createAssignment).toHaveBeenCalledWith(
      actor,
      'assignment-key-1',
      expect.objectContaining({ assetId, conditionAtIssue: 'GOOD' }),
    );

    const returnResponse = await request(app.getHttpServer())
      .post(`/api/v1/assignments/${assignmentId}/return`)
      .set('If-Match', '"1"')
      .set('Idempotency-Key', 'return-key-1')
      .send({
        conditionAtReturn: 'GOOD',
        inspectionRequired: false,
      });
    expect(returnResponse.status).toBe(200);
    expect(returnResponse.body).toEqual({
      ...assignment,
      status: 'RETURNED',
      version: 2,
    });
    expect(returnAssignment).toHaveBeenCalledWith(
      actor,
      assignmentId,
      1,
      'return-key-1',
      expect.objectContaining({
        conditionAtReturn: 'GOOD',
        inspectionRequired: false,
      }),
    );
  });

  it('routes multi-asset transfer dispatch and per-line receiving commands', async () => {
    const transferId = 'c0d0e786-1bc0-4553-a2d7-9c2a442eb067';
    const lineId = '5f920760-4bd0-45b0-a6ac-9084f3166300';
    const transfer = { id: transferId, status: 'DRAFT', version: 1 };
    listTransfers.mockResolvedValue({
      items: [transfer],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    createTransfer.mockResolvedValue(transfer);
    dispatchTransfer.mockResolvedValue({ ...transfer, status: 'IN_TRANSIT' });
    cancelTransfer.mockResolvedValue({ ...transfer, status: 'CANCELLED' });
    receiveTransferLine.mockResolvedValue({
      ...transfer,
      status: 'PARTIALLY_RECEIVED',
    });

    await request(app.getHttpServer())
      .get('/api/v1/transfers?page=1&pageSize=20')
      .expect(200)
      .expect({ items: [transfer], page: 1, pageSize: 20, total: 1 });
    await request(app.getHttpServer())
      .post('/api/v1/transfers')
      .set('Idempotency-Key', 'transfer-key')
      .send({
        destinationLocationId: '6c438b8e-e311-4fe9-89ac-9a7d61ab7e5b',
        assetIds: [assetId],
        reason: 'Move equipment to HQ',
      })
      .expect(201)
      .expect(transfer);
    expect(createTransfer).toHaveBeenCalledWith(
      actor,
      'transfer-key',
      expect.objectContaining({ assetIds: [assetId] }),
    );

    await request(app.getHttpServer())
      .post(`/api/v1/transfers/${transferId}/dispatch`)
      .set('If-Match', '"1"')
      .expect(200)
      .expect({ ...transfer, status: 'IN_TRANSIT' });
    expect(dispatchTransfer).toHaveBeenCalledWith(actor, transferId, 1);

    await request(app.getHttpServer())
      .post(`/api/v1/transfers/${transferId}/cancel`)
      .set('If-Match', '"1"')
      .expect(200)
      .expect({ ...transfer, status: 'CANCELLED' });
    expect(cancelTransfer).toHaveBeenCalledWith(actor, transferId, 1);

    await request(app.getHttpServer())
      .post(`/api/v1/transfers/${transferId}/lines/${lineId}/receive`)
      .set('If-Match', '"1"')
      .set('Idempotency-Key', 'receipt-key')
      .send({
        result: 'RECEIVED',
        conditionAtReceipt: 'GOOD',
        inspectionRequired: false,
      })
      .expect(200)
      .expect({ ...transfer, status: 'PARTIALLY_RECEIVED' });
    expect(receiveTransferLine).toHaveBeenCalledWith(
      actor,
      transferId,
      lineId,
      1,
      'receipt-key',
      expect.objectContaining({ result: 'RECEIVED' }),
    );
  });

  it('routes category detail lookup through the authenticated service', async () => {
    getCategory.mockResolvedValue({
      id: '9c73dc96-27d7-4e8d-ae3b-0af4e9e9a1f2',
      isActive: false,
      version: 3,
    });
    await request(app.getHttpServer())
      .get('/api/v1/assets/categories/9c73dc96-27d7-4e8d-ae3b-0af4e9e9a1f2')
      .expect(200)
      .expect({
        id: '9c73dc96-27d7-4e8d-ae3b-0af4e9e9a1f2',
        isActive: false,
        version: 3,
      });
    expect(getCategory).toHaveBeenCalledWith(
      actor,
      '9c73dc96-27d7-4e8d-ae3b-0af4e9e9a1f2',
    );
  });

  it('rejects malformed includeInactive values', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/assets/categories?includeInactive=maybe')
      .expect(400);
    expect(listCategories).not.toHaveBeenCalled();
  });

  it.each([
    ['deactivate', false],
    ['reactivate', true],
  ] as const)(
    'routes category %s to the explicit lifecycle command',
    async (action, isActive) => {
      setCategoryActive.mockResolvedValue({
        id: '9c73dc96-27d7-4e8d-ae3b-0af4e9e9a1f2',
        isActive,
      });
      await request(app.getHttpServer())
        .post(
          `/api/v1/assets/categories/9c73dc96-27d7-4e8d-ae3b-0af4e9e9a1f2/${action}`,
        )
        .expect(200)
        .expect({ id: '9c73dc96-27d7-4e8d-ae3b-0af4e9e9a1f2', isActive });
      expect(setCategoryActive).toHaveBeenCalledWith(
        actor,
        '9c73dc96-27d7-4e8d-ae3b-0af4e9e9a1f2',
        isActive,
      );
    },
  );

  it('rejects malformed category identifiers before calling the service', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/assets/categories/not-a-uuid/deactivate')
      .expect(400);
    expect(setCategoryActive).not.toHaveBeenCalled();
  });

  it('updates categories using the explicit version and normalized payload', async () => {
    updateCategory.mockResolvedValue({
      id: '9c73dc96-27d7-4e8d-ae3b-0af4e9e9a1f2',
      code: 'LAPTOP',
      name: 'Portable computer',
      version: 3,
    });

    await request(app.getHttpServer())
      .put('/api/v1/assets/categories/9c73dc96-27d7-4e8d-ae3b-0af4e9e9a1f2')
      .set('If-Match', '"2"')
      .send({ code: ' laptop ', name: ' Portable computer ' })
      .expect(200)
      .expect({
        id: '9c73dc96-27d7-4e8d-ae3b-0af4e9e9a1f2',
        code: 'LAPTOP',
        name: 'Portable computer',
        version: 3,
      });

    expect(updateCategory).toHaveBeenCalledWith(
      actor,
      '9c73dc96-27d7-4e8d-ae3b-0af4e9e9a1f2',
      2,
      { code: 'LAPTOP', name: 'Portable computer' },
    );
  });

  it('requires a valid category version and complete update DTO', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/assets/categories/9c73dc96-27d7-4e8d-ae3b-0af4e9e9a1f2')
      .send({ code: 'LAPTOP', name: 'Laptop' })
      .expect(400);
    await request(app.getHttpServer())
      .put('/api/v1/assets/categories/9c73dc96-27d7-4e8d-ae3b-0af4e9e9a1f2')
      .set('If-Match', '"1"')
      .send({ code: 'LAPTOP' })
      .expect(400);
    expect(updateCategory).not.toHaveBeenCalled();
  });

  it('does not expose a generic asset patch endpoint', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/assets/${assetId}`)
      .send({ lifecycle: 'DISPOSED' })
      .expect(404);
    expect(updateProfile).not.toHaveBeenCalled();
  });
});
