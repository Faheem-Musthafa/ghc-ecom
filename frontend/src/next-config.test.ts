// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

const originalVercel = process.env.VERCEL;
const originalNextAdapterPath = process.env.NEXT_ADAPTER_PATH;
const originalFormActionOrigins = process.env.PAYMENT_FORM_ACTION_ORIGINS;

afterEach(() => {
  if (originalVercel === undefined) {
    delete process.env.VERCEL;
  } else {
    process.env.VERCEL = originalVercel;
  }
  if (originalNextAdapterPath === undefined) {
    delete process.env.NEXT_ADAPTER_PATH;
  } else {
    process.env.NEXT_ADAPTER_PATH = originalNextAdapterPath;
  }
  if (originalFormActionOrigins === undefined) {
    delete process.env.PAYMENT_FORM_ACTION_ORIGINS;
  } else {
    process.env.PAYMENT_FORM_ACTION_ORIGINS = originalFormActionOrigins;
  }
  vi.resetModules();
});

const cspFor = async () => {
  const { default: config } = await import('../next.config.mjs');
  const [route] = await config.headers!();
  return route.headers.find((header) => header.key === 'Content-Security-Policy')!.value;
};

describe('payment gateway form-action policy', () => {
  it('only allows same-origin form posts by default', async () => {
    delete process.env.PAYMENT_FORM_ACTION_ORIGINS;
    vi.resetModules();

    expect(await cspFor()).toContain("form-action 'self';");
  });

  it('allow-lists configured bank gateway origins', async () => {
    process.env.PAYMENT_FORM_ACTION_ORIGINS = 'https://test-gateway.example.bank/PGServlet, https://pay.example.bank';
    vi.resetModules();

    expect(await cspFor()).toContain(
      "form-action 'self' https://test-gateway.example.bank https://pay.example.bank;",
    );
  });

  it('rejects non-HTTPS gateway origins', async () => {
    process.env.PAYMENT_FORM_ACTION_ORIGINS = 'http://insecure.example.bank';
    vi.resetModules();

    await expect(import('../next.config.mjs')).rejects.toThrow('HTTPS origins only');
  });
});

describe('deployment output', () => {
  it('lets Vercel manage the deployment output', async () => {
    process.env.VERCEL = '1';
    vi.resetModules();

    const { default: config } = await import('../next.config.mjs');

    expect(config.output).toBeUndefined();
  });

  it('uses a strict script policy and does not expose an open image proxy', async () => {
    const { default: config } = await import('../next.config.mjs');
    expect(config.headers).toBeDefined();
    const headerGroups = await config.headers!();
    const csp = headerGroups[0].headers.find(
      (header: { key: string }) => header.key === 'Content-Security-Policy',
    )?.value;

    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(config.images?.remotePatterns).toEqual([]);
    expect(config.images?.maximumRedirects).toBe(0);
  });

  it('lets an injected Next adapter manage the deployment output', async () => {
    delete process.env.VERCEL;
    process.env.NEXT_ADAPTER_PATH = '/tmp/platform-adapter.js';
    vi.resetModules();

    const { default: config } = await import('../next.config.mjs');

    expect(config.output).toBeUndefined();
  });

  it('retains standalone output for self-hosted builds', async () => {
    delete process.env.VERCEL;
    delete process.env.NEXT_ADAPTER_PATH;
    vi.resetModules();

    const { default: config } = await import('../next.config.mjs');

    expect(config.output).toBe('standalone');
  });
});
