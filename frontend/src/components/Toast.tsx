import React, { useEffect } from 'react';
import { useCart } from '../contexts/CartContext';
import { IconCheckCircle, IconClose } from './Icons';

const Toast = () => {
    const { toastMessage, clearToast } = useCart();
    useEffect(() => {
        if (!toastMessage) return;
        const timer = window.setTimeout(clearToast, 3200);
        return () => window.clearTimeout(timer);
    }, [toastMessage, clearToast]);
    if (!toastMessage) return null;
    return (
        <div className="fixed bottom-5 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 border border-line bg-carbon px-5 py-4 text-sm text-cream shadow-2xl shadow-black" role="status">
            <IconCheckCircle className="shrink-0 text-gold-400" color="currentColor" />
            <span className="flex-1">{toastMessage}</span>
            <button onClick={clearToast} aria-label="Close notification"><IconClose size={16} /></button>
        </div>
    );
};

export default Toast;
