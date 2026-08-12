import {
  GOOGLE_DRIVE_FILE_ID_PATTERN,
  GOOGLE_DRIVE_IMAGE_EXTENSIONS,
  GOOGLE_DRIVE_MAX_IMAGE_BYTES,
  googleDriveSourceFilename,
} from '../../lib/google-drive';

const errorResponse = (message: string, status: number) =>
  Response.json(
    { message },
    {
      status,
      headers: { 'Cache-Control': 'no-store' },
    },
  );

const readImageWithLimit = async (response: Response): Promise<Uint8Array<ArrayBuffer>> => {
  if (!response.body) return new Uint8Array(new ArrayBuffer(0));

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > GOOGLE_DRIVE_MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new RangeError('Google Drive image must be 8 MB or smaller.');
    }
    chunks.push(value);
  }

  const image = new Uint8Array(new ArrayBuffer(totalBytes));
  let offset = 0;
  for (const chunk of chunks) {
    image.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return image;
};

export async function GET(request: Request) {
  const fileId = new URL(request.url).searchParams.get('id');
  if (!fileId || !GOOGLE_DRIVE_FILE_ID_PATTERN.test(fileId)) {
    return errorResponse('The Google Drive link does not contain a valid file ID.', 400);
  }

  const downloadUrl = new URL('https://drive.usercontent.google.com/download');
  downloadUrl.searchParams.set('id', fileId);
  downloadUrl.searchParams.set('export', 'download');
  downloadUrl.searchParams.set('confirm', 't');

  let driveResponse: Response;
  try {
    driveResponse = await fetch(downloadUrl, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'follow',
    });
  } catch {
    return errorResponse('Google Drive could not be reached. Try again shortly.', 502);
  }

  if (!driveResponse.ok) {
    return errorResponse('Google Drive could not download this image. Set sharing to “Anyone with the link”.', 400);
  }

  const mimeType = driveResponse.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() || '';
  if (!(mimeType in GOOGLE_DRIVE_IMAGE_EXTENSIONS)) {
    return errorResponse('The Drive link must point directly to a JPEG, PNG, WebP, or GIF image.', 415);
  }

  const declaredBytes = Number(driveResponse.headers.get('content-length') ?? 0);
  if (declaredBytes > GOOGLE_DRIVE_MAX_IMAGE_BYTES) {
    return errorResponse('Google Drive image must be 8 MB or smaller.', 413);
  }

  let image: Uint8Array<ArrayBuffer>;
  try {
    image = await readImageWithLimit(driveResponse);
  } catch (error) {
    if (error instanceof RangeError) return errorResponse(error.message, 413);
    return errorResponse('Google Drive stopped while sending this image. Try again.', 502);
  }
  if (image.byteLength === 0) return errorResponse('Google Drive returned an empty image.', 400);

  const filename = googleDriveSourceFilename(driveResponse, fileId, mimeType);
  const fallbackFilename = `google-drive-${fileId}.${GOOGLE_DRIVE_IMAGE_EXTENSIONS[mimeType]}`;
  return new Response(image, {
    status: 200,
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `attachment; filename="${fallbackFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Length': String(image.byteLength),
      'Content-Type': mimeType,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
