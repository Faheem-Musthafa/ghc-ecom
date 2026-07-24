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
  EMAIL_FROM: 'orders@example.com',
  SMTP_HOST: 'smtp.example.com',
  SMTP_USER: 'smtp-user',
  SMTP_PASSWORD: 'smtp-password',
};

describe('validateEnvironment', () => {
  it('accepts a valid environment and applies defaults', () => {
    expect(validateEnvironment(validEnvironment)).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3001,
      RATE_LIMIT_TTL_MS: 60_000,
      RATE_LIMIT_LIMIT: 100,
      SMTP_PORT: 587,
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

  it('rejects the development CSRF secret in production', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        CSRF_SECRET: 'development-only-csrf-secret-change-me',
      }),
    ).toThrow('must be a production secret');
  });
});
