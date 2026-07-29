import React, { useEffect } from 'react';
import { Product } from '../types';

export const serializeJsonLd = (value: unknown): string =>
    JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');

interface SEOHeadProps {
    title?: string;
    description?: string;
    canonical?: string;
    product?: Product;
    structuredData?: Record<string, unknown>;
    noIndex?: boolean;
}

const SEOHead = ({
    title = 'Glockery Home Centre Vengara | Crockery & Kitchenware',
    description = 'Shop premium crockery, dinner sets, tea sets, serving dishes, canisters and kitchenware from Glockery Home Centre in Vengara, Malappuram.',
    canonical,
    product,
    structuredData,
    noIndex = false,
}: SEOHeadProps) => {
    const canonicalHref = canonical || (typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}`
        : undefined);

    useEffect(() => {
        document.title = title;

        // Meta Description
        let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.name = 'description';
            document.head.appendChild(metaDesc);
        }
        metaDesc.content = description;

        // OpenGraph Title
        let ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
        if (!ogTitle) {
            ogTitle = document.createElement('meta');
            ogTitle.setAttribute('property', 'og:title');
            document.head.appendChild(ogTitle);
        }
        ogTitle.content = title;

        // OpenGraph Description
        let ogDesc = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
        if (!ogDesc) {
            ogDesc = document.createElement('meta');
            ogDesc.setAttribute('property', 'og:description');
            document.head.appendChild(ogDesc);
        }
        ogDesc.content = description;

        let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
        if (!robots) {
            robots = document.createElement('meta');
            robots.name = 'robots';
            document.head.appendChild(robots);
        }
        robots.content = noIndex ? 'noindex, nofollow' : 'index, follow';

        // Canonical URL
        if (canonicalHref) {
            let linkCanonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
            if (!linkCanonical) {
                linkCanonical = document.createElement('link');
                linkCanonical.rel = 'canonical';
                document.head.appendChild(linkCanonical);
            }
            linkCanonical.href = canonicalHref;
        }
    }, [title, description, canonicalHref, noIndex]);

    // Product JSON-LD Schema
    const prices = product?.variants.map((variant) => variant.pricePaise / 100) ?? [];
    const offers = product && prices.length === 1 ? {
        '@type': 'Offer',
        priceCurrency: 'INR',
        price: prices[0].toFixed(2),
        url: canonicalHref,
    } : product && prices.length > 1 ? {
        '@type': 'AggregateOffer',
        priceCurrency: 'INR',
        lowPrice: Math.min(...prices).toFixed(2),
        highPrice: Math.max(...prices).toFixed(2),
        offerCount: prices.length,
        url: canonicalHref,
    } : undefined;
    const productSchema = product ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        image: product.images.map((image) => image.largeUrl),
        description: product.description || product.shortDescription,
        sku: product.variants[0]?.sku,
        brand: { '@type': 'Brand', name: 'Glockery Home Centre' },
        url: canonicalHref,
        offers,
    } : null;

    const schemaToRender = structuredData || productSchema;

    if (!schemaToRender) return null;

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: serializeJsonLd(schemaToRender) }}
        />
    );
};

export default SEOHead;
