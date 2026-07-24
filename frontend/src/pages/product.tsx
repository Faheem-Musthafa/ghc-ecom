import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import CartDrawer from '../components/CartDrawer';
import Header from '../components/Header';
import { IconAward, IconCheckCircle, IconHeart, IconMinus, IconPlus, IconShieldCheck, IconStar, IconTruck } from '../components/Icons';
import SEOHead from '../components/SEOHead';
import StoreFooter from '../components/StoreFooter';
import Toast from '../components/Toast';
import { useCart } from '../contexts/CartContext';
import { useWishlist } from '../contexts/WishlistContext';
import { api } from '../lib/api';
import { fallbackImage, rupees } from '../lib/commerce';
import { Product } from '../types';

export const ProductDetailPage = () => {
    const { productId } = useParams<{ productId: string }>();
    const { addVariant } = useCart();
    const { isInWishlist, toggleWishlist } = useWishlist();

    const [product, setProduct] = useState<Product | null>(null);
    const [selected, setSelected] = useState(0);
    const [activeImage, setActiveImage] = useState(0);
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [adding, setAdding] = useState(false);
    const [activeTab, setActiveTab] = useState<'details' | 'specs' | 'shipping'>('details');

    // Reviews State
    const [reviews, setReviews] = useState<{ id: string; author: string; rating: number; comment: string; date: string }[]>([
        { id: '1', author: 'Aarav M.', rating: 5, comment: 'Exceptional craftsmanship and golden glow under warm dining lights.', date: '2 weeks ago' },
        { id: '2', author: 'Priya S.', rating: 5, comment: 'Elevates our evening dinner parties. Truly luxury tableware.', date: '1 month ago' },
    ]);
    const [newReviewAuthor, setNewReviewAuthor] = useState('');
    const [newReviewComment, setNewReviewComment] = useState('');
    const [newReviewRating, setNewReviewRating] = useState(5);

    useEffect(() => {
        setLoading(true);
        api.product(productId)
            .then(setProduct)
            .catch((caught) => setError(caught instanceof Error ? caught.message : 'Product not found.'))
            .finally(() => setLoading(false));
    }, [productId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-obsidian text-cream">
                <Header />
                <main className="mx-auto max-w-[1440px] px-6 py-20">
                    <div className="grid animate-pulse gap-10 lg:grid-cols-2">
                        <div className="aspect-square bg-panel rounded-sm" />
                        <div className="h-96 bg-panel rounded-sm" />
                    </div>
                </main>
            </div>
        );
    }

    if (!product || error) {
        return (
            <div className="min-h-screen bg-obsidian text-cream">
                <Header />
                <main className="grid min-h-[65vh] place-content-center px-6 text-center">
                    <h1 className="font-display text-5xl">This piece is unavailable.</h1>
                    <p className="mt-4 text-cream/45">{error}</p>
                    <Link className="mt-8 text-xs uppercase tracking-[0.2em] text-gold-300 underline" to="/">
                        Return to collection
                    </Link>
                </main>
            </div>
        );
    }

    const variant = product.variants[selected];
    const images = product.images.length
        ? product.images
        : [{ id: 'fallback', largeUrl: fallbackImage, mediumUrl: fallbackImage, thumbnailUrl: fallbackImage, altText: product.name, sortOrder: 0 }];
    const isWishlisted = isInWishlist(product.id);

    const add = async () => {
        if (!variant) return;
        setAdding(true);
        try {
            await addVariant(variant, quantity);
        } finally {
            setAdding(false);
        }
    };

    const handleAddReview = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newReviewAuthor || !newReviewComment) return;
        setReviews([
            { id: Date.now().toString(), author: newReviewAuthor, rating: newReviewRating, comment: newReviewComment, date: 'Just now' },
            ...reviews,
        ]);
        setNewReviewAuthor('');
        setNewReviewComment('');
    };

    return (
        <div className="min-h-screen bg-obsidian text-cream">
            <SEOHead title={`${product.name} | Glockery`} product={product} />
            <Header />
            <main id="main-content" className="mx-auto max-w-[1440px] px-6 py-10 sm:px-10 lg:px-12 lg:py-16">
                <nav className="mb-10 text-[10px] uppercase tracking-[0.22em] text-cream/35">
                    <Link to="/" className="hover:text-gold-300 transition">Home</Link>
                    <span className="mx-3 text-gold-500">/</span>
                    <Link to={`/category/${product.category.slug}`} className="hover:text-gold-300 transition">{product.category.name}</Link>
                    <span className="mx-3 text-gold-500">/</span>
                    <span className="text-gold-300 font-semibold">{product.name}</span>
                </nav>

                <section className="grid gap-12 lg:grid-cols-[1.1fr_.9fr] lg:gap-20">
                    <div>
                        <div className="aspect-square overflow-hidden border border-gold-500/15 bg-carbon relative rounded-sm group">
                            <img src={images[activeImage]?.largeUrl || fallbackImage} alt={images[activeImage]?.altText || product.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                            {/* Wishlist Button Overlay */}
                            <button
                                onClick={() => toggleWishlist(product.id)}
                                className={`absolute top-4 right-4 flex size-11 items-center justify-center rounded-full border backdrop-blur-md transition-all ${
                                    isWishlisted ? 'border-gold-400 bg-gold-400 text-obsidian' : 'border-gold-500/30 bg-black/60 text-cream hover:border-gold-400'
                                }`}
                                aria-label="Toggle Wishlist"
                            >
                                <IconHeart size={18} />
                            </button>
                        </div>
                        {images.length > 1 && (
                            <div className="mt-4 grid grid-cols-5 gap-3">
                                {images.map((image, index) => (
                                    <button key={image.id} onClick={() => setActiveImage(index)} className={`aspect-square overflow-hidden border rounded-sm transition ${activeImage === index ? 'border-gold-400 ring-2 ring-gold-400/30' : 'border-gold-500/15 opacity-60 hover:opacity-100'}`}>
                                        <img src={image.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="lg:sticky lg:top-32 lg:self-start">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] uppercase tracking-[0.3em] font-semibold text-gold-400">{product.category.name}</p>
                            {/* Stock Availability Indicator */}
                            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/30 px-3 py-1 text-[10px] uppercase font-bold tracking-wider text-emerald-400">
                                <IconCheckCircle size={12} color="#10B981" /> In Stock & Ready to Ship
                            </span>
                        </div>

                        <h1 className="mt-4 font-display text-5xl leading-tight sm:text-6xl">{product.name}</h1>
                        <p className="mt-4 max-w-xl text-base leading-8 text-cream/60">{product.description || product.shortDescription}</p>

                        {/* Finish Selector */}
                        {product.variants.length > 1 && (
                            <div className="mt-8">
                                <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-cream/45">Choose Finish / Variant</p>
                                <div className="flex flex-wrap gap-2">
                                    {product.variants.map((item, index) => (
                                        <button key={item.id} onClick={() => setSelected(index)} className={`border px-5 py-3 text-xs transition-all rounded-sm ${index === selected ? 'border-gold-400 bg-gold-400 text-obsidian font-bold' : 'border-gold-500/25 text-cream/60 hover:border-gold-400'}`}>
                                            {item.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="mt-9 flex items-end gap-4 border-y border-gold-500/20 py-7">
                            <strong className="font-display text-4xl font-normal text-gold-300">{variant ? rupees(variant.pricePaise) : 'Unavailable'}</strong>
                            {variant?.compareAtPricePaise && <s className="pb-1 text-sm text-cream/30">{rupees(variant.compareAtPricePaise)}</s>}
                        </div>

                        <div className="mt-8 flex gap-3">
                            <div className="flex h-14 border border-gold-500/30 rounded-sm">
                                <button className="grid w-12 place-items-center text-cream/60 hover:text-cream" onClick={() => setQuantity(Math.max(1, quantity - 1))}><IconMinus /></button>
                                <span className="grid w-10 place-items-center font-bold text-sm text-cream">{quantity}</span>
                                <button className="grid w-12 place-items-center text-cream/60 hover:text-cream" onClick={() => setQuantity(Math.min(99, quantity + 1))}><IconPlus /></button>
                            </div>
                            <button disabled={!variant || adding} onClick={add} className="flex h-14 flex-1 items-center justify-center bg-gold-400 px-5 text-xs font-bold uppercase tracking-[0.2em] text-obsidian hover:bg-gold-300 disabled:opacity-40 shadow-lg gold-glow transition rounded-sm">
                                {adding ? 'Adding…' : 'Add to bag'}
                            </button>
                        </div>

                        {/* Accordion Specs */}
                        <div className="mt-10 border-t border-gold-500/20">
                            <div className="flex border-b border-gold-500/15">
                                <button onClick={() => setActiveTab('details')} className={`py-3 px-4 text-xs font-bold uppercase tracking-widest transition ${activeTab === 'details' ? 'border-b-2 border-gold-400 text-gold-300' : 'text-cream/50 hover:text-cream'}`}>
                                    Craft & Material
                                </button>
                                <button onClick={() => setActiveTab('specs')} className={`py-3 px-4 text-xs font-bold uppercase tracking-widest transition ${activeTab === 'specs' ? 'border-b-2 border-gold-400 text-gold-300' : 'text-cream/50 hover:text-cream'}`}>
                                    Care & Specs
                                </button>
                                <button onClick={() => setActiveTab('shipping')} className={`py-3 px-4 text-xs font-bold uppercase tracking-widest transition ${activeTab === 'shipping' ? 'border-b-2 border-gold-400 text-gold-300' : 'text-cream/50 hover:text-cream'}`}>
                                    Shipping & Returns
                                </button>
                            </div>
                            <div className="py-4 text-xs text-cream/60 leading-relaxed">
                                {activeTab === 'details' && (
                                    <p>Forged from premium food-grade materials with hand-finished electroplated gold coating. Designed to retain thermal balance and resist tarnish over decades of formal hosting.</p>
                                )}
                                {activeTab === 'specs' && (
                                    <ul className="space-y-1.5 list-disc list-inside text-cream/70">
                                        <li>Hand wash recommended with mild soap</li>
                                        <li>Avoid abrasive steel scrubbers</li>
                                        <li>Lead-free & food-safe certified</li>
                                    </ul>
                                )}
                                {activeTab === 'shipping' && (
                                    <p>Shipped in signature velvet-lined hardboard packaging with insurance. Returns accepted within 14 days of delivery in original condition.</p>
                                )}
                            </div>
                        </div>

                        <div className="mt-8 grid gap-4 text-xs text-cream/45 sm:grid-cols-3">
                            <span className="flex items-center gap-2"><IconTruck className="text-gold-400" /> Insured Delivery</span>
                            <span className="flex items-center gap-2"><IconShieldCheck className="text-gold-400" /> Authenticity Guaranteed</span>
                            <span className="flex items-center gap-2"><IconAward className="text-gold-400" /> Hand-crafted Finish</span>
                        </div>
                    </div>
                </section>

                {/* Customer Reviews & Ratings Section */}
                <section className="mt-20 border-t border-gold-500/20 pt-12">
                    <div className="grid gap-12 lg:grid-cols-2">
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.3em] font-semibold text-gold-400">Client Reviews</p>
                            <h2 className="mt-2 font-display text-4xl">Verified Client Impressions</h2>
                            <div className="mt-6 space-y-4">
                                {reviews.map((r) => (
                                    <div key={r.id} className="border border-gold-500/15 bg-carbon p-5 rounded-sm">
                                        <div className="flex items-center justify-between">
                                            <strong className="text-sm font-semibold text-cream">{r.author}</strong>
                                            <span className="text-[10px] text-cream/40">{r.date}</span>
                                        </div>
                                        <div className="mt-1 flex gap-1 text-gold-400">
                                            {Array.from({ length: r.rating }).map((_, i) => (
                                                <IconStar key={i} size={14} />
                                            ))}
                                        </div>
                                        <p className="mt-3 text-xs leading-relaxed text-cream/70">{r.comment}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Submit Review Form */}
                        <form onSubmit={handleAddReview} className="border border-gold-500/20 bg-carbon p-6 rounded-sm space-y-4 h-fit">
                            <h3 className="font-display text-2xl text-cream">Share Your Impression</h3>
                            <label className="block">
                                <span className="mb-1 block text-xs text-cream/60">Your Name</span>
                                <input
                                    value={newReviewAuthor}
                                    onChange={(e) => setNewReviewAuthor(e.target.value)}
                                    placeholder="Jane Doe"
                                    className="h-11 w-full border border-gold-500/25 bg-obsidian px-4 text-xs text-cream outline-none rounded-sm"
                                    required
                                />
                            </label>
                            <label className="block">
                                <span className="mb-1 block text-xs text-cream/60">Rating Score</span>
                                <select
                                    value={newReviewRating}
                                    onChange={(e) => setNewReviewRating(Number(e.target.value))}
                                    className="h-11 w-full border border-gold-500/25 bg-obsidian px-4 text-xs text-cream outline-none rounded-sm"
                                >
                                    <option value={5}>5 Stars — Excellent</option>
                                    <option value={4}>4 Stars — Good</option>
                                    <option value={3}>3 Stars — Average</option>
                                </select>
                            </label>
                            <label className="block">
                                <span className="mb-1 block text-xs text-cream/60">Review Comment</span>
                                <textarea
                                    value={newReviewComment}
                                    onChange={(e) => setNewReviewComment(e.target.value)}
                                    rows={3}
                                    placeholder="Write your thoughts on this piece…"
                                    className="w-full border border-gold-500/25 bg-obsidian p-3 text-xs text-cream outline-none rounded-sm"
                                    required
                                />
                            </label>
                            <button className="h-11 w-full bg-gold-400 text-xs font-bold uppercase tracking-wider text-obsidian hover:bg-gold-300 rounded-sm">
                                Submit Review
                            </button>
                        </form>
                    </div>
                </section>
            </main>
            <StoreFooter />
            <CartDrawer />
            <Toast />
        </div>
    );
};
export default ProductDetailPage;
