import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import StoreFooter from '../components/StoreFooter';
import ProductCard from '../components/ProductCard';
import SEOHead from '../components/SEOHead';
import { useWishlist } from '../contexts/WishlistContext';
import { api } from '../lib/api';
import { Product } from '../types';

const WishlistPage = () => {
    const { wishlistIds } = useWishlist();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.products(new URLSearchParams({ limit: '100' }))
            .then((result) => setProducts(result.items.filter((product) => wishlistIds.includes(product.id))))
            .catch(() => setProducts([]))
            .finally(() => setLoading(false));
    }, [wishlistIds]);

    return (
        <div className="min-h-screen bg-obsidian text-cream flex flex-col">
            <SEOHead title="Wishlist | Glockery" />
            <Header />
            <main id="main-content" className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-12 sm:px-10 lg:px-12 lg:py-20">
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gold-400">Your considered edit</p>
                <h1 className="mt-4 font-display text-5xl text-cream">Saved for later.</h1>
                <p className="mt-4 max-w-xl text-sm leading-7 text-cream/50">Keep the pieces that caught your eye close by. Your wishlist is saved on this device.</p>
                {loading ? <p className="mt-16 text-sm text-cream/40">Loading your edit…</p> : !products.length ? (
                    <div className="mt-16 border border-gold-500/20 bg-carbon px-6 py-20 text-center">
                        <h2 className="font-display text-3xl">Nothing saved yet.</h2>
                        <p className="mt-3 text-sm text-cream/45">Start with a piece that makes the room feel different.</p>
                        <Link to="/#collection" className="mt-7 inline-flex h-12 items-center bg-gold-400 px-6 text-xs font-bold uppercase tracking-[0.18em] text-obsidian">Explore collection</Link>
                    </div>
                ) : <div className="mt-14 grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>}
            </main>
            <StoreFooter />
        </div>
    );
};

export default WishlistPage;
