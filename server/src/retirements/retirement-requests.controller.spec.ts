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
import { RetirementRequestsController } from './retirement-requests.controller.js';
import { RetirementRequestsService } from './retirement-requests.service.js';

describe('RetirementRequestsController HTTP contract', () => {
  let app: INestApplication;
  const actor = {
    userId: 'c0985b17-75bb-4a80-9763-35d673ec05f2',
    organizationId: '40e9ce48-e66d-4bfc-a4ea-df85269a96c3',
    role: UserRole.ASSET_MANAGER,
  };
  const assetId = '8e626601-b894-4f2e-acac-85104a978eea';
  const createRequest = jest.fn();
  const listRequests = jest.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [RetirementRequestsController],
      providers: [
        {
          provide: RetirementRequestsService,
          useValue: { create: createRequest, list: listRequests },
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

  it('binds the actor and idempotency key for retirement request intake', async () => {
    createRequest.mockResolvedValue({
      id: 'request-id',
      status: 'PENDING_REVIEW',
    });

    await request(app.getHttpServer())
      .post(`/api/v1/retirements/assets/${assetId}/requests`)
      .set('Idempotency-Key', 'request-key')
      .send({
        reason: ' End of support ',
        impactReview: ' Recover the assigned accessories ',
      })
      .expect(201)
      .expect({ id: 'request-id', status: 'PENDING_REVIEW' });

    expect(createRequest).toHaveBeenCalledWith(actor, assetId, 'request-key', {
      reason: 'End of support',
      impactReview: 'Recover the assigned accessories',
    });
  });

  it('rejects unknown fields instead of accepting approval or lifecycle commands', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/retirements/assets/${assetId}/requests`)
      .set('Idempotency-Key', 'request-key')
      .send({
        reason: 'End of support',
        impactReview: 'Recover the assigned accessories',
        status: 'APPROVED',
        lifecycle: 'RETIRED',
      })
      .expect(400);

    expect(createRequest).not.toHaveBeenCalled();
  });
});
