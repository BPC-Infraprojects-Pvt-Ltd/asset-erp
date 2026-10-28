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
import { AssetsController } from './assets.controller.js';
import { AssetsService } from './assets.service.js';

describe('Asset profile HTTP contract (no database)', () => {
  let app: INestApplication;
  const assetId = '8e626601-b894-4f2e-acac-85104a978eea';
  const actor = {
    userId: 'authenticated-user',
    organizationId: 'authenticated-org',
  };
  const updateProfile = jest.fn();
  const profile = {
    manufacturer: ' Manufacturer ',
    model: '',
    serialNumber: '000123',
    sourceReference: '',
    notes: '',
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AssetsController],
      providers: [{ provide: AssetsService, useValue: { updateProfile } }],
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

  it('does not expose a generic asset patch endpoint', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/assets/${assetId}`)
      .send({ lifecycle: 'DISPOSED' })
      .expect(404);
    expect(updateProfile).not.toHaveBeenCalled();
  });
});
