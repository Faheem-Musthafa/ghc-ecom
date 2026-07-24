import React, { useEffect } from 'react';
import { Product } from '../types';

export const serializeJsonLd = (value: unknown): string =>
    JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');

const SEOHead = ({
    title = 'Glockery Home Centre | Black & Gold Tableware',
    description = 'Distinctive premium tableware and serveware for modern Indian homes.',
    product,
}: {
    title?: string;
    description?: string;
    product?: Product;
}) => {
    useEffect(() => {
        document.title = title;
        let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'description';
            document.head.appendChild(meta);
        }
        meta.content = description;
    }, [title, description]);

    if (!product) return null;
    const variant = product.variants[0];
    const schema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        image: product.images.map((image) => image.largeUrl),
        description: product.description || product.shortDescription,
        sku: variant?.sku,
        brand: { '@type': 'Brand', name: 'Glockery Home Centre' },
        offers: variant ? {
            '@type': 'Offer',
            priceCurrency: 'INR',
            price: (variant.pricePaise / 100).toFixed(2),
            availability: 'https://schema.org/InStock',
        } : undefined,
    };
    return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }} />;
};
export default SEOHead;
