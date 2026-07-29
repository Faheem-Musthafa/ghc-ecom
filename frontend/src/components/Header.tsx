import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useWishlist } from '../contexts/WishlistContext';
import {
    IconClose,
    IconHeart,
    IconMenu,
    IconSearch,
    IconShoppingBag,
    IconUser,
} from './Icons';
import QuickSearchModal from './QuickSearchModal';

const navLink = 'text-sm text-cream/70 hover:text-cream';

const Header = () => {
    const { itemCount, openCart } = useCart();
    const { signedIn } = useAuth();
    const { wishlistIds } = useWishlist();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const location = useLocation();

    useEffect(() => setMobileOpen(false), [location.pathname]);

    return (
        <>
            <a href="#main-content" className="fixed left-3 top-3 z-50 -translate-y-24 bg-cream px-4 py-2 text-sm font-semibold text-obsidian focus:translate-y-0">
                Skip to content
            </a>

            <header className="sticky top-0 z-40 border-b border-line bg-obsidian/95 supports-[backdrop-filter]:backdrop-blur-md">
                <div className="mx-auto flex h-16 max-w-[1440px] items-center px-4 sm:px-8 lg:h-[72px] lg:px-12">
                    <button
                        className="mr-2 grid size-11 place-items-center text-cream lg:hidden"
                        onClick={() => setMobileOpen((open) => !open)}
                        aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
                        aria-expanded={mobileOpen}
                        aria-controls="mobile-navigation"
                    >
                        {mobileOpen ? <IconClose size={21} /> : <IconMenu size={21} />}
                    </button>

                    <Link to="/" className="shrink-0 leading-none text-cream" aria-label="Glockery Home Centre, Vengara">
                        <span className="block text-base font-bold tracking-[0.18em]">GLOCKERY</span>
                        <span className="mt-1 block text-[8px] font-semibold uppercase tracking-[0.2em] text-cream/60">Home Centre · Vengara</span>
                    </Link>

                    <nav className="ml-12 hidden items-center gap-8 lg:flex" aria-label="Primary navigation">
                        <NavLink exact to="/" className={navLink} activeClassName="text-gold-300">Shop</NavLink>
                        <NavLink to="/search" className={navLink} activeClassName="text-gold-300">All products</NavLink>
                        <NavLink to="/about" className={navLink} activeClassName="text-gold-300">About</NavLink>
                    </nav>

                    <div className="ml-auto flex items-center">
                        <button className="grid size-11 place-items-center text-cream/70 hover:text-cream" onClick={() => setSearchOpen(true)} aria-label="Search products">
                            <IconSearch size={19} />
                        </button>
                        <Link to="/wishlist" className="relative hidden size-11 place-items-center text-cream/70 hover:text-cream sm:grid" aria-label={`Wishlist with ${wishlistIds.length} items`}>
                            <IconHeart size={19} />
                            {wishlistIds.length > 0 && <span className="count-badge">{wishlistIds.length}</span>}
                        </Link>
                        <Link to={signedIn ? '/account' : '/auth'} className="hidden size-11 place-items-center text-cream/70 hover:text-cream sm:grid" aria-label={signedIn ? 'Account' : 'Sign in'}>
                            <IconUser size={19} />
                        </Link>
                        <button onClick={openCart} className="relative ml-1 flex h-11 items-center gap-2 px-2 text-cream hover:text-gold-300" aria-label={`Bag with ${itemCount} items`}>
                            <IconShoppingBag size={19} />
                            <span className="hidden text-sm sm:inline">Bag</span>
                            {itemCount > 0 && <span className="count-badge">{itemCount > 99 ? '99+' : itemCount}</span>}
                        </button>
                    </div>
                </div>

                {mobileOpen && (
                    <nav id="mobile-navigation" className="border-t border-line bg-obsidian px-5 py-5 lg:hidden" aria-label="Mobile navigation">
                        <div className="flex flex-col">
                            <Link to="/" className="min-h-12 border-b border-line py-3 text-sm text-cream">Shop</Link>
                            <Link to="/search" className="min-h-12 border-b border-line py-3 text-sm text-cream">All products</Link>
                            <Link to="/about" className="min-h-12 border-b border-line py-3 text-sm text-cream">About</Link>
                            <Link to="/wishlist" className="min-h-12 border-b border-line py-3 text-sm text-cream">Wishlist ({wishlistIds.length})</Link>
                            <Link to={signedIn ? '/account' : '/auth'} className="min-h-12 py-3 text-sm text-cream">{signedIn ? 'My account' : 'Sign in'}</Link>
                        </div>
                    </nav>
                )}
            </header>

            <QuickSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
        </>
    );
};

export default Header;
