import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedActor } from './auth.types.js';

export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedActor => {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: AuthenticatedActor }>();
    return request.user;
  },
);
