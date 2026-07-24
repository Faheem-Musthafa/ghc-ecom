import React, { useEffect, useState } from 'react';
import { IconAlert } from './Icons';

export const OfflineBanner: React.FC = () => {
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (!isOffline) return null;

    return (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-2 border-b border-red-500/40 bg-red-950/90 px-4 py-2 text-xs text-red-200 backdrop-blur-md animate-fadeIn">
            <IconAlert size={16} />
            <span>Network connection offline. Some backend features may be temporarily unavailable.</span>
        </div>
    );
};
export default OfflineBanner;
