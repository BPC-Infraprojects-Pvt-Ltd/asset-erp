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
      this.logger.error(`Unhandled API exception (${correlationId})`);
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
