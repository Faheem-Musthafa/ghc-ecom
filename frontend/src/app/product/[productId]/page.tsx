import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProductDetailPage from '../../../views/product';
import { CatalogueApiError, getCachedProduct } from '../../../lib/server-catalogue';

export const revalidate = 0;

interface PageProps {
  params: Promise<{ productId: string }>;
}

async function productForSlug(slug: string) {
  try {
    return await getCachedProduct(slug);
  } catch (error) {
    if (error instanceof CatalogueApiError && error.status === 404) notFound();
    return undefined;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { productId } = await params;
  const product = await productForSlug(productId);
  if (!product) return { title: 'Product unavailable', robots: { index: false, follow: false } };

  return {
    title: product.name,
    description: product.shortDescription || product.description || `Shop ${product.name} at Glockery Home Centre.`,
    openGraph: {
      title: product.name,
      description: product.shortDescription || product.description || undefined,
      images: product.images[0]?.largeUrl ? [{ url: product.images[0].largeUrl, alt: product.images[0].altText }] : [],
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { productId } = await params;
  const product = await productForSlug(productId);
  return <ProductDetailPage initialProduct={product} initialSlug={productId} />;
}
