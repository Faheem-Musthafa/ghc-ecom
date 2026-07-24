import React, { ReactNode, useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import {
    IconGrid,
    IconLogOut,
    IconMenu,
    IconPackage,
    IconRefresh,
    IconShield,
    IconShoppingBag,
    IconTag,
    IconUser,
    IconClose,
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

    useEffect(() => {
        document.title = `${title} | Glockery Operations Console`;
        api.operations()
            .then((snapshot) => {
                if (typeof snapshot?.lowStockSkus === 'number') {
                    setLowStockCount(snapshot.lowStockSkus);
                }
            })
            .catch(() => {
                // Ignore error on background badge fetch
            });
    }, [title]);

    const navItems = [
        { href: '/admin', label: 'Overview', icon: <IconGrid size={18} />, exact: true },
        { href: '/admin/orders', label: 'Orders', icon: <IconShoppingBag size={18} /> },
        { href: '/admin/catalogue', label: 'Catalogue', icon: <IconPackage size={18} /> },
        { href: '/admin/inventory', label: 'Inventory', icon: <IconRefresh size={18} />, badge: lowStockCount },
        { href: '/admin/promotions', label: 'Promotions', icon: <IconTag size={18} /> },
        { href: '/admin/users', label: 'Users & Roles', icon: <IconUser size={18} /> },
        { href: '/admin/audit-logs', label: 'Audit Logs', icon: <IconShield size={18} /> },
        { href: '/admin/operations', label: 'Operations', icon: <IconGrid size={18} /> },
    ];

    return (
        <div className="min-h-screen bg-obsidian text-cream lg:grid lg:grid-cols-[260px_1fr]">
            {/* Sidebar Navigation */}
            <aside
                className={`fixed inset-y-0 left-0 z-40 w-[260px] border-r border-gold-500/20 bg-carbon/95 p-6 backdrop-blur-md transition-transform duration-300 lg:static lg:w-auto lg:translate-x-0 ${
                    mobileOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <div className="flex items-center justify-between">
                    <Link to="/" className="group block">
                        <span className="font-display text-2xl tracking-[0.18em] text-gold-300 transition-colors group-hover:text-gold-200">
                            GLOCKERY
                        </span>
                        <small className="mt-1 block text-[8px] font-bold tracking-[0.32em] text-cream/40 uppercase">
                            Operations Console
                        </small>
                    </Link>
                    <button
                        onClick={() => setMobileOpen(false)}
                        className="text-cream/40 hover:text-cream lg:hidden"
                        aria-label="Close Sidebar"
                    >
                        <IconClose size={20} />
                    </button>
                </div>

                {user && (
                    <div className="mt-6 flex items-center gap-3 rounded-md border border-gold-500/15 bg-obsidian/60 p-3">
                        <div className="flex size-8 items-center justify-center rounded-full bg-gold-400/15 font-display text-sm text-gold-300">
                            {(user.user_metadata?.full_name || user.email || 'A')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-cream">
                                {user.user_metadata?.full_name || 'Admin User'}
                            </p>
                            <p className="truncate text-[10px] text-gold-400/70">{user.email}</p>
                        </div>
                    </div>
                )}

                <nav className="mt-8 flex flex-col gap-1.5">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.href}
                            exact={item.exact}
                            to={item.href}
                            onClick={() => setMobileOpen(false)}
                            activeClassName="bg-gold-400 text-obsidian font-bold shadow-md shadow-gold-500/10 border-gold-400"
                            className="group flex items-center justify-between rounded-sm border border-transparent px-4 py-3 text-xs tracking-wider text-cream/60 transition-all hover:border-gold-500/30 hover:bg-gold-400/5 hover:text-gold-300"
                        >
                            <span className="flex items-center gap-3">
                                {item.icon}
                                {item.label}
                            </span>
                            {typeof item.badge === 'number' && item.badge > 0 && (
                                <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-300 border border-red-500/30">
                                    {item.badge}
                                </span>
                            )}
                        </NavLink>
                    ))}
                </nav>

                <div className="mt-auto pt-10">
                    <button
                        onClick={() => void signOut()}
                        className="flex w-full items-center gap-3 rounded-sm border border-red-500/20 px-4 py-2.5 text-xs text-red-300/80 transition-colors hover:bg-red-950/30 hover:text-red-200"
                    >
                        <IconLogOut size={16} />
                        Sign Out Console
                    </button>
                </div>
            </aside>

            {/* Main Area */}
            <div className="min-w-0 lg:col-start-2">
                {/* Top Header */}
                <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gold-500/15 bg-obsidian/90 px-6 backdrop-blur-md lg:px-10">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setMobileOpen(true)}
                            className="p-1 text-gold-400 lg:hidden"
                            aria-label="Open Navigation"
                        >
                            <IconMenu size={22} />
                        </button>
                        <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-950/30 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-400">
                            <span className="relative flex size-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
                            </span>
                            Live Backend Connected
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <Link
                            to="/"
                            className="text-[10px] uppercase tracking-[0.2em] text-cream/40 transition-colors hover:text-gold-300"
                        >
                            ← Return to Storefront
                        </Link>
                    </div>
                </header>

                {/* Page Content */}
                <main className="px-6 py-8 lg:px-10 lg:py-10">
                    <header className="mb-8 flex flex-wrap items-end justify-between gap-6 border-b border-gold-500/20 pb-6">
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.28em] font-semibold text-gold-400">
                                Operations command
                            </p>
                            <h1 className="mt-2 font-display text-4xl text-cream lg:text-5xl">{title}</h1>
                            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-cream/45">{description}</p>
                        </div>
                        {action && <div>{action}</div>}
                    </header>
                    {children}
                </main>
            </div>
        </div>
    );
};

export default AdminShell;
