import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter.js';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        validationError: { target: false, value: false },
      }),
    );
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
  });

  it('rejects unknown sign-in fields using problem details', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        organizationId: '40e9ce48-e66d-4bfc-a4ea-df85269a96c3',
        email: 'person@example.com',
        password: 'password',
        organizationRole: 'administrator',
      })
      .expect(400)
      .expect('Content-Type', /application\/problem\+json/)
      .expect((response) => {
        expect(response.body).toMatchObject({
          type: 'about:blank',
          title: 'Bad Request',
          status: 400,
          instance: '/api/v1/auth/login',
        });
        expect(response.body.correlationId).toBe(
          response.headers['x-correlation-id'],
        );
      });
  });

  it('/api/v1/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('requires authentication to access organization users', () => {
    return request(app.getHttpServer())
      .get('/api/v1/users')
      .expect(401)
      .expect('Content-Type', /application\/problem\+json/);
  });

  it('requires authentication to access locations', () => {
    return request(app.getHttpServer())
      .get('/api/v1/locations')
      .expect(401)
      .expect('Content-Type', /application\/problem\+json/);
  });

  it('requires authentication to access the asset register', () => {
    return request(app.getHttpServer())
      .get('/api/v1/assets')
      .expect(401)
      .expect('Content-Type', /application\/problem\+json/);
  });

  afterEach(async () => {
    await app.close();
  });
});
