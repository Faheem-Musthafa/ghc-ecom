import React from 'react';
import { useDialog } from '../hooks/useDialog';
import { IconAlert, IconClose } from './Icons';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDanger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    title,
    message,
    confirmLabel = 'Confirm Action',
    cancelLabel = 'Cancel',
    isDanger = false,
    onConfirm,
    onCancel,
}) => {
    const titleId = 'confirmation-dialog-title';
    const descriptionId = 'confirmation-dialog-description';
    const dialogRef = useDialog<HTMLDivElement>(isOpen, onCancel);
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-5 backdrop-blur-sm animate-fadeIn">
            <div ref={dialogRef} tabIndex={-1} className="w-full max-w-md border border-line bg-carbon p-6 shadow-2xl outline-none" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
                <div className="flex items-center justify-between border-b border-gold-500/20 pb-4">
                    <div className="flex items-center gap-2">
                        <span className={isDanger ? 'text-red-400' : 'text-gold-400'}>
                            <IconAlert size={20} />
                        </span>
                        <h3 id={titleId} className="font-display text-2xl text-cream">{title}</h3>
                    </div>
                    <button onClick={onCancel} aria-label="Close confirmation" className="text-cream/40 hover:text-cream">
                        <IconClose size={18} />
                    </button>
                </div>
                <p id={descriptionId} className="mt-4 text-xs leading-relaxed text-cream/70">{message}</p>
                <div className="mt-6 flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="rounded-sm border border-gold-500/20 bg-carbon px-4 py-2.5 text-xs text-cream/70 hover:text-cream hover:border-gold-400"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`rounded-sm px-5 py-2.5 text-xs font-bold uppercase tracking-wider ${
                            isDanger
                                ? 'bg-red-500 text-white hover:bg-red-600'
                                : 'bg-gold-400 text-obsidian hover:bg-gold-300'
                        }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};
export default ConfirmModal;
