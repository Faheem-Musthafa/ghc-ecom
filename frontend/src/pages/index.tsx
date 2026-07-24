import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import CartDrawer from '../components/CartDrawer';
import Header from '../components/Header';
import { IconArrowRight, IconCheck, IconSearch, IconSparkles, IconStar } from '../components/Icons';
import ProductCard from '../components/ProductCard';
import SEOHead from '../components/SEOHead';
import StoreFooter from '../components/StoreFooter';
import Toast from '../components/Toast';
import TrustBadges from '../components/TrustBadges';
import { useDailyTheme } from '../hooks/useDailyTheme';
import { api } from '../lib/api';
import { Category, Product } from '../types';

const reviews = [
    {
        name: 'Aarav Mehta',
        location: 'Mumbai, MH',
        rating: 5,
        review: 'The Obsidian Cutlery set transformed our dinner parties completely. The weight, balance, and gold finish are worthy of fine dining establishments.',
        product: 'Noir Gold Cutlery Set',
    },
    {
        name: 'Ananya Sharma',
        location: 'New Delhi, DL',
        rating: 5,
        review: 'Exceptional craftsmanship. The glass kettle with walnut accents catches the morning light beautifully on our kitchen island.',
        product: 'Borosilicate Glass Kettle',
    },
    {
        name: 'Rohan Kapoor',
        location: 'Bengaluru, KA',
        rating: 5,
        review: 'Received within 48 hours in luxury packaging. Every piece in the ceramic tea set feels singular and ceremonial.',
        product: 'Artisanal Ceramic Tea Set',
    },
];

const HomePage = () => {
    const location = useLocation();
    const initialQuery = useMemo(() => new URLSearchParams(location.search).get('q') || '', [location.search]);
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [query, setQuery] = useState(initialQuery);
    const [category, setCategory] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [vipEmail, setVipEmail] = useState('');
    const [vipSubmitted, setVipSubmitted] = useState(false);

    const theme = useDailyTheme();

    useEffect(() => {
        setLoading(true);
        setError('');
        const params = new URLSearchParams({ page: '1', limit: '48' });
        if (query) params.set('q', query);
        if (category) params.set('category', category);
        const timer = window.setTimeout(() => {
            Promise.all([api.products(params), api.categories()])
                .then(([result, allCategories]) => { setProducts(result.items); setCategories(allCategories); })
                .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load the collection.'))
                .finally(() => setLoading(false));
        }, 180);
        return () => window.clearTimeout(timer);
    }, [query, category]);

    const handleVipSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (vipEmail) {
            setVipSubmitted(true);
            setVipEmail('');
            setTimeout(() => setVipSubmitted(false), 5000);
        }
    };

    return (
        <div className="min-h-screen bg-obsidian text-cream">
            <SEOHead />
            <Header />
            <main id="main-content">
                {/* Hero Section */}
                <section className="relative min-h-[640px] overflow-hidden border-b border-gold-500/25 sm:min-h-[720px] lg:min-h-[calc(100vh-112px)]">
                    <img src={theme.hero} alt={theme.heroAlt} className="absolute inset-0 h-full w-full object-cover object-center opacity-50 transition-opacity duration-1000" />
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,#050505_0%,rgba(5,5,5,.88)_38%,rgba(5,5,5,.2)_78%),linear-gradient(0deg,#050505_0%,transparent_35%)]" />

                    <div className="relative mx-auto flex min-h-[640px] max-w-[1440px] flex-col justify-center px-6 py-14 sm:min-h-[720px] sm:px-10 sm:py-20 lg:min-h-[calc(100vh-112px)] lg:px-12">
                        <div className="max-w-3xl">
                            <div className="mb-6 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-gold-400/30 bg-carbon/80 backdrop-blur-md">
                                <IconSparkles size={14} className="text-gold-400 animate-pulse" />
                                <span className="text-[10px] uppercase tracking-[0.25em] text-gold-300">24-Hour Rotating Theme Collection</span>
                            </div>

                            <h1 className="font-display text-[clamp(3rem,15vw,6rem)] leading-[0.94] tracking-wide text-cream sm:text-7xl lg:text-[96px]">
                                {theme.tagline}<br />
                                <span className="gold-gradient-text">{theme.subtitle}</span>
                            </h1>

                            <p className="mt-8 max-w-xl text-base leading-8 text-cream/65 sm:text-lg font-body">
                                Sculptural serveware, luminous gold accents, and objects designed to make every gathering feel singular.
                            </p>

                            <div className="mt-10 flex flex-wrap items-center gap-4">
                                <a href="#collection" className="flex h-14 items-center gap-3 bg-gold-400 px-8 text-xs font-bold uppercase tracking-[0.2em] text-obsidian transition hover:bg-gold-300 rounded-sm shadow-lg gold-glow">
                                    Shop the collection <IconArrowRight size={17} />
                                </a>
                                <a href="#craft" className="flex h-14 items-center border border-gold-400/50 px-8 text-xs uppercase tracking-[0.2em] text-gold-200 transition hover:border-gold-300 hover:bg-gold-400/10 rounded-sm">
                                    Discover the craft
                                </a>
                            </div>
                        </div>

                        {/* Luxury Statistics Bar */}
                        <div className="mt-16 grid grid-cols-2 gap-4 border-t border-gold-500/20 pt-8 sm:grid-cols-4 lg:max-w-3xl">
                            <div>
                                <strong className="block font-display text-2xl text-gold-300 sm:text-3xl">100%</strong>
                                <span className="text-[10px] uppercase tracking-widest text-cream/50">Handcrafted Brass</span>
                            </div>
                            <div>
                                <strong className="block font-display text-2xl text-gold-300 sm:text-3xl">4.9★</strong>
                                <span className="text-[10px] uppercase tracking-widest text-cream/50">Customer Rating</span>
                            </div>
                            <div>
                                <strong className="block font-display text-2xl text-gold-300 sm:text-3xl">24 Hr</strong>
                                <span className="text-[10px] uppercase tracking-widest text-cream/50">Theme Refresh</span>
                            </div>
                            <div>
                                <strong className="block font-display text-2xl text-gold-300 sm:text-3xl">Express</strong>
                                <span className="text-[10px] uppercase tracking-widest text-cream/50">Insured Shipping</span>
                            </div>
                        </div>
                    </div>
                </section>

                <TrustBadges />

                {/* Categories Bento Grid Section */}
                <section className="mx-auto max-w-[1440px] px-6 py-16 sm:px-10 lg:px-12">
                    <div className="mb-10">
                        <p className="text-[10px] uppercase tracking-[0.3em] text-gold-400">Curated Taxonomies</p>
                        <h2 className="mt-2 font-display text-4xl text-cream sm:text-5xl">Explore Categories</h2>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {categories.slice(0, 3).map((cat, idx) => (
                            <Link
                                key={cat.id}
                                to={`/category/${cat.slug}`}
                                className="group relative min-h-[220px] overflow-hidden rounded-sm border border-gold-500/20 bg-carbon p-8 flex flex-col justify-between hover:border-gold-400 transition duration-300"
                            >
                                <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/40 to-transparent opacity-80 group-hover:opacity-60 transition" />
                                <div className="relative z-10">
                                    <span className="text-[10px] uppercase tracking-widest text-gold-400">Collection 0{idx + 1}</span>
                                    <h3 className="mt-2 font-display text-3xl text-cream group-hover:text-gold-300 transition">{cat.name}</h3>
                                </div>
                                <div className="relative z-10 flex items-center justify-between text-xs text-cream/60 group-hover:text-gold-300 font-semibold uppercase tracking-wider">
                                    <span>Browse Category</span>
                                    <IconArrowRight size={16} className="translate-x-0 group-hover:translate-x-1 transition" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>

                {/* Main Product Catalogue */}
                <section id="collection" className="mx-auto max-w-[1440px] px-6 py-16 sm:px-10 lg:px-12 lg:py-24">
                    <div className="mb-12 grid gap-8 border-b border-gold-500/20 pb-10 lg:grid-cols-[1fr_420px] lg:items-end">
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.3em] text-gold-400">The full collection</p>
                            <h2 className="mt-4 max-w-2xl font-display text-5xl text-cream sm:text-6xl">Objects with presence.</h2>
                        </div>
                        <label className="flex h-14 items-center gap-3 border border-gold-500/30 bg-carbon px-5 focus-within:border-gold-400 rounded-sm">
                            <IconSearch className="text-gold-400" size={18} />
                            <span className="sr-only">Search products</span>
                            <input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                className="min-w-0 flex-1 bg-transparent text-sm text-cream outline-none placeholder:text-cream/30"
                                placeholder="Search the collection..."
                            />
                        </label>
                    </div>

                    <div className="mb-12 flex flex-wrap gap-2">
                        <button onClick={() => setCategory('')} className={`border px-5 py-3 text-[10px] uppercase tracking-[0.2em] transition rounded-sm ${!category ? 'border-gold-400 bg-gold-400 text-obsidian font-bold' : 'border-gold-500/25 text-cream/50 hover:border-gold-400 hover:text-gold-300'}`}>All pieces</button>
                        {categories.map((item) => <button key={item.id} onClick={() => setCategory(item.slug)} className={`border px-5 py-3 text-[10px] uppercase tracking-[0.2em] transition rounded-sm ${category === item.slug ? 'border-gold-400 bg-gold-400 text-obsidian font-bold' : 'border-gold-500/25 text-cream/50 hover:border-gold-400 hover:text-gold-300'}`}>{item.name}</button>)}
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label="Loading products">
                            {Array.from({ length: 8 }).map((_, index) => (
                                <div key={index} className="aspect-[4/5] animate-pulse bg-panel rounded-sm" />
                            ))}
                        </div>
                    ) : error ? (
                        <div className="border border-red-500/30 bg-red-950/20 p-10 text-center rounded-sm">
                            <h3 className="font-display text-3xl text-cream">The collection could not be loaded.</h3>
                            <p className="mt-3 text-sm text-red-200/70">{error}</p>
                            <button onClick={() => setQuery(`${query} `)} className="mt-6 border border-gold-400 px-5 py-3 text-xs uppercase tracking-[0.2em] text-gold-300">Try again</button>
                        </div>
                    ) : products.length ? (
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {products.map((product, index) => <ProductCard key={product.id} product={product} priority={index < 4} />)}
                        </div>
                    ) : (
                        <div className="border border-gold-500/25 bg-carbon px-6 py-20 text-center rounded-sm">
                            <p className="text-[10px] uppercase tracking-[0.3em] text-gold-400">Catalogue ready</p>
                            <h3 className="mt-4 font-display text-4xl text-cream">No published pieces yet.</h3>
                            <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-cream/50">The storefront is connected to Supabase through the backend. Publish products in the catalogue console and they will appear here automatically.</p>
                            <Link to="/admin/catalogue" className="mt-8 inline-flex h-12 items-center bg-gold-400 px-6 text-xs font-bold uppercase tracking-[0.18em] text-obsidian">Open catalogue console</Link>
                        </div>
                    )}
                </section>

                {/* Craft Story Section */}
                <section id="craft" className="border-y border-gold-500/20 bg-carbon">
                    <div className="mx-auto grid max-w-[1440px] lg:grid-cols-2">
                        <div className="relative min-h-[540px] overflow-hidden">
                            <img src={theme.story} alt={theme.storyAlt} className="absolute inset-0 h-full w-full object-cover opacity-70 transition-opacity duration-1000" />
                            <div className="absolute inset-0 bg-gradient-to-t from-obsidian/80 to-transparent" />
                        </div>
                        <div className="flex items-center px-8 py-20 sm:px-14 lg:px-20">
                            <div>
                                <p className="text-[10px] uppercase tracking-[0.32em] text-gold-400">Material drama</p>
                                <h2 className="mt-5 font-display text-5xl leading-tight text-cream sm:text-6xl">Quiet craft.<br />Unmistakable impact.</h2>
                                <p className="mt-7 max-w-lg text-base leading-8 text-cream/50">Every silhouette is selected for contrast, weight, and the way it catches evening light. The result is tableware that performs beautifully and photographs even better.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Customer Reviews Section */}
                <section className="mx-auto max-w-[1440px] px-6 py-20 sm:px-10 lg:px-12 border-b border-gold-500/20">
                    <div className="text-center max-w-2xl mx-auto mb-16">
                        <p className="text-[10px] uppercase tracking-[0.32em] text-gold-400">Client Endorsements</p>
                        <h2 className="mt-3 font-display text-4xl text-cream sm:text-5xl">Revered by Hosts</h2>
                    </div>
                    <div className="grid md:grid-cols-3 gap-6">
                        {reviews.map((rev, idx) => (
                            <div key={idx} className="glass-card p-8 rounded-sm flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center gap-1 text-gold-400 mb-4">
                                        {Array.from({ length: rev.rating }).map((_, i) => (
                                            <IconStar key={i} size={14} className="fill-gold-400 text-gold-400" />
                                        ))}
                                    </div>
                                    <p className="text-sm text-cream/75 italic leading-relaxed">&quot;{rev.review}&quot;</p>
                                </div>
                                <div className="mt-8 pt-4 border-t border-gold-500/15 flex items-center justify-between">
                                    <div>
                                        <strong className="block text-xs font-bold text-cream">{rev.name}</strong>
                                        <span className="text-[10px] text-cream/40">{rev.location}</span>
                                    </div>
                                    <span className="text-[9px] uppercase tracking-widest text-gold-400 border border-gold-500/20 px-2 py-1 rounded">Verified Buyer</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* VIP Newsletter Section */}
                <section className="relative overflow-hidden px-6 py-24 text-center sm:py-32 bg-obsidian">
                    <img src={theme.detail} alt={theme.detailAlt} className="absolute inset-0 h-full w-full object-cover opacity-15 transition-opacity duration-1000" />
                    <div className="relative mx-auto max-w-3xl">
                        <p className="text-[10px] uppercase tracking-[0.32em] text-gold-400">Private Members Access</p>
                        <h2 className="mt-5 font-display text-5xl text-cream sm:text-7xl">Make the ordinary ceremonial.</h2>
                        <p className="mt-4 text-sm text-cream/60 max-w-lg mx-auto">
                            Join the Glockery Private Society for early access to limited edition drops, private tasting invitations, and custom monogramming.
                        </p>
                        <form onSubmit={handleVipSubmit} className="mt-8 flex max-w-md mx-auto border border-gold-500/30 bg-carbon/90 rounded-sm overflow-hidden focus-within:border-gold-400">
                            <input
                                type="email"
                                value={vipEmail}
                                onChange={(e) => setVipEmail(e.target.value)}
                                placeholder="Enter your private email..."
                                className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-xs text-cream outline-none placeholder:text-cream/30"
                                required
                            />
                            <button className="bg-gold-400 px-6 text-xs font-bold uppercase tracking-widest text-obsidian hover:bg-gold-300 transition shrink-0">
                                Join
                            </button>
                        </form>
                        {vipSubmitted && (
                            <div className="mt-3 text-xs text-gold-300 flex items-center justify-center gap-1.5 animate-fade-in">
                                <IconCheck size={16} /> Welcome to the Glockery Private Circle. Check your inbox shortly.
                            </div>
                        )}
                    </div>
                </section>
            </main>

            <StoreFooter />
            <CartDrawer />
            <Toast />
        </div>
    );
};

export default HomePage;
