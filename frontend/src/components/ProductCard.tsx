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

    const add = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!variant) return;
        setAdding(true);
        try { await addVariant(variant); } finally { setAdding(false); }
    };

    const handleWishlistToggle = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        toggleWishlist(product.id);
    };

    return (
        <>
            <article className="group relative flex flex-col justify-between glass-card p-4 rounded-sm border border-gold-500/15 hover:border-gold-400/50 transition duration-300">
                <div className="relative block aspect-[4/5] overflow-hidden bg-obsidian rounded-sm border border-gold-500/10">
                    <Link to={`/product/${product.slug}`}>
                        <img
                            src={image}
                            alt={product.images?.[0]?.altText || product.name}
                            loading={priority ? 'eager' : 'lazy'}
                            className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-105 group-hover:opacity-85"
                            onError={(event) => { event.currentTarget.src = fallbackImage; }}
                        />
                    </Link>

                    {/* Wishlist quick action button */}
                    <button
                        onClick={handleWishlistToggle}
                        className={`absolute top-3 right-3 z-10 p-2 rounded-full border backdrop-blur-md transition ${isWishlisted ? 'border-gold-400 bg-gold-400 text-obsidian' : 'border-gold-500/30 bg-obsidian/70 text-cream/70 hover:text-gold-300 hover:border-gold-400'}`}
                        aria-label="Toggle wishlist"
                    >
                        <IconHeart size={16} />
                    </button>

                    {/* Hover quick action bar */}
                    <div className="absolute inset-x-3 bottom-3 flex gap-2 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition duration-300">
                        <button
                            onClick={(e) => { e.preventDefault(); setQuickViewOpen(true); }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-obsidian/90 backdrop-blur-md border border-gold-400/40 text-[10px] uppercase tracking-widest text-gold-200 hover:bg-gold-400 hover:text-obsidian transition rounded-sm"
                        >
                            <IconEye size={14} /> Quick View
                        </button>
                        <Link
                            to={`/product/${product.slug}`}
                            className="flex items-center justify-center p-2.5 bg-obsidian/90 backdrop-blur-md border border-gold-400/40 text-gold-300 hover:bg-gold-400 hover:text-obsidian transition rounded-sm"
                            aria-label="View product page"
                        >
                            <IconArrowRight size={14} />
                        </Link>
                    </div>
                </div>

                <div className="pt-4 flex-1 flex flex-col justify-between">
                    <div>
                        <p className="mb-1 text-[9px] uppercase tracking-[0.25em] text-gold-400 font-semibold">{product.category?.name || 'Handcrafted'}</p>
                        <h3 className="font-display text-lg tracking-wide text-cream line-clamp-1">
                            <Link className="hover:text-gold-300 transition" to={`/product/${product.slug}`}>{product.name}</Link>
                        </h3>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-cream/45">{product.shortDescription || product.description}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gold-500/10 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-gold-300">{variant ? rupees(variant.pricePaise) : 'Unavailable'}</span>
                            {variant?.compareAtPricePaise && variant.compareAtPricePaise > variant.pricePaise && (
                                <s className="text-[10px] text-cream/35">{rupees(variant.compareAtPricePaise)}</s>
                            )}
                        </div>
                        <button
                            disabled={!variant || adding}
                            onClick={add}
                            className="grid size-9 shrink-0 place-items-center border border-gold-500/30 text-gold-300 hover:bg-gold-400 hover:text-obsidian disabled:opacity-40 transition rounded-sm"
                            aria-label={`Add ${product.name} to bag`}
                        >
                            <IconShoppingBag size={16} />
                        </button>
                    </div>
                </div>
            </article>

            {quickViewOpen && <QuickViewModal product={product} onClose={() => setQuickViewOpen(false)} />}
        </>
    );
};

export default ProductCard;
