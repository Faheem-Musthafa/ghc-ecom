import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useWishlist } from '../contexts/WishlistContext';
import { fallbackImage, rupees } from '../lib/commerce';
import { Product } from '../types';
import { IconArrowRight, IconEye, IconHeart, IconShoppingBag } from './Icons';
import QuickViewModal from './QuickViewModal';

const ProductCard = ({ product, priority = false }: { product: Product; priority?: boolean }) => {
    const { addVariant } = useCart();
    const { isInWishlist, toggleWishlist } = useWishlist();
    const [adding, setAdding] = useState(false);
    const [quickViewOpen, setQuickViewOpen] = useState(false);

    const variant = product.variants?.[0];
    const image = product.images?.[0]?.mediumUrl || fallbackImage;
    const isWishlisted = isInWishlist(product.id);
    const hasDiscount = Boolean(variant?.compareAtPricePaise && variant.compareAtPricePaise > variant.pricePaise);
    const discountPercent = hasDiscount
        ? Math.round(((variant!.compareAtPricePaise! - variant!.pricePaise) / variant!.compareAtPricePaise!) * 100)
        : null;

    const add = async (event: React.MouseEvent) => {
        event.preventDefault();
        if (!variant) return;
        setAdding(true);
        try {
            await addVariant(variant);
        } finally {
            setAdding(false);
        }
    };

    return (
        <>
            <article className="group flex min-w-0 flex-col border-b border-line pb-5">
                <div className="relative aspect-[4/5] overflow-hidden bg-panel">
                    <Link to={`/product/${product.slug}`} className="block h-full" aria-label={`View ${product.name}`}>
                        <img
                            src={image}
                            alt={product.images?.[0]?.altText || product.name}
                            loading={priority ? 'eager' : 'lazy'}
                            width={640}
                            height={800}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025]"
                            onError={(event) => { event.currentTarget.src = fallbackImage; }}
                        />
                    </Link>

                    {discountPercent && (
                        <span className="absolute left-3 top-3 bg-cream px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-obsidian">
                            Save {discountPercent}%
                        </span>
                    )}

                    <button
                        onClick={(event) => { event.preventDefault(); toggleWishlist(product.id); }}
                        className={`absolute right-2 top-2 grid size-11 place-items-center border transition-colors ${isWishlisted ? 'border-gold-400 bg-gold-400 text-obsidian' : 'border-line bg-obsidian/90 text-cream hover:border-gold-400 hover:text-gold-300'}`}
                        aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
                        aria-pressed={isWishlisted}
                    >
                        <IconHeart size={18} />
                    </button>

                    <button
                        onClick={() => setQuickViewOpen(true)}
                        className="absolute bottom-3 right-3 hidden min-h-11 items-center gap-2 border border-gold-500/60 bg-obsidian px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-gold-200 hover:bg-gold-400 hover:text-obsidian sm:flex"
                    >
                        <IconEye size={15} /> Quick view
                    </button>
                </div>

                <div className="flex flex-1 flex-col pt-4">
                    <p className="eyebrow">{product.category?.name || 'Homeware'}</p>
                    <h3 className="mt-1 font-display text-2xl font-semibold leading-tight text-cream">
                        <Link to={`/product/${product.slug}`} className="hover:text-gold-200">{product.name}</Link>
                    </h3>
                    {product.shortDescription && (
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-cream/50">{product.shortDescription}</p>
                    )}

                    <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                        <div>
                            <span className="block text-sm font-semibold tabular-nums text-cream">
                                {variant ? rupees(variant.pricePaise) : 'Unavailable'}
                            </span>
                            {hasDiscount && (
                                <s className="mt-0.5 block text-[10px] tabular-nums text-cream/40">{rupees(variant!.compareAtPricePaise!)}</s>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <Link to={`/product/${product.slug}`} className="grid size-11 place-items-center border border-line text-cream/65 hover:border-gold-400 hover:text-gold-300" aria-label={`View ${product.name}`}>
                                <IconArrowRight size={16} />
                            </Link>
                            <button
                                disabled={!variant || adding}
                                onClick={add}
                                className="grid size-11 place-items-center bg-gold-400 text-obsidian hover:bg-gold-300 disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label={`Add ${product.name} to bag`}
                            >
                                <IconShoppingBag size={17} />
                            </button>
                        </div>
                    </div>
                </div>
            </article>

            {quickViewOpen && <QuickViewModal product={product} onClose={() => setQuickViewOpen(false)} />}
        </>
    );
};

export default ProductCard;
