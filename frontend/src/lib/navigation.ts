export const openTrustedUrl = (value: string): boolean => {
    try {
        const url = new URL(value, window.location.origin);
        const localDevelopmentUrl =
            url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
        if (url.protocol !== 'https:' && !localDevelopmentUrl) return false;

        const opened = window.open(url.toString(), '_blank', 'noopener,noreferrer');
        if (opened) opened.opener = null;
        return Boolean(opened);
    } catch {
        return false;
    }
};
