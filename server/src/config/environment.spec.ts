import { validateEnvironment } from './environment.js';

const validEnvironment = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/asset_erp',
  JWT_ACCESS_SECRET: 'test-access-secret-not-for-deployment-0001',
  JWT_REFRESH_SECRET: 'test-refresh-secret-not-for-deployment-0002',
};

describe('validateEnvironment', () => {
  it('requires independent strong JWT secrets', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        JWT_REFRESH_SECRET: validEnvironment.JWT_ACCESS_SECRET,
      }),
    ).toThrow('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');

    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        JWT_ACCESS_SECRET: 'short',
      }),
    ).toThrow('JWT_ACCESS_SECRET must be at least 32 characters');
  });

  it('requires an explicit frontend origin in production', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
      }),
    ).toThrow('WEB_ORIGIN is required in production');
  });

  it('uses bounded token lifetimes when not configured', () => {
    expect(validateEnvironment(validEnvironment)).toMatchObject({
      ACCESS_TOKEN_TTL_SECONDS: 600,
      REFRESH_TOKEN_TTL_SECONDS: 2_592_000,
      PORT: 3000,
    });
  });
});
