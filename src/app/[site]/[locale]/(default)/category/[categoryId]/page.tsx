import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { type CategoryFilterNode, CategoryFilters } from '@/components/category/category-filters';
import { CategoryProductGrid } from '@/components/category/category-product-grid';
import { UiBreadcrumb } from '@/components/ui/molecules/ui-breadcrumb';
import { generateBreadcrumbForCategory } from '@/lib/breadcrumb';
import {
  flattenCategoryIds,
  getCategoryFilterTree,
  getCategoryWithParents,
  getProductsForCategories,
  getProductsForCategory,
  resolveLocalizedName,
} from '@/lib/ssr/category';
import { getPageTitle } from '@/lib/ssr/seo';
import type { Category } from '@/platform/services/model/category';
import type { LocalizedString } from '@/platform/services/model/common';

interface CategoryPageParams {
  params: Promise<{ locale: string; categoryId: string }>;
  searchParams: Promise<Record<string, string | string[]>>;
}

function getSelectedCategoryIds(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const values = Array.isArray(value) ? value : value.split(',');
  return [...new Set(values.map((id) => id.trim()).filter(Boolean))];
}

function toFilterNodes(categories: Category[], locale: string): CategoryFilterNode[] {
  return categories.map((category) => ({
    id: category.id,
    label: resolveLocalizedName(category.name as LocalizedString | string, locale),
    children: toFilterNodes((category.children as Category[] | undefined) ?? [], locale),
  }));
}

export async function generateMetadata({ params }: CategoryPageParams): Promise<Metadata> {
  const { locale, categoryId } = await params;
  const category = await getCategoryWithParents(categoryId);
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
  const requestedIds = getSelectedCategoryIds(rawParams.c ?? rawParams.subcategory);

  const [category, filterTree] = await Promise.all([
    getCategoryWithParents(categoryId),
    getCategoryFilterTree(categoryId),
  ]);

  if (!category) {
    notFound();
  }

  const selectableIds = new Set(flattenCategoryIds(filterTree));
  const selectedIds = requestedIds.filter((id) => selectableIds.has(id));

  const { products } =
    selectedIds.length > 0
      ? await getProductsForCategories(selectedIds, page, pageSize)
      : await getProductsForCategory(categoryId, page, pageSize);

  const t = await getTranslations({ locale, namespace: 'search.searchResults' });
  const breadcrumbs = generateBreadcrumbForCategory(category, locale);
  const filterNodes = toFilterNodes(filterTree, locale);

  return (
    <>
      <UiBreadcrumb items={breadcrumbs} className="max-w-6xl mx-auto px-4 lg:px-9 sm:gap-x-6" />
      <div className="max-w-6xl mx-auto px-4 lg:px-9 pb-32">
        <CategoryFilters
          nodes={filterNodes}
          selectedIds={selectedIds}
          baseHref={`/category/${categoryId}`}
          excludeId={categoryId}
        />

        {products.length > 0 && (
          <p className="text-sm text-text-subtle mb-6">
            {t('showing', { start: 1, end: products.length, total: products.length })}
          </p>
        )}

        <CategoryProductGrid products={products} locale={locale} />

        {products.length === 0 && <p className="text-text-subtle py-12 text-center">{t('noProductsFound')}</p>}
      </div>
    </>
  );
}
