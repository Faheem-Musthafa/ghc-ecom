import React, { createContext, ReactNode, useContext, useState } from 'react';
import { IconCheckCircle, IconAlert, IconClose } from '../components/Icons';

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextValue {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const showToast = (message: string, type: ToastType = 'info') => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4000);
    };

    const removeToast = (id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
                {toasts.map((toast) => {
                    const bg =
                        toast.type === 'error'
                            ? 'bg-red-950/90 border-red-500/40 text-red-200'
                            : toast.type === 'success'
                            ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
                            : 'bg-carbon/90 border-gold-500/40 text-gold-200';

                    return (
                        <div
                            key={toast.id}
                            className={`pointer-events-auto flex items-center justify-between border p-4 text-xs shadow-2xl backdrop-blur-md rounded-sm animate-slideUp ${bg}`}
                        >
                            <div className="flex items-center gap-3">
                                {toast.type === 'success' ? (
                                    <IconCheckCircle size={18} color="#10B981" />
                                ) : (
                                    <IconAlert size={18} />
                                )}
                                <span>{toast.message}</span>
                            </div>
                            <button aria-label="Close notification" onClick={() => removeToast(toast.id)} className="ml-3 opacity-60 hover:opacity-100">
                                <IconClose size={14} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        return { showToast: () => {} };
    }
    return context;
};
