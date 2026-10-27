import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AccessTokenGuard } from './access-token.guard.js';
import { AuthService } from './auth.service.js';
import { CurrentActor } from './current-actor.decorator.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import type { AuthenticatedActor, IssuedTokens } from './auth.types.js';

export const REFRESH_COOKIE_NAME = 'asset_refresh';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<IssuedTokens> {
    const result = await this.auth.login(dto);
    this.setRefreshCookie(response, result.refreshToken);
    return withoutRefreshToken(result);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<IssuedTokens> {
    const token = request.cookies?.[REFRESH_COOKIE_NAME];
    if (typeof token !== 'string') {
      throw new UnauthorizedException('A valid refresh session is required');
    }

    const result = await this.auth.refresh(token);
    this.setRefreshCookie(response, result.refreshToken);
    return withoutRefreshToken(result);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = request.cookies?.[REFRESH_COOKIE_NAME];
    await this.auth.logout(typeof token === 'string' ? token : undefined);
    this.clearRefreshCookie(response);
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  me(@CurrentActor() actor: AuthenticatedActor) {
    return {
      user: {
        id: actor.userId,
        organizationId: actor.organizationId,
        email: actor.email,
        displayName: actor.displayName,
        role: actor.role,
        mustChangePassword: actor.mustChangePassword,
        organization: {
          id: actor.organizationId,
          name: actor.organizationName,
        },
      },
      organization: {
        id: actor.organizationId,
        name: actor.organizationName,
      },
    };
  }

  @Post('password/change')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard)
  async changePassword(
    @CurrentActor() actor: AuthenticatedActor,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.changePassword(actor, dto);
    this.clearRefreshCookie(response);
  }

  private setRefreshCookie(response: Response, token: string): void {
    response.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
      maxAge:
        this.config.getOrThrow<number>('REFRESH_TOKEN_TTL_SECONDS') * 1000,
    });
  }

  private clearRefreshCookie(response: Response): void {
    response.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
    });
  }
}

function withoutRefreshToken(
  result: IssuedTokens & { refreshToken: string },
): IssuedTokens {
  const { refreshToken: _refreshToken, ...body } = result;
  return body;
}
