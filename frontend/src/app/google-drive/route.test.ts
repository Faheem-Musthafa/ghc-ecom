// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';
import { GOOGLE_DRIVE_MAX_IMAGE_BYTES } from '../../lib/google-drive';
import { GET } from './route';

const fileId = '17Ek09Bk3NjFvdUgxTUtd4fjH94yYkis6';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Google Drive image route', () => {
  it('downloads a public Drive image server-side and returns it to the browser', async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([137, 80, 78, 71]), {
      status: 200,
      headers: {
        'content-disposition': 'attachment; filename="catalogue.png"',
        'content-length': '4',
        'content-type': 'image/png',
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(new Request(`http://localhost/google-drive?id=${fileId}`));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('content-disposition')).toContain("filename*=UTF-8''catalogue.png");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([137, 80, 78, 71]));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({ hostname: 'drive.usercontent.google.com' }),
      expect.objectContaining({ cache: 'no-store', redirect: 'follow' }),
    );
  });

  it('rejects invalid file IDs without contacting an external host', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(new Request('http://localhost/google-drive?id=../../private'));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects non-image Drive files', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Drive page</html>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })));

    const response = await GET(new Request(`http://localhost/google-drive?id=${fileId}`));

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toEqual({
      message: 'The Drive link must point directly to a JPEG, PNG, WebP, or GIF image.',
    });
  });

  it('stops an image stream that exceeds the size limit without declaring its length', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(GOOGLE_DRIVE_MAX_IMAGE_BYTES + 1));
      },
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    })));

    const response = await GET(new Request(`http://localhost/google-drive?id=${fileId}`));

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      message: 'Google Drive image must be 8 MB or smaller.',
    });
  });
});
