import { Product, ProductImage, ProductVariant } from '../types';

const attributeText = (variant: ProductVariant, key: string): string | undefined => {
    const value = variant.attributes?.[key];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

export const variantOptionName = (variant: ProductVariant): string => attributeText(variant, 'color') || variant.name;

export const variantColorHex = (variant: ProductVariant): string | undefined => {
    const value = attributeText(variant, 'colorHex');
    return value && /^#[0-9a-f]{6}$/i.test(value) ? value : undefined;
};

export const productHasColourOptions = (product: Product): boolean => product.variants.some((variant) => Boolean(attributeText(variant, 'color')));

export const productImagesForVariant = (product: Product, variant?: ProductVariant): ProductImage[] => {
    const shared = product.images.filter((image) => !image.variantId);
    if (!variant) return shared.length ? shared : product.images;
    const specific = product.images.filter((image) => image.variantId === variant.id);
    return specific.length ? [...specific, ...shared] : shared;
};

export const primaryImageForVariant = (product: Product, variant?: ProductVariant): ProductImage | undefined => productImagesForVariant(product, variant)[0];
