import { jest } from '@jest/globals';
import {
  ExecutionContext,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { ProblemDetailsFilter } from '../http/problem-details.filter.js';
import { AssetImportsController } from './asset-imports.controller.js';
import { AssetImportsService } from './asset-imports.service.js';
import { MAX_ASSET_IMPORT_BYTES } from './asset-import-csv.js';

describe('Asset import HTTP contract (no database)', () => {
  let app: INestApplication;
  const jobId = 'c0d0e786-1bc0-4553-a2d7-9c2a442eb067';
  const actor = {
    userId: 'authenticated-user',
    organizationId: 'authenticated-organization',
    role: 'ASSET_MANAGER',
  };
  const list = jest.fn();
  const get = jest.fn();
  const errors = jest.fn();
  const preview = jest.fn();
  const commit = jest.fn();
  const csv = Buffer.from(
    'assetTag,categoryCode,locationCode,availability,condition\nLAP-100,LAPTOP,PUNE,AVAILABLE,GOOD\n',
  );

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AssetImportsController],
      providers: [
        {
          provide: AssetImportsService,
          useValue: { list, get, errors, preview, commit },
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

  it('accepts a bounded CSV preview with an idempotency key', async () => {
    const result = { job: { id: jobId, status: 'PREVIEW_READY' }, errors: [] };
    preview.mockResolvedValue(result);

    await request(app.getHttpServer())
      .post('/api/v1/imports/assets/preview')
      .set('Idempotency-Key', 'preview-command')
      .attach('file', csv, {
        filename: 'assets.csv',
        contentType: 'text/csv',
      })
      .expect(201)
      .expect(result);
    expect(preview).toHaveBeenCalledWith(
      actor,
      'preview-command',
      expect.any(Buffer),
    );
  });

  it('requires a new CSV file and versioned idempotent confirmation to commit', async () => {
    const result = { job: { id: jobId, status: 'COMMITTED' }, errors: [] };
    commit.mockResolvedValue(result);
    await request(app.getHttpServer())
      .post(`/api/v1/imports/${jobId}/commit`)
      .set('If-Match', '"2"')
      .set('Idempotency-Key', 'commit-command')
      .attach('file', csv, {
        filename: 'assets.csv',
        contentType: 'text/csv',
      })
      .expect(200)
      .expect(result);
    expect(commit).toHaveBeenCalledWith(
      actor,
      jobId,
      2,
      'commit-command',
      expect.any(Buffer),
    );
  });

  it('rejects non-CSV uploads before calling the service', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/imports/assets/preview')
      .set('Idempotency-Key', 'text-command')
      .attach('file', Buffer.from('not csv'), {
        filename: 'assets.txt',
        contentType: 'text/plain',
      })
      .expect(400);
    expect(preview).not.toHaveBeenCalled();
  });

  it('rejects oversized uploads before the import service receives bytes', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/imports/assets/preview')
      .set('Idempotency-Key', 'oversized-command')
      .attach('file', Buffer.alloc(MAX_ASSET_IMPORT_BYTES + 1), {
        filename: 'assets.csv',
        contentType: 'text/csv',
      })
      .expect(413);
    expect(preview).not.toHaveBeenCalled();
  });
});
