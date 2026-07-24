import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import CartDrawer from '../components/CartDrawer';
import Header from '../components/Header';
import ProductCard from '../components/ProductCard';
import SEOHead from '../components/SEOHead';
import StoreFooter from '../components/StoreFooter';
import Toast from '../components/Toast';
import { api } from '../lib/api';
import { Product } from '../types';

const CategoryPage = () => {
    const { categoryId } = useParams<{ categoryId: string }>();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    useEffect(() => {
        const params = new URLSearchParams({ page: '1', limit: '48', category: categoryId });
        setLoading(true);
        api.products(params).then((result) => setProducts(result.items)).catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load category.')).finally(() => setLoading(false));
    }, [categoryId]);
    const name = products[0]?.category.name || categoryId.replace(/-/g, ' ');

    return (
        <div className="min-h-screen bg-obsidian text-cream"><SEOHead title={`${name} | Glockery`} /><Header />
            <main id="main-content" className="mx-auto max-w-[1440px] px-6 py-14 sm:px-10 lg:px-12 lg:py-20">
                <nav className="text-[10px] uppercase tracking-[0.24em] text-cream/35"><Link className="hover:text-gold-300" to="/">Home</Link><span className="mx-3 text-gold-500">/</span>{name}</nav>
                <header className="mt-12 border-b border-gold-500/20 pb-12"><p className="text-[10px] uppercase tracking-[0.3em] text-gold-400">Curated category</p><h1 className="mt-4 font-display text-6xl capitalize sm:text-7xl">{name}</h1><p className="mt-5 text-sm text-cream/45">{loading ? 'Loading…' : `${products.length} statement ${products.length === 1 ? 'piece' : 'pieces'}`}</p></header>
                {error ? <p className="mt-12 border border-red-500/30 p-6 text-red-200">{error}</p> : !loading && products.length === 0 ? <div className="py-28 text-center"><h2 className="font-display text-4xl">No published pieces in this category.</h2><Link to="/" className="mt-6 inline-block text-xs uppercase tracking-[0.2em] text-gold-300 underline">View the full collection</Link></div> : <div className="mt-14 grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>}
            </main><StoreFooter /><CartDrawer /><Toast />
        </div>
    );
};
export default CategoryPage;
