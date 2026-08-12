export const GOOGLE_DRIVE_MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const GOOGLE_DRIVE_FILE_ID_PATTERN = /^[A-Za-z0-9_-]{10,200}$/;
export const GOOGLE_DRIVE_IMAGE_EXTENSIONS: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
};

export const googleDriveFileId = (value: string): string => {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new Error('Enter a valid Google Drive file link.');
    }
    if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com') {
        throw new Error('Only HTTPS links from drive.google.com are accepted.');
    }
    const pathMatch = url.pathname.match(/^\/file\/d\/([^/]+)/);
    const fileId = pathMatch?.[1] ?? url.searchParams.get('id');
    if (!fileId || !GOOGLE_DRIVE_FILE_ID_PATTERN.test(fileId)) {
        throw new Error('The Google Drive link does not contain a valid file ID.');
    }
    return fileId;
};

export const googleDriveSourceFilename = (response: Response, fileId: string, mimeType: string): string => {
    const disposition = response.headers.get('content-disposition');
    const encodedName = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const quotedName = disposition?.match(/filename="([^"]+)"/i)?.[1];
    let suppliedName = quotedName;
    if (encodedName) {
        try {
            suppliedName = decodeURIComponent(encodedName);
        } catch {
            suppliedName = undefined;
        }
    }
    const safeName = suppliedName?.split(/[\\/]/).pop()?.slice(0, 180);
    return safeName || `google-drive-${fileId}.${GOOGLE_DRIVE_IMAGE_EXTENSIONS[mimeType]}`;
};

export const downloadGoogleDriveImage = async (driveUrl: string): Promise<File> => {
    const fileId = googleDriveFileId(driveUrl);
    const downloadUrl = `/google-drive?id=${encodeURIComponent(fileId)}`;

    let response: Response;
    try {
        response = await fetch(downloadUrl, {
            method: 'GET',
            credentials: 'same-origin',
        });
    } catch {
        throw new Error('The app could not request this Google Drive image. Check your connection and try again.');
    }
    if (!response.ok) {
        let message = 'Google Drive could not download this image. Set sharing to “Anyone with the link”.';
        try {
            const body = await response.json() as { message?: unknown };
            if (typeof body.message === 'string' && body.message.trim()) message = body.message;
        } catch {
            // Keep the stable fallback when an intermediary returns a non-JSON error.
        }
        throw new Error(message);
    }

    const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() || '';
    if (!(mimeType in GOOGLE_DRIVE_IMAGE_EXTENSIONS)) {
        throw new Error('The Drive link must point directly to a JPEG, PNG, WebP, or GIF image.');
    }
    const declaredBytes = Number(response.headers.get('content-length') ?? 0);
    if (declaredBytes > GOOGLE_DRIVE_MAX_IMAGE_BYTES) {
        throw new Error('Google Drive image must be 8 MB or smaller.');
    }

    const blob = await response.blob();
    if (blob.size === 0) throw new Error('Google Drive returned an empty image.');
    if (blob.size > GOOGLE_DRIVE_MAX_IMAGE_BYTES) throw new Error('Google Drive image must be 8 MB or smaller.');
    return new File([blob], googleDriveSourceFilename(response, fileId, mimeType), { type: mimeType });
};
