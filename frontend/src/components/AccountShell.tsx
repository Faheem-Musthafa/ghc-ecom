import React, { ReactNode, useEffect, useRef } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWishlist } from '../contexts/WishlistContext';
import { IconArrowRight, IconHeart, IconLogOut, IconMapPin, IconPackage, IconUser } from './Icons';
import Header from './Header';
import StoreFooter from './StoreFooter';

const AccountShell = ({ title, intro, children }: { title: string; intro: string; children: ReactNode }) => {
    const { session, signOut } = useAuth();
    const { wishlistIds } = useWishlist();
    const location = useLocation();
    const tabsRef = useRef<HTMLElement | null>(null);

    useEffect(() => { document.title = `${title} | Glockery Home Centre`; }, [title]);
    useEffect(() => { tabsRef.current?.scrollTo({ left: 0, behavior: 'auto' }); }, [location.pathname]);

    const links = [
        ['/account', 'Profile', <IconUser size={18} key="user" />],
        ['/account/addresses', 'Addresses', <IconMapPin size={18} key="pin" />],
        ['/account/orders', 'Orders', <IconPackage size={18} key="pkg" />],
        ['/account/wishlist', `Wishlist (${wishlistIds.length})`, <IconHeart size={18} key="heart" />],
    ];

    const userName = session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'Member';
    const userEmail = session?.user?.email || '';
    const initials = userName.slice(0, 2).toUpperCase();

    return (
        <div className="flex min-h-screen flex-col justify-between bg-obsidian font-body text-cream">
            <Header />
            <div className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-8 sm:px-8 lg:px-12 lg:py-14">
                <header className="mb-10 flex flex-col gap-7 border-b border-line pb-8 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-5">
                        <span className="grid size-14 shrink-0 place-items-center bg-gold-400 text-sm font-bold text-obsidian">{initials}</span>
                        <div>
                            <p className="eyebrow">Your account</p>
                            <h1 className="mt-1 font-display text-3xl font-semibold text-cream sm:text-4xl">Welcome, {userName}</h1>
                            <p className="mt-1 text-xs text-cream/40">{userEmail}</p>
                        </div>
                    </div>
                    <Link to="/search" className="button-secondary gap-2">Continue shopping <IconArrowRight size={15} /></Link>
                </header>

                <div className="grid gap-9 lg:grid-cols-[230px_minmax(0,1fr)]">
                    <aside>
                        <nav ref={tabsRef} className="flex gap-2 overflow-x-auto border-b border-line pb-4 lg:flex-col lg:overflow-visible lg:border-b-0 lg:pb-0" aria-label="Account navigation">
                            {links.map(([href, label, icon]) => (
                                <NavLink exact={href === '/account'} key={String(href)} to={String(href)} activeClassName="border-gold-400 bg-panel text-cream" className="flex min-h-12 shrink-0 items-center gap-3 border-l-2 border-transparent px-3 text-xs font-medium text-cream/55 hover:bg-panel hover:text-cream">
                                    {icon}<span>{label}</span>
                                </NavLink>
                            ))}
                        </nav>
                        <button onClick={() => void signOut()} className="mt-4 flex min-h-12 w-full items-center gap-3 border-t border-line px-3 text-xs text-red-300/75 hover:text-red-200"><IconLogOut size={18} /> Sign out</button>
                    </aside>

                    <main id="main-content" className="min-w-0">
                        <header className="mb-7">
                            <p className="eyebrow">Account</p>
                            <h2 className="mt-2 font-display text-4xl font-semibold text-cream sm:text-5xl">{title}</h2>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-cream/50">{intro}</p>
                        </header>
                        {children}
                    </main>
                </div>
            </div>
            <StoreFooter />
        </div>
    );
};

export default AccountShell;
