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
}

const SEOHead = ({
    title = 'Glockery Home Centre | Black & Gold Tableware',
    description = 'Distinctive premium tableware, handcrafted serveware, and gold home accents for modern Indian homes.',
    canonical,
    product,
    structuredData,
}: SEOHeadProps) => {
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

        // Canonical URL
        if (canonical) {
            let linkCanonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
            if (!linkCanonical) {
                linkCanonical = document.createElement('link');
                linkCanonical.rel = 'canonical';
                document.head.appendChild(linkCanonical);
            }
            linkCanonical.href = canonical;
        }
    }, [title, description, canonical]);

    // Product JSON-LD Schema
    const productSchema = product ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        image: product.images.map((image) => image.largeUrl),
        description: product.description || product.shortDescription,
        sku: product.variants[0]?.sku,
        brand: { '@type': 'Brand', name: 'Glockery Home Centre' },
        offers: product.variants[0] ? {
            '@type': 'Offer',
            priceCurrency: 'INR',
            price: (product.variants[0].pricePaise / 100).toFixed(2),
            availability: 'https://schema.org/InStock',
        } : undefined,
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
