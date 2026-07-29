import React from 'react';
import { primaryImageForVariant, productHasColourOptions, variantColorHex, variantOptionName } from '../lib/product-options';
import { Product } from '../types';

interface ProductVariantSelectorProps {
    product: Product;
    selectedVariantId: string;
    onSelect: (variantId: string) => void;
    compact?: boolean;
}

const ProductVariantSelector: React.FC<ProductVariantSelectorProps> = ({ product, selectedVariantId, onSelect, compact = false }) => {
    const selected = product.variants.find((variant) => variant.id === selectedVariantId) || product.variants[0];
    if (!selected || (product.variants.length === 1 && !productHasColourOptions(product))) return null;

    const label = productHasColourOptions(product) ? 'Colour' : 'Option';
    const groupName = `product-option-${product.id}`;

    return (
        <fieldset className={compact ? 'mt-5' : 'mt-6'}>
            <legend className="mb-3 text-sm font-semibold text-cream">
                {label}: <span className="font-normal text-cream/70">{variantOptionName(selected)}</span>
            </legend>
            <div className="flex flex-wrap gap-2">
                {product.variants.map((variant) => {
                    const image = primaryImageForVariant(product, variant);
                    const colorHex = variantColorHex(variant);
                    return (
                        <label key={variant.id} className={`relative cursor-pointer ${!variant.isActive ? 'cursor-not-allowed opacity-45' : ''}`}>
                            <input
                                className="peer sr-only"
                                type="radio"
                                name={groupName}
                                value={variant.id}
                                checked={variant.id === selected.id}
                                disabled={!variant.isActive}
                                onChange={() => onSelect(variant.id)}
                            />
                            <span
                                className={`flex min-h-12 items-center gap-2 border px-2.5 text-sm text-cream/70 transition-colors hover:border-cream/40 hover:text-cream peer-checked:border-gold-400 peer-checked:bg-gold-400/10 peer-checked:text-cream peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold-300 ${compact ? 'pr-3' : 'pr-4'}`}
                            >
                                {image ? (
                                    <img src={image.thumbnailUrl} alt="" className="size-8 shrink-0 object-cover" />
                                ) : colorHex ? (
                                    <span
                                        className="size-6 shrink-0 rounded-full border border-cream/25 shadow-[0_1px_4px_rgba(0,0,0,0.35)]"
                                        style={{ backgroundColor: colorHex }}
                                        aria-hidden="true"
                                    />
                                ) : null}
                                <span>{variantOptionName(variant)}</span>
                            </span>
                        </label>
                    );
                })}
            </div>
        </fieldset>
    );
};

export default ProductVariantSelector;
