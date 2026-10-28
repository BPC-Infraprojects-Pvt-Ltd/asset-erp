import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '../generated/prisma/client.js';
import bcrypt from 'bcryptjs';
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import type {
  AccessTokenClaims,
  AuthenticatedActor,
  AuthenticatedUser,
  IssuedTokens,
  RefreshTokenClaims,
} from './auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';

interface AuthUser {
  id: string;
  organizationId: string;
  email: string;
  displayName: string;
  passwordHash: string;
  role: AuthenticatedUser['role'];
  isActive: boolean;
  mustChangePassword: boolean;
  version: number;
  organization: {
    id: string;
    name: string;
    isActive: boolean;
  };
}

@Injectable()
export class AuthService {
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlSeconds: number;
  private readonly dummyPasswordHash = bcrypt.hash(
    randomBytes(32).toString('hex'),
    12,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.accessTtlSeconds = this.config.getOrThrow<number>(
      'ACCESS_TOKEN_TTL_SECONDS',
    );
    this.refreshTtlSeconds = this.config.getOrThrow<number>(
      'REFRESH_TOKEN_TTL_SECONDS',
    );
  }

  async login(dto: LoginDto): Promise<IssuedTokens & { refreshToken: string }> {
    const email = dto.email.trim().toLowerCase();
    if (Buffer.byteLength(dto.password, 'utf8') > 72) {
      throw new UnauthorizedException(
        'Invalid organization, email, or password',
      );
    }

    const user = await this.prisma.user.findFirst({
      where: {
        organizationId: dto.organizationId,
        email,
      },
      include: { organization: true },
    });
    const storedHash = user?.passwordHash ?? (await this.dummyPasswordHash);
    const passwordMatches = await bcrypt.compare(dto.password, storedHash);

    if (
      !user ||
      !user.isActive ||
      !user.organization.isActive ||
      !passwordMatches
    ) {
      throw new UnauthorizedException(
        'Invalid organization, email, or password',
      );
    }

    const familyId = randomUUID();
    return this.createSession(this.prisma, user, familyId, randomUUID());
  }

  async refresh(
    rawToken: string,
  ): Promise<IssuedTokens & { refreshToken: string }> {
    const claims = await this.verifyRefreshToken(rawToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { id: claims.sessionId },
      include: {
        user: { include: { organization: true } },
      },
    });

    if (
      !session ||
      session.familyId !== claims.familyId ||
      session.organizationId !== claims.organizationId ||
      session.userId !== claims.sub ||
      session.user.version !== claims.version ||
      !equalHash(session.tokenHash, hashToken(rawToken))
    ) {
      throw new UnauthorizedException('A valid refresh session is required');
    }

    const now = new Date();
    if (session.rotatedAt) {
      await this.revokeFamily(
        session.organizationId,
        session.userId,
        session.familyId,
        now,
      );
      throw new UnauthorizedException('Refresh-token reuse detected');
    }
    if (session.revokedAt || session.expiresAt <= now) {
      throw new UnauthorizedException('A valid refresh session is required');
    }
    if (
      !session.user.isActive ||
      !session.user.organization.isActive ||
      session.user.version !== claims.version
    ) {
      await this.revokeFamily(
        session.organizationId,
        session.userId,
        session.familyId,
        now,
      );
      throw new UnauthorizedException('A valid refresh session is required');
    }

    const user: AuthUser = session.user;
    const nextSessionId = randomUUID();
    const issued = await this.issueTokens(
      user,
      session.familyId,
      nextSessionId,
    );

    try {
      const rotated = await this.prisma.$transaction(
        async (transaction) => {
          const updated = await transaction.refreshSession.updateMany({
            where: {
              id: session.id,
              tokenHash: session.tokenHash,
              rotatedAt: null,
              revokedAt: null,
              expiresAt: { gt: now },
            },
            data: { rotatedAt: now },
          });

          if (updated.count !== 1) {
            await transaction.refreshSession.updateMany({
              where: {
                organizationId: session.organizationId,
                userId: session.userId,
                familyId: session.familyId,
                revokedAt: null,
              },
              data: { revokedAt: now },
            });
            return false;
          }

          await transaction.refreshSession.create({
            data: {
              id: nextSessionId,
              familyId: session.familyId,
              organizationId: session.organizationId,
              userId: session.userId,
              tokenHash: hashToken(issued.refreshToken),
              expiresAt: new Date(
                now.getTime() + this.refreshTtlSeconds * 1000,
              ),
            },
          });
          return true;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      if (!rotated) {
        throw new UnauthorizedException('Refresh session is no longer active');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      if (isPrismaCode(error, 'P2034')) {
        await this.revokeFamily(
          session.organizationId,
          session.userId,
          session.familyId,
          now,
        );
        throw new UnauthorizedException('Refresh session is no longer active');
      }
      throw error;
    }

    return issued;
  }

  async logout(rawToken?: string): Promise<void> {
    if (!rawToken) {
      return;
    }

    let claims: RefreshTokenClaims;
    try {
      claims = await this.jwt.verifyAsync<RefreshTokenClaims>(rawToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        issuer: 'asset-erp',
        audience: 'asset-erp-client',
        ignoreExpiration: true,
      });
    } catch {
      return;
    }

    if (
      claims.tokenUse !== 'refresh' ||
      !claims.sub ||
      !claims.organizationId ||
      !claims.familyId
    ) {
      return;
    }

    await this.revokeFamily(
      claims.organizationId,
      claims.sub,
      claims.familyId,
      new Date(),
    );
  }

  async changePassword(
    actor: AuthenticatedActor,
    dto: ChangePasswordDto,
  ): Promise<void> {
    if (
      Buffer.byteLength(dto.currentPassword, 'utf8') > 72 ||
      Buffer.byteLength(dto.newPassword, 'utf8') > 72
    ) {
      throw new BadRequestException(
        'Password exceeds the supported byte-length limit',
      );
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: actor.userId,
        organizationId: actor.organizationId,
        isActive: true,
        version: actor.version,
      },
    });
    if (!user) {
      throw new ConflictException('The account changed; sign in again');
    }
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException('The current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    const now = new Date();
    await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.user.updateMany({
        where: {
          id: actor.userId,
          organizationId: actor.organizationId,
          version: actor.version,
          isActive: true,
        },
        data: {
          passwordHash,
          mustChangePassword: false,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('The account changed; sign in again');
      }

      await transaction.refreshSession.updateMany({
        where: {
          organizationId: actor.organizationId,
          userId: actor.userId,
          revokedAt: null,
        },
        data: { revokedAt: now },
      });
    });
  }

  toAuthenticatedUser(user: AuthUser): AuthenticatedUser {
    return {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      organization: {
        id: user.organization.id,
        name: user.organization.name,
      },
    };
  }

  private async createSession(
    database: PrismaService | Prisma.TransactionClient,
    user: AuthUser,
    familyId: string,
    sessionId: string,
  ): Promise<IssuedTokens & { refreshToken: string }> {
    const issued = await this.issueTokens(user, familyId, sessionId);
    await database.refreshSession.create({
      data: {
        id: sessionId,
        familyId,
        organizationId: user.organizationId,
        userId: user.id,
        tokenHash: hashToken(issued.refreshToken),
        expiresAt: new Date(Date.now() + this.refreshTtlSeconds * 1000),
      },
    });
    return issued;
  }

  private async issueTokens(
    user: AuthUser,
    familyId: string,
    sessionId: string,
  ): Promise<IssuedTokens & { refreshToken: string }> {
    const claims = {
      sub: user.id,
      organizationId: user.organizationId,
      sessionId,
      familyId,
      version: user.version,
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        { ...claims, tokenUse: 'access' } satisfies AccessTokenClaims,
        {
          secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
          expiresIn: this.accessTtlSeconds,
          issuer: 'asset-erp',
          audience: 'asset-erp-client',
        },
      ),
      this.jwt.signAsync(
        { ...claims, tokenUse: 'refresh' } satisfies RefreshTokenClaims,
        {
          secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
          expiresIn: this.refreshTtlSeconds,
          issuer: 'asset-erp',
          audience: 'asset-erp-client',
        },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTtlSeconds,
      user: this.toAuthenticatedUser(user),
    };
  }

  private async verifyRefreshToken(token: string): Promise<RefreshTokenClaims> {
    let claims: RefreshTokenClaims;
    try {
      claims = await this.jwt.verifyAsync<RefreshTokenClaims>(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        issuer: 'asset-erp',
        audience: 'asset-erp-client',
      });
    } catch {
      throw new UnauthorizedException('A valid refresh session is required');
    }

    if (
      claims.tokenUse !== 'refresh' ||
      !claims.sub ||
      !claims.organizationId ||
      !claims.sessionId ||
      !claims.familyId ||
      !Number.isInteger(claims.version)
    ) {
      throw new UnauthorizedException('A valid refresh session is required');
    }
    return claims;
  }

  private async revokeFamily(
    organizationId: string,
    userId: string,
    familyId: string,
    revokedAt: Date,
  ): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: {
        organizationId,
        userId,
        familyId,
        revokedAt: null,
      },
      data: { revokedAt },
    });
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function equalHash(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function isPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  );
}
