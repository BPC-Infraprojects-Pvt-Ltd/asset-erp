import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedActor } from './auth.types.js';

@Injectable()
export class AdministratorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedActor }>();
    if (request.user?.role !== 'ADMINISTRATOR') {
      throw new ForbiddenException('Administrator access is required');
    }
    return true;
  }
}
