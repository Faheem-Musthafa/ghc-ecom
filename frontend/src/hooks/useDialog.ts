import { RefObject, useEffect, useRef } from 'react';

const focusableSelector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

interface DialogOptions {
    initialFocusRef?: RefObject<HTMLElement | null>;
    focusInitial?: boolean;
}

export const useDialog = <T extends HTMLElement>(
    isOpen: boolean,
    onClose: () => void,
    options: DialogOptions = {},
) => {
    const dialogRef = useRef<T>(null);
    const closeRef = useRef(onClose);
    closeRef.current = onClose;

    useEffect(() => {
        if (!isOpen) return;
        const dialog = dialogRef.current;
        const previouslyFocused = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const focusDialog = window.requestAnimationFrame(() => {
            const firstFocusable = dialog?.querySelector<HTMLElement>(focusableSelector);
            const target = options.focusInitial === false
                ? dialog
                : options.initialFocusRef?.current ?? firstFocusable ?? dialog;
            target?.focus({ preventScroll: true });
        });

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeRef.current();
                return;
            }
            if (event.key !== 'Tab' || !dialog) return;
            const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
                .filter((element) => !element.hasAttribute('hidden') && element.offsetParent !== null);
            if (focusable.length === 0) {
                event.preventDefault();
                dialog.focus();
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            window.cancelAnimationFrame(focusDialog);
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = previousOverflow;
            previouslyFocused?.focus({ preventScroll: true });
        };
    }, [isOpen, options.focusInitial, options.initialFocusRef]);

    return dialogRef;
};
