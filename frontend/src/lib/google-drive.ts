const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const FILE_ID_PATTERN = /^[A-Za-z0-9_-]{10,200}$/;
const IMAGE_EXTENSIONS: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
};

const googleDriveFileId = (value: string): string => {
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
    if (!fileId || !FILE_ID_PATTERN.test(fileId)) {
        throw new Error('The Google Drive link does not contain a valid file ID.');
    }
    return fileId;
};

const sourceFilename = (response: Response, fileId: string, mimeType: string): string => {
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
    return safeName || `google-drive-${fileId}.${IMAGE_EXTENSIONS[mimeType]}`;
};

export const downloadGoogleDriveImage = async (driveUrl: string): Promise<File> => {
    const fileId = googleDriveFileId(driveUrl);
    const downloadUrl = new URL('https://drive.usercontent.google.com/download');
    downloadUrl.searchParams.set('id', fileId);
    downloadUrl.searchParams.set('export', 'download');
    downloadUrl.searchParams.set('confirm', 't');

    let response: Response;
    try {
        response = await fetch(downloadUrl, {
            method: 'GET',
            mode: 'cors',
            credentials: 'omit',
        });
    } catch {
        throw new Error('Your browser could not download this Google Drive image. Confirm it is shared with “Anyone with the link”.');
    }
    if (!response.ok) {
        throw new Error('Google Drive could not download this image. Set sharing to “Anyone with the link”.');
    }

    const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() || '';
    if (!(mimeType in IMAGE_EXTENSIONS)) {
        throw new Error('The Drive link must point directly to a JPEG, PNG, WebP, or GIF image.');
    }
    const declaredBytes = Number(response.headers.get('content-length') ?? 0);
    if (declaredBytes > MAX_IMAGE_BYTES) {
        throw new Error('Google Drive image must be 8 MB or smaller.');
    }

    const blob = await response.blob();
    if (blob.size === 0) throw new Error('Google Drive returned an empty image.');
    if (blob.size > MAX_IMAGE_BYTES) throw new Error('Google Drive image must be 8 MB or smaller.');
    return new File([blob], sourceFilename(response, fileId, mimeType), { type: mimeType });
};
