import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { api, getSession } from '../lib/api';
import { Session } from '../types';

interface AuthContextValue {
    session: Session | null;
    signedIn: boolean;
    isInitializing: boolean;
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

    return (
        <AuthContext.Provider value={{
            session,
            signedIn: Boolean(session),
            isInitializing: !ready,
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
