import { Product, ProductImage, ProductVariant } from "../types";

export type VariantDimension = "color" | "size" | "packQuantity";

const attributeText = (variant: ProductVariant, key: string): string | undefined => {
    const value = variant.attributes?.[key];
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
};

export const variantColor = (variant: ProductVariant): string | undefined => attributeText(variant, "color");
export const variantSize = (variant: ProductVariant): string | undefined => attributeText(variant, "size");

export const variantPackQuantity = (variant: ProductVariant): number | undefined => {
    const value = variant.attributes?.packQuantity;
    return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
};

export const variantDimensionValue = (variant: ProductVariant, dimension: VariantDimension): string | undefined => {
    if (dimension === "packQuantity") {
        const quantity = variantPackQuantity(variant);
        return quantity === undefined ? undefined : String(quantity);
    }
    return dimension === "color" ? variantColor(variant) : variantSize(variant);
};

export const variantDimensionLabel = (dimension: VariantDimension, value: string): string => (dimension === "packQuantity" ? `Pack of ${value}` : value);

export const variantOptionLabel = (variant: ProductVariant): string => {
    const values = [variantColor(variant), variantSize(variant), variantPackQuantity(variant) ? `Pack of ${variantPackQuantity(variant)}` : undefined].filter(
        (value): value is string => Boolean(value),
    );
    return values.length ? values.join(" · ") : variant.sku;
};

export const variantColorHex = (variant: ProductVariant): string | undefined => {
    const value = attributeText(variant, "colorHex");
    return value && /^#[0-9a-f]{6}$/i.test(value) ? value : undefined;
};

export const productVariantDimensions = (product: Product): VariantDimension[] =>
    (["color", "size", "packQuantity"] as const).filter((dimension) => product.variants.some((variant) => variantDimensionValue(variant, dimension) !== undefined));

export const productHasColourOptions = (product: Product): boolean => productVariantDimensions(product).includes("color");

export const productImageVariantIds = (image: ProductImage): string[] => image.variantLinks?.map((link) => link.variantId) ?? (image.variantId ? [image.variantId] : []);

export const productImagesForVariant = (product: Product, variant?: ProductVariant): ProductImage[] => {
    const shared = product.images.filter((image) => productImageVariantIds(image).length === 0);
    if (!variant) return shared.length ? shared : product.images;
    const specific = product.images.filter((image) => productImageVariantIds(image).includes(variant.id));
    return specific.length ? [...specific, ...shared] : shared;
};

export const primaryImageForVariant = (product: Product, variant?: ProductVariant): ProductImage | undefined => productImagesForVariant(product, variant)[0];

export const variantPricesDiffer = (product: Product): boolean => new Set(product.variants.filter((variant) => variant.isActive).map((variant) => variant.pricePaise)).size > 1;

export const lowestPricedVariant = (product: Product): ProductVariant | undefined =>
    product.variants
        .filter((variant) => variant.isActive)
        .reduce<ProductVariant | undefined>((lowest, variant) => (!lowest || variant.pricePaise < lowest.pricePaise ? variant : lowest), undefined);
