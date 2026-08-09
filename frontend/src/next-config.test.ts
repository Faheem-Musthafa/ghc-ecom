// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

const originalVercel = process.env.VERCEL;
const originalNextAdapterPath = process.env.NEXT_ADAPTER_PATH;

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
  vi.resetModules();
});

describe('deployment output', () => {
  it('lets Vercel manage the deployment output', async () => {
    process.env.VERCEL = '1';
    vi.resetModules();

    const { default: config } = await import('../next.config.mjs');

    expect(config.output).toBeUndefined();
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
