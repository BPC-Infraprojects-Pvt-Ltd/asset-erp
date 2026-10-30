import { jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  Controller,
  HttpException,
  Logger,
  Post,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Prisma } from '../generated/prisma/client.js';
import { ProblemDetailsFilter } from './problem-details.filter.js';

const handleRequest = jest.fn<() => unknown>();

@Controller('diagnostics')
class DiagnosticsController {
  @Post(':id')
  handle() {
    return handleRequest();
  }
}

describe('ProblemDetailsFilter HTTP contract (no database)', () => {
  let app: INestApplication;
  let logError: jest.SpiedFunction<Logger['error']>;
  const route = '/api/v1/diagnostics/:id';
  const url = '/api/v1/diagnostics/example';

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [DiagnosticsController],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use('/api/v1/before-route', () => handleRequest());
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
  });

  beforeEach(() => {
    handleRequest.mockReset();
    logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
  });

  afterEach(() => logError.mockRestore());
  afterAll(async () => app.close());

  function failWith(exception: unknown) {
    handleRequest.mockImplementation(() => {
      throw exception;
    });
  }

  it('logs correlated diagnostics without request data, query inputs or raw error messages', async () => {
    const exception = new Prisma.PrismaClientKnownRequestError(
      'private-error-value\n    at private-message-frame (/private-input.ts:1:2)',
      {
        code: 'P2021',
        clientVersion: 'test',
        meta: { query: 'private-query-input' },
      },
    );
    exception.cause = new Error('private-cause-value');
    exception.stack = [
      `${exception.name}: ${exception.message}`,
      '    at AssetsService.list (D:\\app\\assets.service.ts:120:9)',
      '    at async /app/controller.ts:42:5',
      '    at handle (file:///D:/app/handler.ts:10:3)',
      '    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)',
      '    at private-eval-frame (eval at handler, private-source)',
      '    at remote (https://example.test/private-source.js:1:2)',
      '    at query (file:///D:/app/query.js?private-query-value:1:2)',
    ].join('\n');
    failWith(exception);
    const privateUrl =
      '/api/v1/diagnostics/private-route-value?search=private-query-value';

    const response = await request(app.getHttpServer())
      .post(privateUrl)
      .set('Authorization', 'Bearer private-header-value')
      .set('Cookie', 'refreshToken=private-cookie-value')
      .send({ password: 'private-body-value' })
      .expect(500)
      .expect('Content-Type', /application\/problem\+json/);

    const correlationId: unknown = response.body.correlationId;
    if (typeof correlationId !== 'string') {
      throw new TypeError('Expected a string correlationId in the response');
    }
    expect(response.body).toEqual({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      detail: 'An unexpected server error occurred.',
      instance: privateUrl,
      correlationId: expect.any(String),
    });
    expect(correlationId).toBe(response.headers['x-correlation-id']);
    expect(correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith({
      message: `Unhandled API exception (${correlationId})`,
      correlationId,
      method: 'POST',
      route,
      errorType: 'PrismaClientKnownRequestError',
      errorCode: 'P2021',
      stackLocations: [
        'D:\\app\\assets.service.ts:120:9',
        '/app/controller.ts:42:5',
        'file:///D:/app/handler.ts:10:3',
        'node:internal/process/task_queues:105:5',
      ],
    });
    expect(JSON.stringify(logError.mock.calls)).not.toContain('private-');
  });

  it('retains source locations from a real runtime error stack', async () => {
    failWith(new TypeError('private-error-value'));

    await request(app.getHttpServer()).post(url).expect(500);

    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({
        errorType: 'TypeError',
        stackLocations: expect.arrayContaining([
          expect.stringMatching(/problem-details\.filter\.spec\.ts:\d+:\d+$/),
        ]),
      }),
    );
    expect(JSON.stringify(logError.mock.calls)).not.toContain('private-');
  });

  it.each([
    ['code', 'P2022'],
    ['code', '42P01'],
    ['code', 'ECONNREFUSED'],
    ['errorCode', 'P1001'],
  ])('retains machine error %s=%s', async (field, code) => {
    failWith(
      Object.assign(new Error('private-error-value'), { [field]: code }),
    );

    await request(app.getHttpServer()).post(url).expect(500);

    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: code }),
    );
  });

  it.each([
    'private-code-value',
    { value: 'private-code-value' },
    'E'.repeat(100),
  ])('omits non-machine error codes %#', async (code) => {
    failWith(Object.assign(new Error('private-error-value'), { code }));

    await request(app.getHttpServer()).post(url).expect(500);

    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: undefined }),
    );
    expect(JSON.stringify(logError.mock.calls)).not.toContain('private-');
  });

  it.each([undefined, 'private-custom-stack\n    at /private-source.ts:1:2'])(
    'handles missing or unrecognized stacks without dumping them %#',
    async (stack) => {
      const exception = new Error('private-error-value');
      exception.stack = stack;
      failWith(exception);

      await request(app.getHttpServer()).post(url).expect(500);

      expect(logError).toHaveBeenCalledWith(
        expect.objectContaining({ errorType: 'Error', stackLocations: [] }),
      );
      expect(JSON.stringify(logError.mock.calls)).not.toContain('private-');
    },
  );

  it.each([
    null,
    undefined,
    'private-thrown-value',
    { value: 'private-thrown-value' },
  ])(
    'handles non-Error throws without serializing their contents %#',
    async (exception) => {
      failWith(exception);

      await request(app.getHttpServer()).post(url).expect(500);

      expect(logError).toHaveBeenCalledWith(
        expect.objectContaining({ errorType: typeof exception }),
      );
      expect(JSON.stringify(logError.mock.calls)).not.toContain('private-');
    },
  );

  it('does not fall back to logging a raw URL when no route has matched', async () => {
    failWith(new Error('private-error-value'));

    await request(app.getHttpServer())
      .post('/api/v1/before-route?token=private-query-value')
      .expect(500);

    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', route: undefined }),
    );
    expect(JSON.stringify(logError.mock.calls)).not.toContain('private-');
  });

  it.each([
    [
      new BadRequestException({ message: ['Invalid name', 'Invalid version'] }),
      400,
      'Invalid name; Invalid version',
    ],
    [
      new ConflictException('Asset changed; reload and review'),
      409,
      'Asset changed; reload and review',
    ],
    [new HttpException('Access denied', 403), 403, 'Access denied'],
  ])(
    'preserves expected HTTP errors without unhandled-error logging %#',
    async (exception, status, detail) => {
      failWith(exception);

      const response = await request(app.getHttpServer())
        .post(url)
        .expect(status)
        .expect('Content-Type', /application\/problem\+json/);

      expect(response.body).toMatchObject({
        type: 'about:blank',
        status,
        detail,
        instance: url,
      });
      expect(response.body.correlationId).toBe(
        response.headers['x-correlation-id'],
      );
      expect(logError).not.toHaveBeenCalled();
    },
  );

  it('leaves successful requests unchanged', async () => {
    handleRequest.mockReturnValue({ ok: true });

    await request(app.getHttpServer())
      .post(url)
      .expect(201)
      .expect({ ok: true });

    expect(logError).not.toHaveBeenCalled();
  });
});
