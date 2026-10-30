import { jest } from '@jest/globals';
import {
  ValidationPipe,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { UserRole } from '../generated/prisma/enums.js';
import { ProblemDetailsFilter } from '../http/problem-details.filter.js';
import { VerificationController } from './verification.controller.js';
import { VerificationService } from './verification.service.js';

describe('VerificationController HTTP contract', () => {
  let app: INestApplication;
  const actor = {
    userId: 'c0985b17-75bb-4a80-9763-35d673ec05f2',
    organizationId: '40e9ce48-e66d-4bfc-a4ea-df85269a96c3',
    role: UserRole.ASSET_MANAGER,
  };
  const campaignId = '1c2f7b50-3c3b-4fa9-9f87-5f6b6d6f8d10';
  const expectedAssetId = '2c2f7b50-3c3b-4fa9-9f87-5f6b6d6f8d10';
  const listCampaigns = jest.fn();
  const createCampaign = jest.fn();
  const recordObservation = jest.fn();
  const completeCampaign = jest.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [VerificationController],
      providers: [
        {
          provide: VerificationService,
          useValue: {
            listCampaigns,
            createCampaign,
            getCampaign: jest.fn(),
            listExpectedAssets: jest.fn(),
            listObservations: jest.fn(),
            recordObservation,
            reconcileObservation: jest.fn(),
            completeCampaign,
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

  it('binds authenticated actor and validated campaign filters', async () => {
    listCampaigns.mockResolvedValue({
      items: [],
      page: 2,
      pageSize: 10,
      total: 0,
    });

    await request(app.getHttpServer())
      .get('/api/v1/verification/campaigns?page=2&pageSize=10&search=quarterly')
      .expect(200);

    expect(listCampaigns).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        page: 2,
        pageSize: 10,
        search: 'quarterly',
      }),
    );
  });

  it('normalizes campaign names and forwards idempotency identity', async () => {
    createCampaign.mockResolvedValue({ id: campaignId });

    await request(app.getHttpServer())
      .post('/api/v1/verification/campaigns')
      .set('Idempotency-Key', 'campaign-key')
      .send({
        locationId: '27ae8d6f-3848-4528-9f31-ec585d08e9b5',
        name: ' Audit ',
      })
      .expect(201)
      .expect({ id: campaignId });

    expect(createCampaign).toHaveBeenCalledWith(actor, 'campaign-key', {
      locationId: '27ae8d6f-3848-4528-9f31-ec585d08e9b5',
      name: 'Audit',
    });
  });

  it('rejects non-boolean presence values instead of coercing them', async () => {
    await request(app.getHttpServer())
      .post(
        `/api/v1/verification/campaigns/${campaignId}/assets/${expectedAssetId}/observations`,
      )
      .set('Idempotency-Key', 'observation-key')
      .send({ found: 'false' })
      .expect(400);

    expect(recordObservation).not.toHaveBeenCalled();
  });

  it('binds the completion version and retry key', async () => {
    completeCampaign.mockResolvedValue({ id: campaignId, status: 'COMPLETED' });

    await request(app.getHttpServer())
      .post(`/api/v1/verification/campaigns/${campaignId}/complete`)
      .set('If-Match', '"3"')
      .set('Idempotency-Key', 'complete-key')
      .expect(200)
      .expect({ id: campaignId, status: 'COMPLETED' });

    expect(completeCampaign).toHaveBeenCalledWith(
      actor,
      campaignId,
      3,
      'complete-key',
    );
  });
});
