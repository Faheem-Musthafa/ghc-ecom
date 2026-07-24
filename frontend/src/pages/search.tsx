import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Header from '../components/Header';
import ProductCard from '../components/ProductCard';
import SEOHead from '../components/SEOHead';
import StoreFooter from '../components/StoreFooter';
import { IconFilter, IconSearch } from '../components/Icons';
import { api } from '../lib/api';
import { Category, Product } from '../types';

export const SearchPage = () => {
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const initialQuery = queryParams.get('q') || '';

    const [query, setQuery] = useState(initialQuery);
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedCategory, setSelectedCategory] = useState('');
    const [maxPrice, setMaxPrice] = useState<number>(500000); // 5000 in Rs
    const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'name'>('featured');
    const [inStockOnly, setInStockOnly] = useState(false);

    useEffect(() => {
        setLoading(true);
        Promise.all([api.products(new URLSearchParams({ limit: '100' })), api.categories()])
            .then(([res, cats]) => {
                setProducts(res.items);
                setCategories(cats);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const filteredProducts = useMemo(() => {
        return products.filter((p) => {
            const matchesQuery =
                !query ||
                p.name.toLowerCase().includes(query.toLowerCase()) ||
                p.slug.toLowerCase().includes(query.toLowerCase()) ||
                (p.description && p.description.toLowerCase().includes(query.toLowerCase()));

            const matchesCategory = !selectedCategory || p.categoryId === selectedCategory;
            const price = p.variants[0]?.pricePaise || 0;
            const matchesPrice = price <= maxPrice;

            return matchesQuery && matchesCategory && matchesPrice;
        }).sort((a, b) => {
            const priceA = a.variants[0]?.pricePaise || 0;
            const priceB = b.variants[0]?.pricePaise || 0;
            if (sortBy === 'price-asc') return priceA - priceB;
            if (sortBy === 'price-desc') return priceB - priceA;
            if (sortBy === 'name') return a.name.localeCompare(b.name);
            return 0;
        });
    }, [products, query, selectedCategory, maxPrice, sortBy]);

    return (
        <div className="min-h-screen bg-obsidian text-cream flex flex-col justify-between">
            <SEOHead title={`Search Results: ${query || 'Catalogue'} | Glockery`} />
            <Header />
            <main className="flex-1 px-6 py-10 lg:px-10 max-w-7xl mx-auto w-full">
                {/* Search Bar Header */}
                <div className="mb-8 border-b border-gold-500/20 pb-6">
                    <span className="text-[10px] uppercase tracking-[0.28em] font-semibold text-gold-400">Catalogue Discovery</span>
                    <h1 className="mt-1 font-display text-4xl text-cream">Search Collection</h1>
                    <div className="mt-4 flex max-w-xl border border-gold-500/25 bg-carbon rounded-sm">
                        <IconSearch className="m-3.5 text-gold-400" />
                        <label htmlFor="catalogue-search" className="sr-only">Search products</label>
                        <input
                            id="catalogue-search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search by keywords, materials, or products…"
                            className="min-w-0 flex-1 bg-transparent text-sm text-cream outline-none focus-visible:ring-2 focus-visible:ring-gold-400/70"
                        />
                    </div>
                </div>

                <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
                    {/* Advanced Filters Sidebar */}
                    <aside className="border border-gold-500/20 bg-carbon p-6 rounded-sm space-y-6 h-fit">
                        <div className="flex items-center gap-2 border-b border-gold-500/15 pb-3">
                            <IconFilter size={18} className="text-gold-400" />
                            <h3 className="font-display text-lg text-cream">Refine Results</h3>
                        </div>

                        {/* Category Filter */}
                        <div>
                            <label htmlFor="search-category" className="mb-2 block text-xs font-bold uppercase tracking-wider text-gold-400">Category</label>
                            <select
                                id="search-category"
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="w-full border border-gold-500/25 bg-obsidian p-2.5 text-xs text-cream outline-none focus-visible:ring-2 focus-visible:ring-gold-400/70 rounded-sm"
                            >
                                <option value="">All Categories</option>
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Sort By */}
                        <div>
                            <label htmlFor="search-sort" className="mb-2 block text-xs font-bold uppercase tracking-wider text-gold-400">Sort By</label>
                            <select
                                id="search-sort"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                                className="w-full border border-gold-500/25 bg-obsidian p-2.5 text-xs text-cream outline-none focus-visible:ring-2 focus-visible:ring-gold-400/70 rounded-sm"
                            >
                                <option value="featured">Featured / Relevant</option>
                                <option value="price-asc">Price: Low to High</option>
                                <option value="price-desc">Price: High to Low</option>
                                <option value="name">Product Title</option>
                            </select>
                        </div>

                        {/* Price Range Filter */}
                        <div>
                            <div className="flex justify-between text-xs text-cream/70 mb-2">
                                <span className="font-bold uppercase text-[10px] text-gold-400">Max Price</span>
                                <span>₹{(maxPrice / 100).toLocaleString('en-IN')}</span>
                            </div>
                            <input
                                type="range"
                                min="100000"
                                max="1000000"
                                step="50000"
                                value={maxPrice}
                                onChange={(e) => setMaxPrice(Number(e.target.value))}
                                className="w-full accent-gold-400 cursor-pointer"
                            />
                        </div>
                    </aside>

                    {/* Results Grid */}
                    <div>
                        <div className="mb-4 flex items-center justify-between text-xs text-cream/50">
                            <span>Showing {filteredProducts.length} result(s)</span>
                        </div>

                        {loading ? (
                            <div className="text-center py-20 text-cream/40">Searching catalogue…</div>
                        ) : filteredProducts.length > 0 ? (
                            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                                {filteredProducts.map((p) => (
                                    <ProductCard key={p.id} product={p} />
                                ))}
                            </div>
                        ) : (
                            <div className="border border-gold-500/20 bg-carbon p-12 text-center rounded-sm">
                                <h3 className="font-display text-2xl text-gold-300">No Matching Products</h3>
                                <p className="mt-2 text-xs text-cream/50">Try broadening your search term or adjusting filters.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
            <StoreFooter />
        </div>
    );
};
export default SearchPage;
