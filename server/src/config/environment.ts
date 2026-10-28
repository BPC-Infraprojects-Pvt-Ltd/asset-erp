export interface ApplicationEnvironment extends Record<string, unknown> {
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  ACCESS_TOKEN_TTL_SECONDS: number;
  REFRESH_TOKEN_TTL_SECONDS: number;
  PORT: number;
  NODE_ENV: string;
  WEB_ORIGIN?: string;
}

export function validateEnvironment(
  input: Record<string, unknown>,
): ApplicationEnvironment {
  const databaseUrl = requiredString(input, 'DATABASE_URL');
  if (!/^postgres(?:ql)?:\/\//.test(databaseUrl)) {
    throw new Error('DATABASE_URL must use the PostgreSQL protocol');
  }

  const accessSecret = requiredSecret(input, 'JWT_ACCESS_SECRET');
  const refreshSecret = requiredSecret(input, 'JWT_REFRESH_SECRET');
  if (accessSecret === refreshSecret) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
  }

  const nodeEnv = optionalString(input, 'NODE_ENV') ?? 'development';
  const webOrigin = optionalString(input, 'WEB_ORIGIN');
  if (nodeEnv === 'production' && !webOrigin) {
    throw new Error('WEB_ORIGIN is required in production');
  }
  if (webOrigin) {
    try {
      const parsedOrigin = new URL(webOrigin);
      if (
        parsedOrigin.origin !== webOrigin.replace(/\/$/, '') ||
        parsedOrigin.pathname !== '/'
      ) {
        throw new Error();
      }
    } catch {
      throw new Error('WEB_ORIGIN must be an origin without a path');
    }
  }

  return {
    ...input,
    DATABASE_URL: databaseUrl,
    JWT_ACCESS_SECRET: accessSecret,
    JWT_REFRESH_SECRET: refreshSecret,
    ACCESS_TOKEN_TTL_SECONDS: positiveInteger(
      input,
      'ACCESS_TOKEN_TTL_SECONDS',
      600,
      1800,
    ),
    REFRESH_TOKEN_TTL_SECONDS: positiveInteger(
      input,
      'REFRESH_TOKEN_TTL_SECONDS',
      2_592_000,
      7_776_000,
    ),
    PORT: positiveInteger(input, 'PORT', 3000, 65535),
    NODE_ENV: nodeEnv,
    WEB_ORIGIN: webOrigin,
  };
}

function requiredString(input: Record<string, unknown>, name: string): string {
  const value = optionalString(input, name);
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function requiredSecret(input: Record<string, unknown>, name: string): string {
  const value = requiredString(input, name);
  if (value.length < 32) {
    throw new Error(`${name} must be at least 32 characters`);
  }
  return value;
}

function optionalString(
  input: Record<string, unknown>,
  name: string,
): string | undefined {
  const value = input[name];
  return typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : undefined;
}

function positiveInteger(
  input: Record<string, unknown>,
  name: string,
  defaultValue: number,
  maximum: number,
): number {
  const raw = optionalString(input, name);
  if (!raw) {
    return defaultValue;
  }

  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(
      `${name} must be a positive integer no greater than ${maximum}`,
    );
  }
  return parsed;
}
