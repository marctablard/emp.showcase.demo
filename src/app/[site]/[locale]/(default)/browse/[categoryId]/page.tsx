import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CategoryProductGrid } from '@/components/category/category-product-grid';
import { Heading } from '@/components/ui/h';
import { getCategoryById, getProductsForCategory, resolveLocalizedName } from '@/lib/ssr/category';
import { getPageTitle } from '@/lib/ssr/seo';
import { LocalizedString } from '@/platform/services/model/common';

interface CategoryPageParams {
  params: Promise<{ locale: string; categoryId: string }>;
  searchParams: Promise<Record<string, string | string[]>>;
}

export async function generateMetadata({ params }: CategoryPageParams): Promise<Metadata> {
  const { locale, categoryId } = await params;
  const category = await getCategoryById(categoryId);
  const categoryName = category ? resolveLocalizedName(category.name as LocalizedString | string, locale) : categoryId;

  return {
    title: await getPageTitle(categoryName, locale),
    description: `Browse products in ${categoryName}`,
    robots: { index: true, follow: true },
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageParams) {
  const { locale, categoryId } = await params;
  const rawParams = await searchParams;

  const page = rawParams.page ? parseInt(rawParams.page as string, 10) : 0;
  const pageSize = 100;

  const [category, { products }] = await Promise.all([
    getCategoryById(categoryId),
    getProductsForCategory(categoryId, page, pageSize),
  ]);

  if (!category) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: 'search.searchResults' });
  const categoryName = resolveLocalizedName(category.name as LocalizedString | string, locale);

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-9 pb-32">
      <Heading variant="h2" className="mb-6">
        {categoryName}
      </Heading>

      {products.length > 0 && (
        <p className="text-sm text-text-subtle mb-6">
          {t('showing', { start: 1, end: products.length, total: products.length })}
        </p>
      )}

      <CategoryProductGrid products={products} locale={locale} />

      {products.length === 0 && <p className="text-text-subtle py-12 text-center">{t('noProductsFound')}</p>}
    </div>
  );
}
