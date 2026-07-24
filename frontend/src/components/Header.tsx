import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useWishlist } from '../contexts/WishlistContext';
import { api } from '../lib/api';
import { Category } from '../types';
import { IconClose, IconHeart, IconMenu, IconSearch, IconShoppingBag, IconUser } from './Icons';
import QuickSearchModal from './QuickSearchModal';

const navLink = 'relative py-2 text-xs uppercase tracking-[0.22em] text-cream/70 transition hover:text-gold-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-400';

const Header = () => {
    const { itemCount, openCart } = useCart();
    const { signedIn } = useAuth();
    const { wishlistIds } = useWishlist();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);
    const location = useLocation();

    useEffect(() => { api.categories().then(setCategories).catch(() => setCategories([])); }, []);
    useEffect(() => { setMobileOpen(false); }, [location.pathname]);

    return (
        <>
            <a href="#main-content" className="fixed left-3 top-3 z-[100] -translate-y-24 bg-gold-400 px-4 py-3 text-sm font-bold text-obsidian focus:translate-y-0">Skip to content</a>
            <div className="border-b border-gold-500/20 bg-gold-400 px-3 py-2 text-center text-[9px] font-bold uppercase tracking-[0.16em] text-obsidian sm:px-4 sm:text-[10px] sm:tracking-[0.22em]">
                Complimentary delivery over ₹1,000 · Secure payments by Razorpay
            </div>
            <header className="sticky top-0 z-40 border-b border-gold-500/20 bg-obsidian/90 backdrop-blur-xl transition-all">
                <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-1 px-3 sm:h-20 sm:gap-2 sm:px-8 lg:px-12">
                    <button
                        className="grid size-11 shrink-0 place-items-center text-gold-300 lg:hidden"
                        onClick={() => setMobileOpen(!mobileOpen)}
                        aria-label="Toggle navigation"
                        aria-expanded={mobileOpen}
                        aria-controls="mobile-navigation"
                    >
                        {mobileOpen ? <IconClose /> : <IconMenu />}
                    </button>
                    <Link to="/" className="group min-w-0 text-center leading-none text-gold-300" aria-label="Glockery Home Centre">
                        <span className="block truncate font-display text-xl tracking-[0.14em] min-[380px]:text-2xl min-[380px]:tracking-[0.18em] sm:text-3xl sm:tracking-[0.2em]">GLOCKERY</span>
                        <small className="mt-1 block truncate text-[7px] tracking-[0.32em] text-cream/55 sm:text-[8px] sm:tracking-[0.48em]">HOME CENTRE</small>
                    </Link>
                    <nav className="hidden items-center gap-9 lg:flex" aria-label="Primary navigation">
                        <Link className={navLink} to="/">The collection</Link>
                        {categories.slice(0, 4).map((category) => <Link className={navLink} key={category.id} to={`/category/${category.slug}`}>{category.name}</Link>)}
                        <Link className={navLink} to="/#craft">Craft</Link>
                    </nav>
                    <div className="flex shrink-0 items-center gap-0 sm:gap-1 lg:gap-2">
                        <button className="grid size-10 place-items-center rounded-sm border border-gold-500/20 bg-carbon text-xs text-cream/80 transition hover:border-gold-400 hover:text-gold-300 sm:flex sm:w-auto sm:gap-2 sm:px-3 sm:py-1.5" onClick={() => setSearchOpen(true)} aria-label="Search">
                            <IconSearch size={16} />
                            <span className="hidden sm:inline text-[11px] text-cream/50">Search</span>
                            <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[9px] font-mono bg-obsidian text-gold-400 border border-gold-500/30 rounded">⌘K</kbd>
                        </button>
                        <Link className="relative hidden size-11 place-items-center text-cream/80 transition hover:text-gold-300 sm:grid" to="/wishlist" aria-label="Wishlist">
                            <IconHeart size={20} />
                            {wishlistIds.length > 0 && (
                                <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-gold-400 text-[9px] font-bold text-obsidian animate-pulse">
                                    {wishlistIds.length}
                                </span>
                            )}
                        </Link>
                        <Link className="hidden size-11 place-items-center text-cream/80 transition hover:text-gold-300 sm:grid" to={signedIn ? '/account' : '/auth'} aria-label="Account">
                            <IconUser />
                        </Link>
                        <button className="relative grid size-11 place-items-center text-cream/80 transition hover:text-gold-300" onClick={openCart} aria-label={`Bag with ${itemCount} items`}>
                            <IconShoppingBag />
                            {itemCount > 0 && <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-gold-400 text-[9px] font-bold text-obsidian">{itemCount}</span>}
                        </button>
                    </div>
                </div>
                {mobileOpen && (
                    <nav id="mobile-navigation" className="max-h-[calc(100svh-110px)] overflow-y-auto border-t border-gold-500/20 bg-carbon px-6 py-6 lg:hidden">
                        <div className="flex flex-col gap-3">
                            <Link className={navLink} to="/">The collection</Link>
                            {categories.slice(0, 6).map((category) => <Link className={navLink} key={category.id} to={`/category/${category.slug}`}>{category.name}</Link>)}
                            <Link className={navLink} to="/#craft">Craft</Link>
                            <Link className={navLink} to="/wishlist">Wishlist ({wishlistIds.length})</Link>
                            <Link className={navLink} to={signedIn ? '/account' : '/auth'}>{signedIn ? 'My account' : 'Sign in'}</Link>
                        </div>
                    </nav>
                )}
            </header>

            <QuickSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
        </>
    );
};

export default Header;
