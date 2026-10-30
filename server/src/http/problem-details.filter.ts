import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { STATUS_CODES } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const correlationId = randomUUID();
    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    const detail =
      exception instanceof HttpException
        ? getDetail(exception)
        : 'An unexpected server error occurred.';

    if (!(exception instanceof HttpException)) {
      const route: unknown = request.route;
      this.logger.error({
        message: `Unhandled API exception (${correlationId})`,
        correlationId,
        method: request.method,
        route:
          typeof route === 'object' &&
          route !== null &&
          'path' in route &&
          typeof route.path === 'string'
            ? route.path
            : undefined,
        ...getErrorDiagnostics(exception),
      });
    }

    response
      .setHeader('X-Correlation-ID', correlationId)
      .status(status)
      .type('application/problem+json')
      .json({
        type: 'about:blank',
        title: STATUS_CODES[status] ?? 'Error',
        status,
        detail,
        instance: request.originalUrl,
        correlationId,
      });
  }
}

function getErrorDiagnostics(exception: unknown) {
  if (!(exception instanceof Error)) {
    return { errorType: typeof exception };
  }

  const code: unknown =
    'code' in exception
      ? exception.code
      : 'errorCode' in exception
        ? exception.errorCode
        : undefined;
  const header = Error.prototype.toString.call(exception);
  const stack = exception.stack;
  // Prisma messages can span lines and contain query inputs; omit the full header.
  const stackLocations = stack?.startsWith(`${header}\n`)
    ? stack
        .slice(header.length)
        .split('\n')
        .flatMap((line) => {
          const location = line.match(
            /^\s+at (?:async )?(?:.* \()?((?:file:\/\/\/|[A-Za-z]:[\\/]|\/|node:)[^()\r\n?#]+:\d+:\d+)\)?$/,
          )?.[1];
          return location ? [location] : [];
        })
    : [];

  return {
    errorType: exception.constructor.name,
    errorCode:
      typeof code === 'string' &&
      /^(?:P\d{4}|[0-9A-Z]{5}|E[A-Z_]{1,63})$/.test(code)
        ? code
        : undefined,
    stackLocations,
  };
}

function getDetail(exception: HttpException): string {
  const body: unknown = exception.getResponse();
  if (typeof body === 'string') {
    return body;
  }
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const message = body.message;
    if (typeof message === 'string') {
      return message;
    }
    if (
      Array.isArray(message) &&
      message.every((item) => typeof item === 'string')
    ) {
      return message.join('; ');
    }
  }
  return exception.message;
}
