import React, { ReactNode, useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDialog } from '../hooks/useDialog';
import { api } from '../lib/api';
import {
    IconArrowRight,
    IconClose,
    IconGrid,
    IconLogOut,
    IconMenu,
    IconPackage,
    IconRefresh,
    IconShield,
    IconShoppingBag,
    IconTag,
    IconUser,
} from './Icons';

interface AdminShellProps {
    title: string;
    description: string;
    action?: ReactNode;
    children: ReactNode;
}

const AdminShell: React.FC<AdminShellProps> = ({ title, description, action, children }) => {
    const { session, signOut } = useAuth();
    const user = session?.user;
    const [mobileOpen, setMobileOpen] = useState(false);
    const [lowStockCount, setLowStockCount] = useState<number | null>(null);
    const [connection, setConnection] = useState<'checking' | 'connected' | 'unavailable'>('checking');
    const mobileNavRef = useDialog<HTMLDivElement>(mobileOpen, () => setMobileOpen(false));

    useEffect(() => {
        document.title = `${title} | Glockery Admin`;
        api.operations()
            .then((snapshot) => {
                setConnection('connected');
                if (typeof snapshot?.lowStockSkus === 'number') setLowStockCount(snapshot.lowStockSkus);
            })
            .catch(() => setConnection('unavailable'));
    }, [title]);

    const navItems = [
        { href: '/admin', label: 'Overview', icon: <IconGrid size={18} />, exact: true },
        { href: '/admin/orders', label: 'Orders', icon: <IconShoppingBag size={18} /> },
        { href: '/admin/catalogue', label: 'Catalogue', icon: <IconPackage size={18} /> },
        { href: '/admin/inventory', label: 'Inventory', icon: <IconRefresh size={18} />, badge: lowStockCount },
        { href: '/admin/promotions', label: 'Promotions', icon: <IconTag size={18} /> },
        { href: '/admin/users', label: 'Users & roles', icon: <IconUser size={18} /> },
        { href: '/admin/audit-logs', label: 'Audit logs', icon: <IconShield size={18} /> },
        { href: '/admin/operations', label: 'System health', icon: <IconGrid size={18} /> },
    ];

    const connectionLabel = connection === 'checking' ? 'Checking API' : connection === 'connected' ? 'API connected' : 'API unavailable';

    const sidebar = (
        <aside className="flex h-full flex-col border-r border-line bg-carbon p-5">
            <div className="flex h-14 items-center justify-between border-b border-line pb-5">
                <Link to="/" className="flex items-center gap-3" aria-label="Glockery storefront">
                    <span className="grid size-9 place-items-center border border-gold-400 font-display text-xl font-semibold text-gold-300">G</span>
                    <span>
                        <span className="block text-sm font-bold tracking-[0.2em] text-cream">GLOCKERY</span>
                        <small className="block text-[8px] uppercase tracking-[0.22em] text-cream/40">Administration</small>
                    </span>
                </Link>
                <button onClick={() => setMobileOpen(false)} className="grid size-11 place-items-center text-cream/50 lg:hidden" aria-label="Close navigation"><IconClose size={20} /></button>
            </div>

            <nav className="mt-6 space-y-1" aria-label="Admin navigation">
                {navItems.map((item) => (
                    <NavLink
                        key={item.href}
                        exact={item.exact}
                        to={item.href}
                        onClick={() => setMobileOpen(false)}
                        activeClassName="border-gold-400 bg-panel text-cream"
                        className="flex min-h-11 items-center justify-between border-l-2 border-transparent px-3 text-xs font-medium text-cream/55 hover:bg-panel hover:text-cream"
                    >
                        <span className="flex items-center gap-3">{item.icon}{item.label}</span>
                        {typeof item.badge === 'number' && item.badge > 0 && (
                            <span className="min-w-5 bg-red-950 px-1.5 py-0.5 text-center text-[9px] font-bold tabular-nums text-red-300">{item.badge}</span>
                        )}
                    </NavLink>
                ))}
            </nav>

            <div className="mt-auto border-t border-line pt-5">
                {user && (
                    <div className="mb-4 flex items-center gap-3 px-2">
                        <span className="grid size-9 shrink-0 place-items-center bg-gold-400 text-xs font-bold text-obsidian">{(user.user_metadata?.full_name || user.email || 'A')[0].toUpperCase()}</span>
                        <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-cream">{user.user_metadata?.full_name || 'Admin user'}</p>
                            <p className="truncate text-[10px] text-cream/35">{user.email}</p>
                        </div>
                    </div>
                )}
                <button onClick={() => void signOut()} className="flex min-h-11 w-full items-center gap-3 px-3 text-xs text-red-300/75 hover:bg-red-950/30 hover:text-red-200">
                    <IconLogOut size={17} /> Sign out
                </button>
            </div>
        </aside>
    );

    return (
        <div className="min-h-screen bg-obsidian font-body text-cream lg:grid lg:grid-cols-[244px_minmax(0,1fr)]">
            <div className="hidden lg:sticky lg:top-0 lg:block lg:h-screen">{sidebar}</div>

            {mobileOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <button className="absolute inset-0 bg-black/70" onClick={() => setMobileOpen(false)} aria-label="Close navigation overlay" />
                    <div ref={mobileNavRef} tabIndex={-1} className="absolute inset-y-0 left-0 w-[min(86vw,300px)] outline-none" role="dialog" aria-modal="true" aria-label="Admin navigation">{sidebar}</div>
                </div>
            )}

            <div className="min-w-0">
                <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-obsidian/95 px-4 supports-[backdrop-filter]:backdrop-blur-md sm:px-7 lg:px-9">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setMobileOpen(true)} className="grid size-11 place-items-center text-gold-300 lg:hidden" aria-label="Open navigation"><IconMenu size={21} /></button>
                        <span className={`size-2 ${connection === 'connected' ? 'bg-emerald-500' : connection === 'checking' ? 'bg-amber-400' : 'bg-red-500'}`} aria-hidden="true" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cream/45">{connectionLabel}</span>
                    </div>
                    <Link to="/" className="flex min-h-11 items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-cream/45 hover:text-gold-200">
                        Storefront <IconArrowRight size={14} />
                    </Link>
                </header>

                <main className="px-4 py-7 sm:px-7 lg:px-9 lg:py-9">
                    <header className="mb-8 flex flex-col gap-5 border-b border-line pb-7 md:flex-row md:items-end md:justify-between">
                        <div>
                            <p className="eyebrow">Admin workspace</p>
                            <h1 className="mt-2 font-display text-4xl font-semibold leading-none text-cream sm:text-5xl">{title}</h1>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-cream/45">{description}</p>
                        </div>
                        {action && <div className="shrink-0">{action}</div>}
                    </header>
                    {children}
                </main>
            </div>
        </div>
    );
};

export default AdminShell;
