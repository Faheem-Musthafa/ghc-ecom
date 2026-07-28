import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import CartDrawer from '../components/CartDrawer';
import Header from '../components/Header';
import { IconArrowRight, IconBadgeCheck } from '../components/Icons';
import ProductCard from '../components/ProductCard';
import SEOHead from '../components/SEOHead';
import StoreFooter from '../components/StoreFooter';
import Toast from '../components/Toast';
import TrustBadges from '../components/TrustBadges';
import { useDailyTheme } from '../hooks/useDailyTheme';
import { api } from '../lib/api';
import { Category, Product } from '../types';

const HomePage = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [activeCategory, setActiveCategory] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const theme = useDailyTheme();

    useEffect(() => {
        setLoading(true);
        Promise.all([api.products(new URLSearchParams({ page: '1', limit: '48' })), api.categories()])
            .then(([result, allCategories]) => {
                setProducts(result.items);
                setCategories(allCategories);
            })
            .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load the collection.'))
            .finally(() => setLoading(false));
    }, []);

    const visibleProducts = useMemo(() => {
        const filtered = activeCategory
            ? products.filter((product) => product.categoryId === activeCategory || product.category?.slug === activeCategory)
            : products;
        return filtered.slice(0, 8);
    }, [activeCategory, products]);

    return (
        <div className="flex min-h-screen flex-col justify-between bg-obsidian font-body text-cream">
            <SEOHead />
            <Header />

            <main id="main-content">
                <section className="mx-auto max-w-[1440px] px-4 pb-16 pt-4 sm:px-8 lg:px-12 lg:pb-24 lg:pt-8">
                    <div className="grid min-h-[680px] overflow-hidden border border-line bg-carbon lg:grid-cols-[0.82fr_1.18fr]">
                        <div className="relative z-10 flex flex-col justify-between px-7 py-10 sm:px-12 sm:py-14 lg:px-16 lg:py-16">
                            <div className="flex items-center justify-between border-b border-line pb-5">
                                <span className="eyebrow">The table, considered</span>
                                <span className="text-[10px] tabular-nums tracking-[0.16em] text-cream/35">EST. 2021 · INDIA</span>
                            </div>

                            <div className="py-12 lg:py-16">
                                <p className="mb-5 font-display text-xl italic text-gold-200">A collection for everyday ceremony</p>
                                <h1 className="max-w-xl font-display text-5xl font-semibold leading-[0.94] tracking-[-0.035em] text-cream sm:text-7xl lg:text-[5.5rem]">
                                    Objects with presence.
                                </h1>
                                <p className="mt-7 max-w-md text-sm leading-7 text-cream/62 sm:text-base">
                                    Sculptural serveware, considered tableware, and enduring accents selected for modern Indian homes.
                                </p>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row">
                                <a href="#collection" className="button-primary gap-3 sm:min-w-52">Shop the collection <IconArrowRight size={16} /></a>
                                <Link to="/about" className="button-secondary sm:min-w-40">Our approach</Link>
                            </div>
                        </div>

                        <div className="relative min-h-[460px] border-t border-line lg:min-h-full lg:border-l lg:border-t-0">
                            <img src={theme.hero} alt={theme.heroAlt} width={900} height={900} className="absolute inset-0 h-full w-full object-cover" />
                            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/75 via-black/15 to-transparent p-6 pt-24 sm:p-8">
                                <div>
                                    <p className="eyebrow text-gold-200">Today&apos;s edit</p>
                                    <p className="mt-1 font-display text-2xl font-semibold text-white">{theme.tagline}</p>
                                </div>
                                <span className="hidden border border-white/30 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-white/80 sm:block">{theme.subtitle}</span>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="border-y border-line bg-carbon">
                    <div className="mx-auto grid max-w-[1440px] divide-y divide-line px-4 sm:px-8 md:grid-cols-[1.15fr_1fr_1fr] md:divide-x md:divide-y-0 lg:px-12">
                        <div className="py-7 md:pr-10">
                            <p className="eyebrow">Browse by collection</p>
                            <p className="mt-2 max-w-sm font-display text-2xl leading-tight text-cream">Find the pieces that belong at your table.</p>
                        </div>
                        {categories.slice(0, 2).map((category, index) => (
                            <Link key={category.id} to={`/category/${category.slug}`} className="group flex min-h-28 items-center justify-between py-7 md:px-8">
                                <div className="flex items-start gap-4">
                                    <span className="pt-1 text-[10px] tabular-nums text-gold-400">0{index + 1}</span>
                                    <div>
                                        <h2 className="font-display text-3xl font-semibold text-cream group-hover:text-gold-200">{category.name}</h2>
                                        <p className="mt-1 text-xs text-cream/45">View the collection</p>
                                    </div>
                                </div>
                                <IconArrowRight size={18} className="text-gold-400" />
                            </Link>
                        ))}
                    </div>
                </section>

                <section id="collection" className="mx-auto max-w-[1440px] px-4 py-16 sm:px-8 lg:px-12 lg:py-24">
                    <header className="mb-10 flex flex-col gap-7 border-b border-line pb-7 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <p className="eyebrow">Current collection</p>
                            <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight text-cream sm:text-5xl">Made for the way you gather.</h2>
                        </div>
                        <div className="flex max-w-full gap-6 overflow-x-auto pb-1" role="tablist" aria-label="Filter collection">
                            <button role="tab" aria-selected={!activeCategory} onClick={() => setActiveCategory('')} className={`shrink-0 border-b pb-2 text-[11px] font-bold uppercase tracking-[0.14em] ${!activeCategory ? 'border-gold-400 text-gold-200' : 'border-transparent text-cream/45 hover:text-cream'}`}>
                                All pieces
                            </button>
                            {categories.slice(0, 5).map((category) => (
                                <button key={category.id} role="tab" aria-selected={activeCategory === category.id} onClick={() => setActiveCategory(category.id)} className={`shrink-0 border-b pb-2 text-[11px] font-bold uppercase tracking-[0.14em] ${activeCategory === category.id ? 'border-gold-400 text-gold-200' : 'border-transparent text-cream/45 hover:text-cream'}`}>
                                    {category.name}
                                </button>
                            ))}
                        </div>
                    </header>

                    {loading ? (
                        <div className="grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-4" aria-label="Loading collection">
                            {Array.from({ length: 8 }).map((_, index) => <div key={index} className="aspect-[4/5] animate-pulse bg-panel" />)}
                        </div>
                    ) : error ? (
                        <div className="surface p-8 text-sm text-red-200" role="alert">{error}</div>
                    ) : visibleProducts.length ? (
                        <div className="grid grid-cols-1 gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
                            {visibleProducts.map((product, index) => <ProductCard key={product.id} product={product} priority={index < 4} />)}
                        </div>
                    ) : (
                        <div className="surface py-16 text-center">
                            <h3 className="font-display text-3xl text-cream">This collection is being prepared.</h3>
                            <button onClick={() => setActiveCategory('')} className="mt-5 text-xs font-bold uppercase tracking-wider text-gold-300">View all pieces</button>
                        </div>
                    )}

                    <div className="mt-12 flex justify-center">
                        <Link to="/search" className="button-secondary gap-3">View the full catalogue <IconArrowRight size={16} /></Link>
                    </div>
                </section>

                <section className="border-y border-line bg-carbon">
                    <div className="mx-auto grid max-w-[1440px] lg:grid-cols-2">
                        <div className="relative min-h-[440px] overflow-hidden lg:min-h-[680px]">
                            <img src={theme.story} alt={theme.storyAlt} loading="lazy" width={900} height={900} className="absolute inset-0 h-full w-full object-cover" />
                        </div>
                        <div className="flex items-center border-t border-line px-7 py-14 sm:px-12 lg:border-l lg:border-t-0 lg:px-20">
                            <div className="max-w-xl">
                                <p className="eyebrow">Material, balance, finish</p>
                                <h2 className="mt-4 font-display text-4xl font-semibold leading-tight text-cream sm:text-6xl">Quiet objects. Strong point of view.</h2>
                                <p className="mt-6 text-sm leading-7 text-cream/60">
                                    We select pieces for proportion, hand-feel, durability, and the way they live together. No trend-led clutter—only useful forms with lasting character.
                                </p>
                                <dl className="mt-9 grid grid-cols-2 border-y border-line py-6">
                                    <div className="border-r border-line pr-6">
                                        <dt className="eyebrow">Selected for</dt>
                                        <dd className="mt-2 font-display text-2xl text-cream">Daily use</dd>
                                    </div>
                                    <div className="pl-6">
                                        <dt className="eyebrow">Delivered with</dt>
                                        <dd className="mt-2 font-display text-2xl text-cream">Care</dd>
                                    </div>
                                </dl>
                                <Link to="/about" className="mt-8 inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.16em] text-gold-200 hover:text-gold-100">
                                    Read our selection philosophy <IconArrowRight size={16} />
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="mx-auto max-w-[1440px] px-4 py-16 sm:px-8 lg:px-12 lg:py-24">
                    <div className="grid gap-5 lg:grid-cols-[1fr_0.72fr]">
                        <article className="surface-raised grid overflow-hidden sm:grid-cols-2">
                            <div className="flex flex-col justify-between p-8 sm:p-10">
                                <div>
                                    <IconBadgeCheck size={22} className="text-gold-400" />
                                    <p className="eyebrow mt-8">Glockery for hospitality</p>
                                    <h2 className="mt-3 font-display text-4xl font-semibold leading-tight">Tablescapes for restaurants, studios, and considered gifting.</h2>
                                </div>
                                <Link to="/contact" className="mt-10 inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.16em] text-gold-200">Talk to our team <IconArrowRight size={16} /></Link>
                            </div>
                            <img src={theme.detail} alt={theme.detailAlt} loading="lazy" width={700} height={800} className="h-full min-h-80 w-full object-cover" />
                        </article>

                        <aside className="surface flex flex-col justify-between p-8 sm:p-10">
                            <div>
                                <p className="eyebrow">Need a considered answer?</p>
                                <h2 className="mt-3 font-display text-4xl font-semibold">Personal help, before and after checkout.</h2>
                                <p className="mt-5 text-sm leading-7 text-cream/55">Product guidance, delivery questions, care details, and order support from one team.</p>
                            </div>
                            <div className="mt-10 border-t border-line pt-7">
                                <p className="text-sm font-semibold text-cream">care@glockery.in</p>
                                <p className="mt-1 text-xs text-cream/45">Mon–Sat · 10:00–18:00 IST</p>
                                <Link to="/contact" className="button-primary mt-7 w-full">Contact care</Link>
                            </div>
                        </aside>
                    </div>
                </section>

                <TrustBadges />
            </main>

            <StoreFooter />
            <CartDrawer />
            <Toast />
        </div>
    );
};

export default HomePage;
