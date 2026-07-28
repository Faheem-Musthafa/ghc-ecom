import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import CartDrawer from '../components/CartDrawer';
import Header from '../components/Header';
import ProductCard from '../components/ProductCard';
import SEOHead from '../components/SEOHead';
import StoreFooter from '../components/StoreFooter';
import Toast from '../components/Toast';
import { api } from '../lib/api';
import { titleCase } from '../lib/commerce';
import { Product } from '../types';

const CategoryPage = () => {
    const { categoryId } = useParams<{ categoryId: string }>();
    const [products, setProducts] = useState<Product[]>([]);
    const [sortOption, setSortOption] = useState<'featured' | 'price-low' | 'price-high'>('featured');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const params = new URLSearchParams({ page: '1', limit: '48', category: categoryId });
        setLoading(true);
        api.products(params)
            .then((result) => setProducts(result.items))
            .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load category.'))
            .finally(() => setLoading(false));
    }, [categoryId]);

    const sortedProducts = [...products].sort((a, b) => {
        const priceA = a.variants[0]?.pricePaise || 0;
        const priceB = b.variants[0]?.pricePaise || 0;
        if (sortOption === 'price-low') return priceA - priceB;
        if (sortOption === 'price-high') return priceB - priceA;
        return 0;
    });

    const categoryTitle = products[0]?.category.name || titleCase(categoryId.replace(/-/g, ' '));

    return (
        <div className="min-h-screen bg-obsidian text-cream font-body flex flex-col justify-between">
            <SEOHead title={`${categoryTitle} Collection | Glockery Home Centre`} />
            <Header />

            <main id="main-content" className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-8 sm:px-8 lg:px-12 lg:py-16">
                {/* Breadcrumb navigation */}
                <nav className="text-[11px] uppercase tracking-[0.22em] text-cream/40 mb-8 font-medium">
                    <Link className="hover:text-gold-300 transition" to="/">Home</Link>
                    <span className="mx-2.5 text-gold-500/40">/</span>
                    <span className="text-gold-300 font-bold">{categoryTitle}</span>
                </nav>

                <header className="mb-12 flex flex-col items-start justify-between gap-7 border-y border-line py-8 md:flex-row md:items-end sm:py-10">
                    <div className="max-w-2xl">
                        <span className="eyebrow">Collection</span>
                        <h1 className="mt-2 font-display text-5xl font-semibold text-cream sm:text-7xl">{categoryTitle}</h1>
                        <p className="mt-3 text-sm leading-relaxed text-cream/55">
                            Explore {categoryTitle.toLowerCase()} selected for balance, finish, and everyday use.
                        </p>
                    </div>

                    {/* Controls & Sort Selector */}
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-cream/50 whitespace-nowrap">Sort by:</span>
                        <select
                            value={sortOption}
                            onChange={(e) => setSortOption(e.target.value as 'featured' | 'price-low' | 'price-high')}
                            className="field min-w-48 text-xs"
                        >
                            <option value="featured">Featured Pieces</option>
                            <option value="price-low">Price: Low to High</option>
                            <option value="price-high">Price: High to Low</option>
                        </select>
                    </div>
                </header>

                {/* Product Grid */}
                {error ? (
                    <p className="mt-8 border border-red-500/30 bg-red-950/20 p-6 text-xs text-red-200 rounded-sm">{error}</p>
                ) : loading ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {Array.from({ length: 8 }).map((_, idx) => (
                            <div key={idx} className="h-80 animate-pulse rounded-sm border border-gold-500/15 bg-carbon" />
                        ))}
                    </div>
                ) : sortedProducts.length === 0 ? (
                    <div className="rounded-sm border border-gold-500/20 bg-carbon py-20 text-center">
                        <h2 className="font-display text-3xl font-semibold text-cream">No pieces found</h2>
                        <p className="mt-2 text-xs text-cream/50">This collection is currently being updated.</p>
                        <Link to="/" className="mt-6 inline-flex items-center gap-2 rounded-sm bg-gold-400 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-obsidian hover:bg-gold-300 transition">
                            Explore Full Collection
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {sortedProducts.map((product) => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                )}
            </main>

            <StoreFooter />
            <CartDrawer />
            <Toast />
        </div>
    );
};

export default CategoryPage;
