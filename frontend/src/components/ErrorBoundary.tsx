import React, { Component, ErrorInfo, ReactNode } from 'react';
import { IconAlert, IconRefresh } from './Icons';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Unhandled React Error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex min-h-screen items-center justify-center bg-obsidian p-6 text-cream">
                    <div className="w-full max-w-lg rounded-sm border border-gold-500/30 bg-carbon p-8 text-center shadow-2xl">
                        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-red-950/40 border border-red-500/30 text-red-400">
                            <IconAlert size={32} />
                        </div>
                        <span className="mt-6 block text-[10px] font-semibold uppercase tracking-[0.3em] text-gold-400">
                            System Exception (500)
                        </span>
                        <h1 className="mt-2 font-display text-3xl text-cream">Something went unexpected.</h1>
                        <p className="mt-3 text-xs leading-relaxed text-cream/60">
                            The application encountered an unexpected error. Reload the page, or contact support if it continues.
                        </p>
                        {import.meta.env.DEV && this.state.error && (
                            <div className="mt-4 overflow-x-auto rounded-sm border border-gold-500/15 bg-obsidian p-3 text-left font-mono text-[11px] text-red-300/80">
                                {this.state.error.message}
                            </div>
                        )}
                        <div className="mt-8 flex justify-center gap-4">
                            <button
                                onClick={() => window.location.reload()}
                                className="flex items-center gap-2 rounded-sm bg-gold-400 px-6 py-3 text-xs font-bold uppercase tracking-wider text-obsidian shadow-md hover:bg-gold-300"
                            >
                                <IconRefresh size={16} /> Reload Page
                            </button>
                            <a
                                href="/"
                                className="flex items-center gap-2 rounded-sm border border-gold-500/30 bg-carbon px-6 py-3 text-xs font-semibold text-cream hover:border-gold-400"
                            >
                                Return Home
                            </a>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
export default ErrorBoundary;
