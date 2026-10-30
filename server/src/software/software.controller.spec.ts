import { jest } from '@jest/globals';
import {
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { UserRole } from '../generated/prisma/enums.js';
import { ProblemDetailsFilter } from '../http/problem-details.filter.js';
import { SoftwareProductsController } from './software.controller.js';
import { SoftwareService } from './software.service.js';

describe('Software catalog HTTP contract (no database)', () => {
  let app: INestApplication;
  const productId = '27ae8d6f-3848-4528-9f31-ec585d08e9b5';
  const editionId = 'f810bb6e-234b-4bb0-a695-3aeef7c031f6';
  const actor = {
    userId: 'authenticated-software-manager',
    organizationId: 'authenticated-organization',
    role: UserRole.SOFTWARE_LICENSE_MANAGER,
  };
  const listProducts = jest.fn();
  const createProduct = jest.fn();
  const updateProduct = jest.fn();
  const createEdition = jest.fn();
  const updateEdition = jest.fn();
  const setEditionActive = jest.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [SoftwareProductsController],
      providers: [
        {
          provide: SoftwareService,
          useValue: {
            listProducts,
            getProduct: jest.fn(),
            createProduct,
            updateProduct,
            setProductActive: jest.fn(),
            listEditions: jest.fn(),
            createEdition,
            updateEdition,
            setEditionActive,
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

  beforeEach(() => {
    jest.resetAllMocks();
    actor.role = UserRole.SOFTWARE_LICENSE_MANAGER;
  });

  afterAll(async () => app.close());

  it('passes validated product catalog filters to the service', async () => {
    listProducts.mockResolvedValue({
      items: [],
      page: 2,
      pageSize: 10,
      total: 0,
    });

    await request(app.getHttpServer())
      .get('/api/v1/software/products?page=2&pageSize=10&search=%20suite%20')
      .expect(200)
      .expect({ items: [], page: 2, pageSize: 10, total: 0 });

    expect(listProducts).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ page: 2, pageSize: 10, search: 'suite' }),
    );
  });

  it('normalizes product names and defaults policy to review required', async () => {
    createProduct.mockResolvedValue({
      id: productId,
      publisher: 'Northwind Software',
      name: 'Office Suite',
      policyStatus: 'REVIEW_REQUIRED',
    });

    await request(app.getHttpServer())
      .post('/api/v1/software/products')
      .send({
        publisher: ' Northwind Software ',
        name: ' Office Suite ',
        commercialClassification: 'COMMERCIAL',
      })
      .expect(201);

    expect(createProduct).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        publisher: 'Northwind Software',
        name: 'Office Suite',
        policyStatus: 'REVIEW_REQUIRED',
      }),
    );
  });

  it('rejects invalid classification and unknown request properties', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/software/products')
      .send({
        publisher: 'Northwind Software',
        name: 'Office Suite',
        commercialClassification: 'UNAPPROVED',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/software/products')
      .send({
        publisher: 'Northwind Software',
        name: 'Office Suite',
        commercialClassification: 'COMMERCIAL',
        organizationId: 'client-controlled',
      })
      .expect(400);

    expect(createProduct).not.toHaveBeenCalled();
  });

  it('requires a valid quoted version for product updates', async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/software/products/${productId}`)
      .send({
        publisher: 'Northwind Software',
        name: 'Office Suite',
        commercialClassification: 'COMMERCIAL',
        policyStatus: 'APPROVED',
      })
      .expect(400);

    expect(updateProduct).not.toHaveBeenCalled();
  });

  it('routes edition creation and versioned updates under the product', async () => {
    createEdition.mockResolvedValue({
      id: editionId,
      productId,
      name: 'Business',
      versionLabel: '1.0',
    });
    updateEdition.mockResolvedValue({
      id: editionId,
      productId,
      name: 'Business',
      versionLabel: '1.1',
      version: 2,
    });

    await request(app.getHttpServer())
      .post(`/api/v1/software/products/${productId}/editions`)
      .send({ name: ' Business ', versionLabel: ' 1.0 ' })
      .expect(201);
    expect(createEdition).toHaveBeenCalledWith(actor, productId, {
      name: 'Business',
      versionLabel: '1.0',
    });

    await request(app.getHttpServer())
      .put(`/api/v1/software/products/${productId}/editions/${editionId}`)
      .set('If-Match', '"1"')
      .send({ name: 'Business', versionLabel: '1.1' })
      .expect(200);
    expect(updateEdition).toHaveBeenCalledWith(actor, productId, editionId, 1, {
      name: 'Business',
      versionLabel: '1.1',
    });
  });

  it('preserves stale product conflicts as problem details', async () => {
    updateProduct.mockRejectedValue(
      new ConflictException('The software product changed since it was loaded'),
    );

    await request(app.getHttpServer())
      .put(`/api/v1/software/products/${productId}`)
      .set('If-Match', '"1"')
      .send({
        publisher: 'Northwind Software',
        name: 'Office Suite',
        commercialClassification: 'COMMERCIAL',
        policyStatus: 'APPROVED',
      })
      .expect(409)
      .expect('Content-Type', /application\/problem\+json/)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          status: 409,
          detail: 'The software product changed since it was loaded',
        }),
      );
  });

  it('returns a service authorization denial for non-Software Managers', async () => {
    actor.role = UserRole.ASSET_MANAGER;
    listProducts.mockRejectedValue(
      new ForbiddenException('Software/License Manager access is required'),
    );

    await request(app.getHttpServer())
      .get('/api/v1/software/products')
      .expect(403)
      .expect('Content-Type', /application\/problem\+json/);

    expect(listProducts).toHaveBeenCalledWith(actor, expect.any(Object));
  });
});
