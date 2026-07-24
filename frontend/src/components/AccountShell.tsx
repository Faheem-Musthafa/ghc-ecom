import React, { ReactNode, useEffect, useRef } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { IconLogOut, IconMapPin, IconPackage, IconUser } from './Icons';

const AccountShell = ({ title, intro, children }: { title: string; intro: string; children: ReactNode }) => {
    const { session, signOut } = useAuth();
    const location = useLocation();
    const tabsRef = useRef<HTMLElement | null>(null);
    useEffect(() => { document.title = `${title} | Glockery`; }, [title]);
    useEffect(() => {
        tabsRef.current?.scrollTo({ left: 0, behavior: 'auto' });
    }, [location.pathname]);
    const links = [
        ['/account', 'Profile', <IconUser />],
        ['/account/addresses', 'Addresses', <IconMapPin />],
        ['/account/orders', 'Orders', <IconPackage />],
    ];
    return (
        <div className="min-h-screen bg-obsidian text-cream">
            <header className="flex h-20 items-center justify-between border-b border-gold-500/20 px-6 sm:px-10"><Link to="/" className="font-display text-2xl tracking-[0.2em] text-gold-300">GLOCKERY</Link><Link to="/" className="text-[10px] uppercase tracking-[0.2em] text-cream/40 hover:text-gold-300">Continue shopping</Link></header>
            <div className="mx-auto grid max-w-[1280px] gap-10 px-6 py-12 sm:px-10 lg:grid-cols-[260px_1fr] lg:px-12 lg:py-20">
                <aside>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-gold-400">Private client</p><h2 className="mt-3 truncate font-display text-2xl">{session?.user?.user_metadata?.full_name || session?.user?.email || 'Your account'}</h2>
                    <nav ref={tabsRef} className="mt-8 flex gap-2 overflow-x-auto overscroll-contain lg:flex-col">{links.map(([href, label, icon]) => <NavLink exact={href === '/account'} key={String(href)} to={String(href)} activeClassName="border-gold-400 bg-gold-400 text-obsidian" className="flex min-w-max items-center gap-3 border border-gold-500/20 px-4 py-3 text-xs text-cream/55 transition hover:border-gold-400 hover:text-gold-300">{icon}{label}</NavLink>)}</nav>
                    <button onClick={() => void signOut()} className="mt-5 flex items-center gap-3 px-4 py-3 text-xs text-cream/35 hover:text-red-300"><IconLogOut /> Sign out</button>
                </aside>
                <main id="main-content"><header className="mb-10 border-b border-gold-500/20 pb-8"><p className="text-[10px] uppercase tracking-[0.3em] text-gold-400">Your account</p><h1 className="mt-4 font-display text-5xl">{title}</h1><p className="mt-4 text-sm leading-7 text-cream/45">{intro}</p></header>{children}</main>
            </div>
        </div>
    );
};
export default AccountShell;
