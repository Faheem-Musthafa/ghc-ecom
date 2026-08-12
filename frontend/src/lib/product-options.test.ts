import { describe, expect, it } from "vitest";
import { Product } from "../types";
import { lowestPricedVariant, productImagesForVariant, productVariantDimensions, variantOptionLabel, variantPricesDiffer } from "./product-options";

const product: Product = {
    id: "product-id",
    categoryId: "category-id",
    name: "Serving Set",
    slug: "serving-set",
    status: "PUBLISHED",
    category: {
        id: "category-id",
        name: "Serveware",
        slug: "serveware",
        isPublished: true,
        sortOrder: 0,
    },
    variants: [
        {
            id: "green-large-1",
            sku: "GREEN-L-1",
            pricePaise: 1_000,
            attributes: { color: "Green", size: "Large", packQuantity: 1 },
            isActive: true,
            availableStock: 3,
        },
        {
            id: "green-large-2",
            sku: "GREEN-L-2",
            pricePaise: 1_800,
            attributes: { color: "Green", size: "Large", packQuantity: 2 },
            isActive: true,
            availableStock: 2,
        },
    ],
    images: [
        {
            id: "green-image",
            thumbnailUrl: "/green-thumb.webp",
            mediumUrl: "/green.webp",
            largeUrl: "/green-large.webp",
            altText: "Green",
            sortOrder: 0,
            variantLinks: [{ variantId: "green-large-1" }, { variantId: "green-large-2" }],
        },
        {
            id: "shared-image",
            thumbnailUrl: "/shared-thumb.webp",
            mediumUrl: "/shared.webp",
            largeUrl: "/shared-large.webp",
            altText: "Shared",
            sortOrder: 1,
            variantLinks: [],
        },
    ],
    videos: [],
};

describe("product options", () => {
    it("builds a combined label and exposes separate selector dimensions", () => {
        expect(variantOptionLabel(product.variants[1])).toBe("Green · Large · Pack of 2");
        expect(productVariantDimensions(product)).toEqual(["color", "size", "packQuantity"]);
    });

    it("reuses one colour image for every associated exact combination, before shared images", () => {
        expect(productImagesForVariant(product, product.variants[0]).map((image) => image.id)).toEqual(["green-image", "shared-image"]);
        expect(productImagesForVariant(product, product.variants[1]).map((image) => image.id)).toEqual(["green-image", "shared-image"]);
    });

    it("detects variable pricing and selects the lowest active price for From pricing", () => {
        expect(variantPricesDiffer(product)).toBe(true);
        expect(lowestPricedVariant(product)?.id).toBe("green-large-1");
    });
});
