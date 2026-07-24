import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { api, getSession } from '../lib/api';
import { Session } from '../types';

interface AuthContextValue {
    session: Session | null;
    signedIn: boolean;
    sync: () => void;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [session, setSession] = useState(getSession);
    const [ready, setReady] = useState(false);
    const sync = () => setSession(getSession());

    useEffect(() => {
        let active = true;
        window.addEventListener('ghc:session', sync);
        void api.initializeSession().finally(() => {
            if (active) {
                sync();
                setReady(true);
            }
        });
        return () => {
            active = false;
            window.removeEventListener('ghc:session', sync);
        };
    }, []);

    if (!ready) {
        return (
            <div className="grid min-h-screen place-items-center bg-ink-950 text-cream-100" role="status">
                <span className="sr-only">Restoring your secure session</span>
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-gold-400 border-t-transparent" aria-hidden="true" />
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{
            session,
            signedIn: Boolean(session),
            sync,
            signOut: async () => { await api.logout(); sync(); },
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const value = useContext(AuthContext);
    if (!value) throw new Error('useAuth must be used inside AuthProvider');
    return value;
};
