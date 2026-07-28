import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import CartDrawer from '../components/CartDrawer';
import Header from '../components/Header';
import {
    IconArrowRight,
    IconAward,
    IconCheckCircle,
    IconHeart,
    IconMinus,
    IconPlus,
    IconPlay,
    IconShieldCheck,
    IconShoppingBag,
    IconTruck,
} from '../components/Icons';
import ProductCard from '../components/ProductCard';
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
    const { addVariant, openCart } = useCart();
    const { isInWishlist, toggleWishlist } = useWishlist();

    const [product, setProduct] = useState<Product | null>(null);
    const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
    const [selected, setSelected] = useState(0);
    const [activeImage, setActiveImage] = useState(0);
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [adding, setAdding] = useState(false);
    const [activeTab, setActiveTab] = useState<'details' | 'specs' | 'shipping'>('details');

    useEffect(() => {
        setLoading(true);
        api.product(productId)
            .then((res) => {
                setProduct(res);
                setActiveImage(0);
                // Fetch related products from category
                api.products(new URLSearchParams({ page: '1', limit: '4', category: res.category.slug }))
                    .then((relRes) => setRelatedProducts(relRes.items.filter((p) => p.id !== res.id)))
                    .catch(() => setRelatedProducts([]));
            })
            .catch((caught) => setError(caught instanceof Error ? caught.message : 'Product not found.'))
            .finally(() => setLoading(false));
    }, [productId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-obsidian text-cream font-body">
                <Header />
                <main className="mx-auto max-w-[1440px] px-6 py-20">
                    <div className="grid animate-pulse gap-10 lg:grid-cols-2">
                        <div className="aspect-square bg-carbon rounded-sm border border-gold-500/20" />
                        <div className="h-96 bg-carbon rounded-sm border border-gold-500/20" />
                    </div>
                </main>
            </div>
        );
    }

    if (!product || error) {
        return (
            <div className="min-h-screen bg-obsidian text-cream font-body flex flex-col justify-between">
                <Header />
                <main className="grid min-h-[65vh] place-content-center px-6 text-center">
                    <div className="mx-auto max-w-lg border border-line bg-carbon p-12">
                        <h1 className="font-display text-4xl font-bold text-cream">This piece is unavailable.</h1>
                        <p className="mt-3 text-xs text-cream/50 leading-relaxed">{error}</p>
                        <Link className="mt-8 inline-flex items-center gap-2 bg-gold-400 px-6 py-3 text-xs font-bold uppercase tracking-wider text-obsidian rounded-sm hover:bg-gold-300 transition" to="/">
                            Return to Collection <IconArrowRight size={15} />
                        </Link>
                    </div>
                </main>
                <StoreFooter />
            </div>
        );
    }

    const variant = product.variants[selected];
    const media = [
        ...product.images.map((image) => ({
            id: image.id,
            type: 'image' as const,
            sortOrder: image.sortOrder,
            altText: image.altText,
            url: image.largeUrl,
            thumbnailUrl: image.thumbnailUrl,
        })),
        ...product.videos.map((video) => ({
            id: video.id,
            type: 'video' as const,
            sortOrder: video.sortOrder,
            altText: video.altText,
            url: video.url,
        })),
    ].sort((left, right) => left.sortOrder - right.sortOrder);
    const gallery = media.length
        ? media
        : [{ id: 'fallback', type: 'image' as const, sortOrder: 0, altText: product.name, url: fallbackImage, thumbnailUrl: fallbackImage }];
    const activeMedia = gallery[activeImage] || gallery[0];
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

    const handleBuyNow = async () => {
        if (!variant) return;
        await add();
        openCart();
    };

    return (
        <div className="min-h-screen bg-obsidian text-cream font-body flex flex-col justify-between">
            <SEOHead title={`${product.name} | Glockery Home Centre`} product={product} />
            <Header />

            <main id="main-content" className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-8 sm:px-8 lg:px-12 lg:py-16">
                {/* Breadcrumbs */}
                <nav className="mb-8 text-[11px] uppercase tracking-[0.22em] text-cream/45 font-medium">
                    <Link to="/" className="hover:text-gold-300 transition">Home</Link>
                    <span className="mx-2.5 text-gold-500/40">/</span>
                    <Link to={`/category/${product.category.slug}`} className="hover:text-gold-300 transition">{product.category.name}</Link>
                    <span className="mx-2.5 text-gold-500/40">/</span>
                    <span className="text-gold-300 font-bold">{product.name}</span>
                </nav>

                <section className="grid gap-10 lg:grid-cols-12 lg:gap-14">
                    {/* Left Showcase Media Gallery */}
                    <div className="lg:col-span-7">
                        <div className="group relative aspect-square overflow-hidden border border-line bg-carbon">
                            {activeMedia.type === 'video' ? (
                                <video controls preload="metadata" className="h-full w-full bg-black object-contain" aria-label={activeMedia.altText || product.name}>
                                    <source src={activeMedia.url} />
                                    Your browser does not support this product video.
                                </video>
                            ) : (
                                <img
                                    src={activeMedia.url || fallbackImage}
                                    alt={activeMedia.altText || product.name}
                                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                                    onError={(e) => { e.currentTarget.src = fallbackImage; }}
                                />
                            )}
                            {/* Floating Wishlist Heart */}
                            <button
                                onClick={() => toggleWishlist(product.id)}
                                className={`absolute right-4 top-4 z-10 grid size-11 place-items-center border ${
                                    isWishlisted ? 'border-gold-400 bg-gold-400 text-obsidian' : 'border-line bg-obsidian/90 text-cream/80 hover:border-gold-400 hover:text-gold-300'
                                }`}
                                aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
                                aria-pressed={isWishlisted}
                            >
                                <IconHeart size={20} />
                            </button>

                        </div>

                        {/* Thumbnail Strip */}
                        {gallery.length > 1 && (
                            <div className="mt-4 grid grid-cols-5 gap-3">
                                {gallery.map((item, index) => (
                                    <button
                                        key={item.id}
                                        onClick={() => setActiveImage(index)}
                                        aria-label={`View ${item.type === 'video' ? 'video' : 'image'} ${index + 1}`}
                                        className={`aspect-square overflow-hidden rounded-sm border transition ${activeImage === index ? 'border-gold-400 ring-2 ring-gold-400/30' : 'border-gold-500/20 opacity-60 hover:opacity-100'}`}
                                    >
                                        {item.type === 'video' ? (
                                            <span className="flex h-full w-full items-center justify-center bg-carbon text-gold-300"><IconPlay size={24} /></span>
                                        ) : (
                                            <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right Product Details & Action Panel */}
                    <div className="lg:col-span-5 lg:sticky lg:top-28 lg:self-start space-y-6">
                        <div>
                            <div className="flex items-center justify-between">
                                <span className="eyebrow">{product.category.name}</span>
                                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                                    <IconCheckCircle size={12} color="#10B981" /> In stock
                                </span>
                            </div>

                            <h1 className="mt-3 font-display text-5xl font-semibold leading-[1.02] text-cream sm:text-6xl">{product.name}</h1>
                            <p className="mt-4 text-sm leading-7 text-cream/60">{product.description || product.shortDescription}</p>
                            {(product.material || product.dimensions) && (
                                <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-gold-500/15 pt-4 text-xs">
                                    {product.material && <div><dt className="uppercase tracking-wider text-cream/40">Material</dt><dd className="mt-1 text-cream/85">{product.material}</dd></div>}
                                    {product.dimensions && <div><dt className="uppercase tracking-wider text-cream/40">Dimensions</dt><dd className="mt-1 text-cream/85">{product.dimensions}</dd></div>}
                                </dl>
                            )}
                        </div>

                        {/* Variant Finish Picker */}
                        {product.variants.length > 1 && (
                            <div className="border-t border-gold-500/15 pt-5">
                                <p className="mb-2.5 text-[10px] uppercase tracking-[0.22em] text-cream/50 font-semibold">Select Finish / Variant</p>
                                <div className="flex flex-wrap gap-2">
                                    {product.variants.map((item, index) => (
                                        <button
                                            key={item.id}
                                            onClick={() => setSelected(index)}
                                            className={`rounded-sm border px-4 py-2.5 text-xs transition-all ${index === selected ? 'border-gold-400 bg-gold-400 text-obsidian font-bold shadow-md' : 'border-gold-500/25 bg-carbon text-cream/70 hover:border-gold-400 hover:text-gold-300'}`}
                                        >
                                            {item.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Pricing Banner */}
                        <div className="flex items-baseline gap-3 border-y border-gold-500/20 py-5">
                            <strong className="font-display text-4xl font-bold text-gold-300 tracking-tight">
                                {variant ? rupees(variant.pricePaise) : 'Unavailable'}
                            </strong>
                            {variant?.compareAtPricePaise && variant.compareAtPricePaise > variant.pricePaise && (
                                <s className="text-sm text-cream/35">{rupees(variant.compareAtPricePaise)}</s>
                            )}
                        </div>

                        {/* Quantity Counter & CTA Buttons */}
                        <div className="space-y-3">
                            <div className="flex gap-3">
                                <div className="flex h-12 border border-gold-500/30 bg-carbon rounded-sm">
                                    <button className="grid w-11 place-items-center text-cream/60 hover:text-gold-300 transition" onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Decrease quantity">
                                        <IconMinus size={14} />
                                    </button>
                                    <span className="grid w-10 place-items-center font-bold text-xs text-cream font-mono">{quantity}</span>
                                    <button className="grid w-11 place-items-center text-cream/60 hover:text-gold-300 transition" onClick={() => setQuantity(Math.min(99, quantity + 1))} aria-label="Increase quantity">
                                        <IconPlus size={14} />
                                    </button>
                                </div>

                                <button
                                    disabled={!variant || adding}
                                    onClick={add}
                                    className="button-primary h-12 flex-1 gap-2 disabled:opacity-40"
                                >
                                    <IconShoppingBag size={16} />
                                    {adding ? 'Adding…' : 'Add to bag'}
                                </button>
                            </div>

                            <button
                                disabled={!variant || adding}
                                onClick={handleBuyNow}
                                className="button-secondary h-12 w-full"
                            >
                                Buy now
                            </button>
                        </div>

                        {/* Accordion Specification Tabs */}
                        <div className="border-t border-gold-500/20 pt-6">
                            <div className="flex border-b border-gold-500/15">
                                {[
                                    ['details', 'Craft & Material'],
                                    ['specs', 'Care & Specs'],
                                    ['shipping', 'Shipping & Returns'],
                                ].map(([tabId, label]) => (
                                    <button
                                        key={tabId}
                                        onClick={() => setActiveTab(tabId as 'details' | 'specs' | 'shipping')}
                                        className={`py-2.5 px-4 text-xs font-bold uppercase tracking-wider transition ${activeTab === tabId ? 'border-b-2 border-gold-400 text-gold-300 font-bold' : 'text-cream/50 hover:text-cream'}`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <div className="py-4 text-xs text-cream/70 leading-relaxed">
                                {activeTab === 'details' && (
                                    <div className="space-y-3">
                                        <p>{product.description || product.shortDescription || 'Product details will be added soon.'}</p>
                                        {product.material && <p><span className="font-semibold text-gold-300">Material:</span> {product.material}</p>}
                                    </div>
                                )}
                                {activeTab === 'specs' && (
                                    <ul className="space-y-1.5 list-disc list-inside text-cream/70">
                                        {product.dimensions && <li><span className="font-semibold text-gold-300">Dimensions:</span> {product.dimensions}</li>}
                                        <li>Hand wash recommended with mild soap</li>
                                        <li>Avoid abrasive steel scrubbers</li>
                                        <li>Refer to the product label for material-specific care</li>
                                    </ul>
                                )}
                                {activeTab === 'shipping' && (
                                    <p>Shipped in protective packaging with tracking across India. Returns are accepted within 30 days of delivery, subject to the returns policy.</p>
                                )}
                            </div>
                        </div>

                        {/* Trust Highlights */}
                        <div className="grid gap-3 text-[11px] text-cream/55 sm:grid-cols-3 pt-2">
                            <span className="flex items-center gap-1.5"><IconTruck size={16} className="text-gold-400 shrink-0" /> Insured Shipping</span>
                            <span className="flex items-center gap-1.5"><IconShieldCheck size={16} className="text-gold-400 shrink-0" /> Secure checkout</span>
                            <span className="flex items-center gap-1.5"><IconAward size={16} className="text-gold-400 shrink-0" /> Considered selection</span>
                        </div>
                    </div>
                </section>

                {/* Related Products Grid ("Pairs Beautifully With") */}
                {relatedProducts.length > 0 && (
                    <section className="mt-20 border-t border-gold-500/20 pt-12">
                        <div className="mb-8">
                            <h2 className="font-display text-3xl font-bold text-cream">Pairs Beautifully With</h2>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {relatedProducts.map((relProd) => (
                                <ProductCard key={relProd.id} product={relProd} />
                            ))}
                        </div>
                    </section>
                )}

            </main>

            <StoreFooter />
            <CartDrawer />
            <Toast />
        </div>
    );
};

export default ProductDetailPage;
