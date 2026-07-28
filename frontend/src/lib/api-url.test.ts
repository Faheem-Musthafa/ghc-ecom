import { describe, expect, it } from 'vitest';
import { resolveApiBaseUrl } from './api-url';

describe('resolveApiBaseUrl', () => {
    it('defaults to the same-origin API proxy', () => {
        expect(resolveApiBaseUrl()).toBe('/api/v1');
    });

    it('normalizes the dotenv assignment accidentally pasted into a Vercel value', () => {
        expect(resolveApiBaseUrl('VITE_API_URL=/api/v1')).toBe('/api/v1');
    });

    it('removes trailing slashes from valid API URLs', () => {
        expect(resolveApiBaseUrl('/api/v1/')).toBe('/api/v1');
        expect(resolveApiBaseUrl('https://api.example.com/api/v1/')).toBe(
            'https://api.example.com/api/v1',
        );
    });

    it('rejects malformed relative values', () => {
        expect(() => resolveApiBaseUrl('api/v1')).toThrow(
            'VITE_API_URL must be a root-relative path or an HTTP(S) URL',
        );
    });
});
