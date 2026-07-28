import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useWishlist } from '../contexts/WishlistContext';
import { api } from '../lib/api';
import { Category } from '../types';
import {
    IconArrowRight,
    IconClose,
    IconHeart,
    IconMenu,
    IconSearch,
    IconShoppingBag,
    IconUser,
} from './Icons';
import QuickSearchModal from './QuickSearchModal';

const Header = () => {
    const { itemCount, openCart } = useCart();
    const { signedIn } = useAuth();
    const { wishlistIds } = useWishlist();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);
    const location = useLocation();

    useEffect(() => {
        api.categories().then(setCategories).catch(() => setCategories([]));
    }, []);

    useEffect(() => {
        setMobileOpen(false);
    }, [location.pathname]);

    const countBadge = (count: number) => count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid min-h-4 min-w-4 place-items-center bg-gold-400 px-1 text-[9px] font-bold leading-none text-obsidian">
            {count > 99 ? '99+' : count}
        </span>
    );

    return (
        <>
            <a
                href="#main-content"
                className="fixed left-3 top-3 z-50 -translate-y-24 bg-gold-400 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-obsidian focus:translate-y-0"
            >
                Skip to content
            </a>

            <div className="border-b border-gold-500/20 bg-gold-400 px-4 py-2 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-obsidian">
                Complimentary delivery above ₹1,000 · Easy 30-day returns
            </div>

            <header className="sticky top-0 z-40 border-b border-line bg-obsidian/95 supports-[backdrop-filter]:backdrop-blur-md">
                <div className="mx-auto flex h-[76px] max-w-[1440px] items-center gap-5 px-4 sm:px-8 lg:px-12">
                    <button
                        className="grid size-11 shrink-0 place-items-center text-gold-300 lg:hidden"
                        onClick={() => setMobileOpen((open) => !open)}
                        aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
                        aria-expanded={mobileOpen}
                        aria-controls="mobile-navigation"
                    >
                        {mobileOpen ? <IconClose size={21} /> : <IconMenu size={21} />}
                    </button>

                    <Link to="/" className="flex shrink-0 items-center gap-3" aria-label="Glockery Home Centre">
                        <span className="grid size-10 place-items-center border border-gold-400 font-display text-2xl font-semibold text-gold-300">G</span>
                        <span className="leading-none">
                            <span className="block text-base font-bold tracking-[0.24em] text-cream sm:text-lg">GLOCKERY</span>
                            <small className="mt-1.5 block text-[8px] font-semibold uppercase tracking-[0.38em] text-cream/45">Home Centre</small>
                        </span>
                    </Link>

                    <nav className="ml-6 hidden h-full items-center gap-7 lg:flex" aria-label="Primary navigation">
                        <NavLink exact to="/" activeClassName="text-gold-300" className="flex h-full items-center border-b border-transparent text-[11px] font-semibold uppercase tracking-[0.14em] text-cream/65 hover:border-gold-400 hover:text-cream">
                            Shop all
                        </NavLink>
                        {categories.slice(0, 4).map((category) => (
                            <NavLink
                                key={category.id}
                                to={`/category/${category.slug}`}
                                activeClassName="text-gold-300 border-gold-400"
                                className="flex h-full items-center border-b border-transparent text-[11px] font-semibold uppercase tracking-[0.14em] text-cream/65 hover:border-gold-400 hover:text-cream"
                            >
                                {category.name}
                            </NavLink>
                        ))}
                        <NavLink to="/about" activeClassName="text-gold-300 border-gold-400" className="flex h-full items-center border-b border-transparent text-[11px] font-semibold uppercase tracking-[0.14em] text-cream/65 hover:border-gold-400 hover:text-cream">
                            Our story
                        </NavLink>
                    </nav>

                    <div className="ml-auto flex items-center gap-0.5 sm:gap-1.5">
                        <button className="flex h-11 items-center gap-2 px-3 text-cream/70 hover:text-gold-300" onClick={() => setSearchOpen(true)} aria-label="Search collection">
                            <IconSearch size={19} />
                            <span className="hidden text-[11px] font-semibold uppercase tracking-[0.14em] xl:inline">Search</span>
                        </button>
                        <Link to="/wishlist" className="relative hidden size-11 place-items-center text-cream/70 hover:text-gold-300 sm:grid" aria-label={`Wishlist with ${wishlistIds.length} items`}>
                            <IconHeart size={19} />
                            {countBadge(wishlistIds.length)}
                        </Link>
                        <Link to={signedIn ? '/account' : '/auth'} className="hidden size-11 place-items-center text-cream/70 hover:text-gold-300 sm:grid" aria-label={signedIn ? 'Account' : 'Sign in'}>
                            <IconUser size={19} />
                        </Link>
                        <button onClick={openCart} className="relative ml-1 flex h-11 items-center gap-2 border border-gold-500/55 px-3 text-gold-200 hover:border-gold-300 hover:bg-gold-400 hover:text-obsidian" aria-label={`Bag with ${itemCount} items`}>
                            <IconShoppingBag size={18} />
                            <span className="hidden text-[11px] font-bold uppercase tracking-[0.14em] sm:inline">Bag</span>
                            {countBadge(itemCount)}
                        </button>
                    </div>
                </div>

                {mobileOpen && (
                    <nav id="mobile-navigation" className="max-h-[calc(100dvh-108px)] overflow-y-auto border-t border-line bg-carbon px-5 py-6 lg:hidden" aria-label="Mobile navigation">
                        <button onClick={() => setSearchOpen(true)} className="mb-6 flex min-h-12 w-full items-center justify-between border border-line bg-obsidian px-4 text-sm text-cream/60">
                            Search the collection
                            <IconSearch size={18} className="text-gold-300" />
                        </button>
                        <div className="divide-y divide-line border-y border-line">
                            <Link to="/" className="flex min-h-14 items-center justify-between py-3 text-sm font-semibold text-cream">Shop all <IconArrowRight size={16} className="text-gold-400" /></Link>
                            {categories.map((category) => (
                                <Link key={category.id} to={`/category/${category.slug}`} className="flex min-h-14 items-center justify-between py-3 text-sm text-cream/75">
                                    {category.name}<IconArrowRight size={16} className="text-gold-400" />
                                </Link>
                            ))}
                            <Link to="/about" className="flex min-h-14 items-center justify-between py-3 text-sm text-cream/75">Our story <IconArrowRight size={16} className="text-gold-400" /></Link>
                        </div>
                        <div className="mt-6 grid grid-cols-2 gap-3">
                            <Link to="/wishlist" className="button-secondary">Wishlist ({wishlistIds.length})</Link>
                            <Link to={signedIn ? '/account' : '/auth'} className="button-primary">{signedIn ? 'My account' : 'Sign in'}</Link>
                        </div>
                    </nav>
                )}
            </header>

            <QuickSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
        </>
    );
};

export default Header;
