import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../generated/prisma/enums.js';
import { AdministratorGuard } from './administrator.guard.js';

describe('AdministratorGuard', () => {
  const guard = new AdministratorGuard();

  it('allows administrators', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: UserRole.ADMINISTRATOR } }),
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies non-administrators', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: UserRole.ASSET_MANAGER } }),
      }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
