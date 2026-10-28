import type { UserRole } from '../generated/prisma/enums.js';

export interface AccessTokenClaims {
  sub: string;
  organizationId: string;
  sessionId: string;
  familyId: string;
  version: number;
  tokenUse: 'access';
}

export interface RefreshTokenClaims {
  sub: string;
  organizationId: string;
  sessionId: string;
  familyId: string;
  version: number;
  tokenUse: 'refresh';
}

export interface AuthenticatedActor {
  userId: string;
  organizationId: string;
  sessionId: string;
  familyId: string;
  email: string;
  displayName: string;
  organizationName: string;
  role: UserRole;
  mustChangePassword: boolean;
  version: number;
}

export interface AuthenticatedUser {
  id: string;
  organizationId: string;
  email: string;
  displayName: string;
  role: UserRole;
  mustChangePassword: boolean;
  organization: {
    id: string;
    name: string;
  };
}

export interface IssuedTokens {
  accessToken: string;
  expiresIn: number;
  user: AuthenticatedUser;
}
