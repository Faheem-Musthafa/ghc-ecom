import { z } from 'zod';

export function normalizeSupabaseUrl(value: string): string {
  return new URL(value).origin;
}

function normalizeOrigin(value: string): string {
  return new URL(value).origin;
}

function parseOrigins(value: string, context: z.RefinementCtx): string[] {
  const values = value.split(',').map((origin) => origin.trim());

  if (values.length === 0 || values.some((origin) => origin.length === 0)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'must be a comma-separated list of one or more URLs',
    });
    return z.NEVER;
  }

  const origins: string[] = [];
  for (const value of values) {
    const parsed = z.string().url().safeParse(value);
    if (!parsed.success) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `contains an invalid URL: ${value}`,
      });
      continue;
    }
    origins.push(normalizeOrigin(value));
  }

  return [...new Set(origins)];
}

function emptyStringToUndefined(value: unknown): unknown {
  return value === '' ? undefined : value;
}

function isEmailFrom(value: string): boolean {
  const bracketed = value.match(/^[^<>]+<([^<>]+)>$/);
  const email = bracketed?.[1]?.trim() ?? value.trim();
  return z.string().email().safeParse(email).success;
}

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().min(1).default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    API_BODY_LIMIT: z
      .string()
      .regex(/^\d+(?:kb|mb)$/i)
      .default('1mb'),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
    ENABLE_SWAGGER: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    HTTP_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(30_000),
    HTTP_HEADERS_TIMEOUT_MS: z.coerce.number().int().min(2_000).max(121_000).default(35_000),
    HTTP_KEEP_ALIVE_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(30_000).default(5_000),
    OUTBOUND_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(10_000),
    CSRF_SECRET: z.string().min(32).default('development-only-csrf-secret-change-me'),
    SESSION_REFRESH_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(3_600)
      .max(31_536_000)
      .default(2_592_000),
    FRONTEND_ORIGIN: z.string().url().transform(normalizeOrigin),
    FRONTEND_ORIGINS: z.preprocess(
      emptyStringToUndefined,
      z.string().transform(parseOrigins).optional(),
    ),
    ALLOW_LOCALHOST_CORS_IN_PRODUCTION: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    API_PUBLIC_URL: z.string().url(),
    DATABASE_URL: z.string().url(),
    DIRECT_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    RATE_LIMIT_TTL_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_LIMIT: z.coerce.number().int().positive().default(100),
    SUPABASE_URL: z.string().url().transform(normalizeSupabaseUrl),
    SUPABASE_ANON_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    RAZORPAY_KEY_ID: z.string().min(1),
    RAZORPAY_KEY_SECRET: z.string().min(1),
    RAZORPAY_WEBHOOK_SECRET: z.string().min(1),
    ALLOW_TEST_PAYMENTS_IN_PRODUCTION: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    EMAIL_FROM: z.string().min(1).refine(isEmailFrom, 'must be an email or Name <email>'),
    RESEND_API_KEY: z.string().min(1),
    NOTIFICATION_WEBHOOK_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
    NOTIFICATION_WEBHOOK_TOKEN: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
    SHIPPING_PROVIDER_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
    SHIPPING_PROVIDER_TOKEN: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
    SHIPPING_PROVIDER_NAME: z.string().min(1).default('manual'),
    ALERT_WEBHOOK_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
    ALERT_WEBHOOK_TOKEN: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
    RETURN_WINDOW_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  })
  .superRefine((environment, context) => {
    if (environment.HTTP_HEADERS_TIMEOUT_MS <= environment.HTTP_REQUEST_TIMEOUT_MS) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['HTTP_HEADERS_TIMEOUT_MS'],
        message: 'must be greater than HTTP_REQUEST_TIMEOUT_MS',
      });
    }
    if (
      environment.NODE_ENV === 'production' &&
      (environment.CSRF_SECRET.includes('replace-with') ||
        environment.CSRF_SECRET.includes('development-only'))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CSRF_SECRET'],
        message: 'must be a production secret',
      });
    }
    if (environment.NODE_ENV === 'production') {
      const api = new URL(environment.API_PUBLIC_URL);
      const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
      const frontendOrigins = [
        { origin: environment.FRONTEND_ORIGIN, path: ['FRONTEND_ORIGIN'] },
        ...(environment.FRONTEND_ORIGINS ?? []).map((origin, index) => ({
          origin,
          path: ['FRONTEND_ORIGINS', index],
        })),
      ];
      for (const { origin, path } of frontendOrigins) {
        const frontend = new URL(origin);
        const isLocalhost = localHosts.has(frontend.hostname);
        const localhostIsExplicitlyAllowed =
          environment.ALLOW_LOCALHOST_CORS_IN_PRODUCTION && isLocalhost;
        if (
          (frontend.protocol !== 'https:' && !localhostIsExplicitlyAllowed) ||
          (isLocalhost && !localhostIsExplicitlyAllowed)
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path,
            message:
              'must use a public HTTPS origin in production unless localhost CORS is explicitly allowed',
          });
        }
      }
      if (api.protocol !== 'https:' || localHosts.has(api.hostname)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['API_PUBLIC_URL'],
          message: 'must use a public HTTPS URL in production',
        });
      }
      if (
        environment.RAZORPAY_KEY_ID.startsWith('rzp_test_') &&
        !environment.ALLOW_TEST_PAYMENTS_IN_PRODUCTION
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['RAZORPAY_KEY_ID'],
          message: 'test keys require ALLOW_TEST_PAYMENTS_IN_PRODUCTION=true',
        });
      }
      for (const key of [
        'SUPABASE_SERVICE_ROLE_KEY',
        'RAZORPAY_KEY_SECRET',
        'RAZORPAY_WEBHOOK_SECRET',
        'RESEND_API_KEY',
      ] as const) {
        if (environment[key].toLowerCase().includes('replace-with')) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: 'must be configured with a production secret',
          });
        }
      }
    }
  })
  .transform((environment) => ({
    ...environment,
    // FRONTEND_ORIGIN remains the primary URL for redirects; always allow it in CORS.
    FRONTEND_ORIGINS: [
      ...new Set([environment.FRONTEND_ORIGIN, ...(environment.FRONTEND_ORIGINS ?? [])]),
    ],
  }));

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(config: Record<string, unknown>): Environment {
  const result = environmentSchema.safeParse(config);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  return result.data;
}
