const DEFAULT_API_BASE_URL = '/api/v1';
const ENV_ASSIGNMENT_PREFIX = /^VITE_API_URL\s*=\s*/i;

export function resolveApiBaseUrl(value?: string): string {
    const configured = value?.trim().replace(ENV_ASSIGNMENT_PREFIX, '').trim();
    const candidate = configured || DEFAULT_API_BASE_URL;
    const isRootRelative = candidate.startsWith('/') && !candidate.startsWith('//');
    const isHttpUrl = /^https?:\/\//i.test(candidate);

    if (!isRootRelative && !isHttpUrl) {
        throw new Error('VITE_API_URL must be a root-relative path or an HTTP(S) URL');
    }

    return candidate.replace(/\/+$/, '');
}
