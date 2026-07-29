import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import CartDrawer from '../components/CartDrawer';
import Header from '../components/Header';
import { IconHeart, IconMinus, IconPlay, IconPlus } from '../components/Icons';
import ProductVariantSelector from '../components/ProductVariantSelector';
import SEOHead from '../components/SEOHead';
import StoreFooter from '../components/StoreFooter';
import Toast from '../components/Toast';
import { useCart } from '../contexts/CartContext';
import { useWishlist } from '../contexts/WishlistContext';
import { api } from '../lib/api';
import { fallbackImage, rupees } from '../lib/commerce';
import { productImagesForVariant, variantOptionName } from '../lib/product-options';
import { Product } from '../types';

export const ProductDetailPage = () => {
    const { productId } = useParams<{ productId: string }>();
    const { addVariant } = useCart();
    const { isInWishlist, toggleWishlist } = useWishlist();
    const [product, setProduct] = useState<Product | null>(null);
    const [selectedVariantId, setSelectedVariantId] = useState('');
    const [activeImage, setActiveImage] = useState(0);
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [adding, setAdding] = useState(false);
    const [addError, setAddError] = useState('');

    useEffect(() => {
        setLoading(true);
        api.product(productId)
            .then((result) => {
                setProduct(result);
                setSelectedVariantId(result.variants[0]?.id || '');
                setActiveImage(0);
            })
            .catch((caught) => setError(caught instanceof Error ? caught.message : 'Product not found.'))
            .finally(() => setLoading(false));
    }, [productId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-obsidian text-cream">
                <Header />
                <main className="mx-auto grid max-w-[1440px] gap-10 px-4 py-10 sm:px-8 lg:grid-cols-2 lg:px-12 lg:py-16">
                    <div className="aspect-square animate-pulse bg-panel" />
                    <div className="h-96 animate-pulse bg-carbon" />
                </main>
            </div>
        );
    }

    if (!product || error) {
        return (
            <div className="flex min-h-screen flex-col bg-obsidian text-cream">
                <Header />
                <main className="grid flex-1 place-content-center px-6 text-center">
                    <h1 className="font-display text-4xl font-semibold">This product is unavailable.</h1>
                    <p className="mt-3 text-sm text-cream/65">{error}</p>
                    <Link className="button-primary mx-auto mt-7" to="/">
                        Return to shop
                    </Link>
                </main>
                <StoreFooter />
            </div>
        );
    }

    const variant = product.variants.find((item) => item.id === selectedVariantId) || product.variants[0];
    const productImages = productImagesForVariant(product, variant);
    const imageMedia = productImages.map((image) => ({
        id: image.id,
        type: 'image' as const,
        sortOrder: image.sortOrder,
        altText: image.altText,
        url: image.largeUrl,
        thumbnailUrl: image.thumbnailUrl,
    }));
    if (imageMedia.length === 0) {
        imageMedia.push({
            id: `fallback-${variant?.id || product.id}`,
            type: 'image' as const,
            sortOrder: 0,
            altText: `${product.name}${variant ? ` — ${variantOptionName(variant)}` : ''}`,
            url: fallbackImage,
            thumbnailUrl: fallbackImage,
        });
    }
    const gallery = [
        ...imageMedia,
        ...product.videos.map((video) => ({
            id: video.id,
            type: 'video' as const,
            sortOrder: video.sortOrder,
            altText: video.altText,
            url: video.url,
        })),
    ];
    const activeMedia = gallery[activeImage] || gallery[0];
    const isWishlisted = isInWishlist(product.id);

    const add = async () => {
        if (!variant) return;
        setAdding(true);
        setAddError('');
        try {
            await addVariant(variant, quantity);
        } catch (caught) {
            setAddError(caught instanceof Error ? caught.message : 'This item could not be added.');
        } finally {
            setAdding(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col bg-obsidian font-body text-cream">
            <SEOHead title={`${product.name} | Glockery Home Centre`} product={product} />
            <Header />

            <main id="main-content" className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-8 sm:px-8 lg:px-12 lg:py-14">
                <nav className="mb-7 text-sm text-cream/60">
                    <Link to="/" className="hover:text-cream">
                        Shop
                    </Link>
                    <span className="mx-2" aria-hidden="true">
                        /
                    </span>
                    <Link to={`/category/${product.category.slug}`} className="hover:text-cream">
                        {product.category.name}
                    </Link>
                </nav>

                <section className="grid gap-9 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
                    <div>
                        <div className="relative aspect-square overflow-hidden bg-panel">
                            {activeMedia.type === 'video' ? (
                                <video
                                    controls
                                    preload="metadata"
                                    className="h-full w-full bg-black object-contain"
                                    aria-label={activeMedia.altText || product.name}
                                >
                                    <source src={activeMedia.url} />
                                    Your browser does not support this product video.
                                </video>
                            ) : (
                                <img
                                    src={activeMedia.url || fallbackImage}
                                    alt={activeMedia.altText || product.name}
                                    className="h-full w-full object-cover"
                                    onError={(event) => {
                                        event.currentTarget.src = fallbackImage;
                                    }}
                                />
                            )}
                        </div>

                        {gallery.length > 1 && (
                            <div className="mt-3 flex gap-3 overflow-x-auto">
                                {gallery.map((item, index) => (
                                    <button
                                        key={item.id}
                                        onClick={() => setActiveImage(index)}
                                        aria-label={`View ${item.type === 'video' ? 'video' : 'image'} ${index + 1}`}
                                        className={`size-20 shrink-0 overflow-hidden border ${activeImage === index ? 'border-gold-400' : 'border-line opacity-65 hover:opacity-100'}`}
                                    >
                                        {item.type === 'video' ? (
                                            <span className="grid h-full place-items-center bg-carbon text-cream">
                                                <IconPlay size={22} />
                                            </span>
                                        ) : (
                                            <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="lg:sticky lg:top-28 lg:self-start">
                        <p className="text-sm text-cream/60">{product.category.name}</p>
                        <div className="mt-2 flex items-start justify-between gap-4">
                            <h1 className="font-display text-5xl font-semibold leading-[1.02] tracking-[-0.025em] sm:text-6xl">{product.name}</h1>
                            <button
                                onClick={() => toggleWishlist(product.id)}
                                className={`grid size-11 shrink-0 place-items-center ${isWishlisted ? 'text-gold-300' : 'text-cream/60 hover:text-cream'}`}
                                aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
                                aria-pressed={isWishlisted}
                            >
                                <IconHeart size={21} />
                            </button>
                        </div>
                        <p className="mt-5 max-w-xl text-sm leading-7 text-cream/70">{product.description || product.shortDescription}</p>

                        <div className="mt-7 flex items-baseline gap-3 border-y border-line py-5">
                            <strong className="font-display text-3xl font-semibold text-cream">{variant ? rupees(variant.pricePaise) : 'Unavailable'}</strong>
                            {variant?.compareAtPricePaise && variant.compareAtPricePaise > variant.pricePaise && (
                                <s className="text-sm text-cream/60">{rupees(variant.compareAtPricePaise)}</s>
                            )}
                        </div>

                        <ProductVariantSelector
                            product={product}
                            selectedVariantId={variant?.id || ''}
                            onSelect={(variantId) => {
                                setSelectedVariantId(variantId);
                                setActiveImage(0);
                                setAddError('');
                            }}
                        />

                        {variant && (
                            <p className="mt-3 text-xs text-cream/55" aria-live="polite">
                                Selected: {variantOptionName(variant)} · SKU {variant.sku}
                            </p>
                        )}

                        <div className="mt-7 flex gap-3">
                            <div className="flex h-12 border border-line">
                                <button
                                    className="grid w-11 place-items-center text-cream/70 hover:text-cream"
                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    aria-label="Decrease quantity"
                                >
                                    <IconMinus size={14} />
                                </button>
                                <span className="grid w-8 place-items-center text-sm tabular-nums">{quantity}</span>
                                <button
                                    className="grid w-11 place-items-center text-cream/70 hover:text-cream"
                                    onClick={() => setQuantity(Math.min(99, quantity + 1))}
                                    aria-label="Increase quantity"
                                >
                                    <IconPlus size={14} />
                                </button>
                            </div>
                            <button disabled={!variant || adding} onClick={add} className="button-primary flex-1 disabled:opacity-40">
                                {adding ? 'Adding…' : 'Add to bag'}
                            </button>
                        </div>
                        {addError && (
                            <p className="mt-3 text-xs text-red-200" role="alert">
                                {addError} Please try again.
                            </p>
                        )}

                        <dl className="mt-8 divide-y divide-line border-y border-line text-sm">
                            {product.material && (
                                <div className="flex justify-between gap-6 py-4">
                                    <dt className="text-cream/60">Material</dt>
                                    <dd className="text-right text-cream">{product.material}</dd>
                                </div>
                            )}
                            {product.dimensions && (
                                <div className="flex justify-between gap-6 py-4">
                                    <dt className="text-cream/60">Dimensions</dt>
                                    <dd className="text-right text-cream">{product.dimensions}</dd>
                                </div>
                            )}
                            <div className="flex justify-between gap-6 py-4">
                                <dt className="text-cream/60">Delivery</dt>
                                <dd className="text-right text-cream">Free delivery across India</dd>
                            </div>
                            <div className="flex justify-between gap-6 py-4">
                                <dt className="text-cream/60">Questions?</dt>
                                <dd className="text-right">
                                    <a href="https://wa.me/916282000289" target="_blank" rel="noreferrer" className="text-gold-300 hover:text-gold-100">
                                        Ask on WhatsApp
                                    </a>
                                </dd>
                            </div>
                        </dl>
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
