import { validateEnvironment } from './env.validation';

const validEnvironment = {
  FRONTEND_ORIGIN: 'http://localhost:3000',
  API_PUBLIC_URL: 'http://localhost:3001',
  DATABASE_URL: 'postgresql://postgres:password@localhost:5432/postgres',
  DIRECT_URL: 'postgresql://postgres:password@localhost:5432/postgres',
  REDIS_URL: 'redis://localhost:6379',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  CSRF_SECRET: 'test-csrf-secret-that-is-at-least-32-characters',
  RAZORPAY_KEY_ID: 'rzp_test_key',
  RAZORPAY_KEY_SECRET: 'secret',
  RAZORPAY_WEBHOOK_SECRET: 'webhook-secret',
  EMAIL_FROM: 'Glockery Home Centre <orders@example.com>',
  RESEND_API_KEY: 're_test_key',
};

describe('validateEnvironment', () => {
  it('accepts a valid environment and applies defaults', () => {
    expect(validateEnvironment(validEnvironment)).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3001,
      RATE_LIMIT_TTL_MS: 60_000,
      RATE_LIMIT_LIMIT: 100,
      ...validEnvironment,
    });
  });

  it('rejects incomplete configuration', () => {
    expect(() => validateEnvironment({ PORT: 'not-a-number' })).toThrow(
      'Invalid environment configuration',
    );
  });

  it('normalizes a Supabase REST endpoint to the project base URL', () => {
    expect(
      validateEnvironment({
        ...validEnvironment,
        SUPABASE_URL: 'https://example.supabase.co/rest/v1/',
      }).SUPABASE_URL,
    ).toBe('https://example.supabase.co');
  });

  it('normalizes the frontend URL to an exact origin', () => {
    expect(
      validateEnvironment({
        ...validEnvironment,
        FRONTEND_ORIGIN: 'https://www.glockery.com/store/',
      }).FRONTEND_ORIGIN,
    ).toBe('https://www.glockery.com');
  });

  it('parses additional comma-separated CORS origins and includes the primary origin', () => {
    expect(
      validateEnvironment({
        ...validEnvironment,
        FRONTEND_ORIGINS: 'https://admin.glockery.com, https://preview.glockery.com/',
      }).FRONTEND_ORIGINS,
    ).toEqual([
      'http://localhost:3000',
      'https://admin.glockery.com',
      'https://preview.glockery.com',
    ]);
  });

  it('rejects an invalid additional CORS origin', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        FRONTEND_ORIGINS: 'https://admin.glockery.com, not-a-url',
      }),
    ).toThrow('FRONTEND_ORIGINS: contains an invalid URL: not-a-url');
  });

  it('rejects localhost CORS in production unless explicitly enabled', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        FRONTEND_ORIGIN: 'https://shop.example.com',
        FRONTEND_ORIGINS: 'http://localhost:3000',
        API_PUBLIC_URL: 'https://api.example.com',
        CSRF_SECRET: 'production-csrf-secret-that-is-at-least-32-characters',
        ALLOW_TEST_PAYMENTS_IN_PRODUCTION: 'true',
      }),
    ).toThrow(
      'FRONTEND_ORIGINS.0: must use a public HTTPS origin in production unless localhost CORS is explicitly allowed',
    );

    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        FRONTEND_ORIGINS: 'https://admin.example.com',
        API_PUBLIC_URL: 'https://api.example.com',
        CSRF_SECRET: 'production-csrf-secret-that-is-at-least-32-characters',
        ALLOW_TEST_PAYMENTS_IN_PRODUCTION: 'true',
      }),
    ).toThrow(
      'FRONTEND_ORIGIN: must use a public HTTPS origin in production unless localhost CORS is explicitly allowed',
    );
  });

  it('allows localhost CORS in production only with an explicit opt-in', () => {
    expect(
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        FRONTEND_ORIGIN: 'https://shop.example.com',
        FRONTEND_ORIGINS: 'http://localhost:3000',
        ALLOW_LOCALHOST_CORS_IN_PRODUCTION: 'true',
        API_PUBLIC_URL: 'https://api.example.com',
        CSRF_SECRET: 'production-csrf-secret-that-is-at-least-32-characters',
        ALLOW_TEST_PAYMENTS_IN_PRODUCTION: 'true',
      }).FRONTEND_ORIGINS,
    ).toEqual(['https://shop.example.com', 'http://localhost:3000']);
  });

  it('rejects the development CSRF secret in production', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        CSRF_SECRET: 'development-only-csrf-secret-change-me',
      }),
    ).toThrow('must be a production secret');
  });

  it('rejects a localhost frontend origin in production', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        CSRF_SECRET: 'production-csrf-secret-that-is-at-least-32-characters',
      }),
    ).toThrow('must use a public HTTPS origin in production');
  });

  it('rejects Razorpay test keys in production unless staging explicitly opts in', () => {
    const production = {
      ...validEnvironment,
      NODE_ENV: 'production',
      FRONTEND_ORIGIN: 'https://shop.example.com',
      API_PUBLIC_URL: 'https://api.example.com',
      CSRF_SECRET: 'production-csrf-secret-that-is-at-least-32-characters',
    };

    expect(() => validateEnvironment(production)).toThrow(
      'test keys require ALLOW_TEST_PAYMENTS_IN_PRODUCTION=true',
    );
    expect(
      validateEnvironment({ ...production, ALLOW_TEST_PAYMENTS_IN_PRODUCTION: 'true' }),
    ).toMatchObject({ ALLOW_TEST_PAYMENTS_IN_PRODUCTION: true });
  });

  it('keeps the FSS gateway optional until it is enabled', () => {
    expect(validateEnvironment(validEnvironment)).toMatchObject({
      FSS_ENABLED: false,
      FSS_RESPONSE_MODE: 'redirect-body',
      FSS_CURRENCY_CODE: '356',
      FSS_LANGUAGE_ID: 'USA',
    });
    expect(
      validateEnvironment({ ...validEnvironment, FSS_MERCHANT_ID: '' }).FSS_MERCHANT_ID,
    ).toBeUndefined();
  });

  it('requires merchant credentials and gateway URL when FSS is enabled', () => {
    expect(() => validateEnvironment({ ...validEnvironment, FSS_ENABLED: 'true' })).toThrow(
      /FSS_MERCHANT_ID: is required when FSS_ENABLED=true.*FSS_PAYMENT_URL: is required/,
    );
    expect(
      validateEnvironment({
        ...validEnvironment,
        FSS_ENABLED: 'true',
        FSS_MERCHANT_ID: 'TP0001',
        FSS_MERCHANT_PASSWORD: 'secret',
        FSS_RESOURCE_KEY: 'k'.repeat(32),
        FSS_PAYMENT_URL: 'https://test-gateway.example.bank/PGServlet',
        FSS_RESPONSE_MODE: 'http-redirect',
      }),
    ).toMatchObject({ FSS_ENABLED: true, FSS_RESPONSE_MODE: 'http-redirect' });
  });

  it('rejects FSS resource keys that are not valid AES key sizes', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, FSS_RESOURCE_KEY: 'too-short' }),
    ).toThrow('must be a 16, 24 or 32 byte AES key');
  });

  it('rejects a plain HTTP FSS gateway URL in production', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        FRONTEND_ORIGIN: 'https://shop.example.com',
        API_PUBLIC_URL: 'https://api.example.com',
        CSRF_SECRET: 'production-csrf-secret-that-is-at-least-32-characters',
        RAZORPAY_KEY_ID: 'rzp_live_key',
        FSS_ENABLED: 'true',
        FSS_MERCHANT_ID: 'TP0001',
        FSS_MERCHANT_PASSWORD: 'secret',
        FSS_RESOURCE_KEY: 'k'.repeat(32),
        FSS_PAYMENT_URL: 'http://test-gateway.example.bank/PGServlet',
      }),
    ).toThrow('FSS_PAYMENT_URL: must use HTTPS in production');
  });
});
