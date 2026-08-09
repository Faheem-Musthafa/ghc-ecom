import type { Metadata } from 'next';
import CategoryPage from '../../../views/category';
import { getCachedProducts } from '../../../lib/server-catalogue';
import { titleCase } from '../../../lib/commerce';

export const revalidate = 0;

interface PageProps {
  params: Promise<{ categoryId: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}

const pageNumber = (value?: string | string[]) => {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { categoryId } = await params;
  return {
    title: `${titleCase(categoryId.replace(/-/g, ' '))} collection`,
    description: `Shop ${titleCase(categoryId.replace(/-/g, ' '))} from Glockery Home Centre, Vengara.`,
  };
}

export default async function Page({ params, searchParams }: PageProps) {
  const { categoryId } = await params;
  const query = await searchParams;
  const page = pageNumber(query.page);
  const requestParams = new URLSearchParams({
    page: String(page),
    limit: '24',
    category: categoryId,
  });
  const initialData = await getCachedProducts(requestParams).catch(() => undefined);

  return (
    <CategoryPage
      initialCategoryId={categoryId}
      initialData={initialData}
      initialPage={page}
    />
  );
}
