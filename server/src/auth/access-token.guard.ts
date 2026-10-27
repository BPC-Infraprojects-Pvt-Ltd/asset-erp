import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AccessTokenClaims, AuthenticatedActor } from './auth.types.js';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedActor }>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentication is required');
    }

    let claims: AccessTokenClaims;
    try {
      claims = await this.jwt.verifyAsync<AccessTokenClaims>(
        authorization.slice('Bearer '.length),
        {
          secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
          issuer: 'asset-erp',
          audience: 'asset-erp-client',
        },
      );
    } catch {
      throw new UnauthorizedException('Authentication is required');
    }

    if (
      claims.tokenUse !== 'access' ||
      !claims.sub ||
      !claims.organizationId ||
      !claims.sessionId ||
      !claims.familyId ||
      !Number.isInteger(claims.version)
    ) {
      throw new UnauthorizedException('Authentication is required');
    }

    const now = new Date();
    const session = await this.prisma.refreshSession.findFirst({
      where: {
        id: claims.sessionId,
        familyId: claims.familyId,
        organizationId: claims.organizationId,
        userId: claims.sub,
        rotatedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
    });
    if (!session) {
      throw new UnauthorizedException('Authentication is required');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: claims.sub,
        organizationId: claims.organizationId,
        isActive: true,
        version: claims.version,
        organization: { isActive: true },
      },
      select: {
        id: true,
        organizationId: true,
        email: true,
        displayName: true,
        role: true,
        mustChangePassword: true,
        version: true,
        organization: {
          select: {
            name: true,
          },
        },
      },
    });
    if (!user) {
      throw new UnauthorizedException('Authentication is required');
    }

    request.user = {
      userId: user.id,
      organizationId: user.organizationId,
      sessionId: claims.sessionId,
      familyId: claims.familyId,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      organizationName: user.organization.name,
      mustChangePassword: user.mustChangePassword,
      version: user.version,
    };
    return true;
  }
}
