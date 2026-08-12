import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadGoogleDriveImage } from './google-drive';

const driveUrl = 'https://drive.google.com/file/d/17Ek09Bk3NjFvdUgxTUtd4fjH94yYkis6/view?usp=drive_link';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Google Drive browser download', () => {
  it('uses the same-origin app route instead of fetching Google cross-site', async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([137, 80, 78, 71]), {
      status: 200,
      headers: {
        'content-disposition': 'attachment; filename="catalogue.png"',
        'content-length': '4',
        'content-type': 'image/png',
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const file = await downloadGoogleDriveImage(driveUrl);

    expect(file.name).toBe('catalogue.png');
    expect(file.type).toBe('image/png');
    expect(fetchMock).toHaveBeenCalledWith(
      '/google-drive?id=17Ek09Bk3NjFvdUgxTUtd4fjH94yYkis6',
      { method: 'GET', credentials: 'same-origin' },
    );
  });

  it('shows the server error returned for an inaccessible Drive file', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(
      { message: 'Google Drive could not download this image. Set sharing to “Anyone with the link”.' },
      { status: 400 },
    )));

    await expect(downloadGoogleDriveImage(driveUrl)).rejects.toThrow(
      'Google Drive could not download this image. Set sharing to “Anyone with the link”.',
    );
  });
});
