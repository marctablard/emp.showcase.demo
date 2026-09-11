import type { ReactNode } from 'react';
import { setRequestLocale } from 'next-intl/server';
import Footer from '@/components/footer';
import { FooterLinks, FooterWrapper, LegalFooter } from '@/components/footer/footer';
import { Header } from '@/components/header/header';
import { CategoryDisplayLabelIndexProvider } from '@/components/navigation/category-display-label-index-context';
import { ProductsModeProvider } from '@/components/navigation/products-mode-context';
import { ProductsModeSessionSync } from '@/components/navigation/products-mode-session-sync';
import { buildCategoryDisplayLabelIndex } from '@/lib/navigation/build-category-display-label-index';
import { categoriesToSubMenuItems } from '@/lib/navigation/categories-to-submenu';
import { getNavigationRootCategoriesPageSize } from '@/lib/navigation/navigation-root-categories-page-size';
import { takeRootCategoryPage } from '@/lib/navigation/take-root-category-page';
import { getNavigationCategoryTreesForMode, getProductsModeContext, isSegmentedMode } from '@/lib/ssr/products-mode';
import { setRequestSite } from '@/site/server/';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string; site: string }>;
};

/**
 * Shared chrome for `(default)` and `(no-margin)` routes: one navigation tree load per
 * `[locale]` segment while switching between them (e.g. `/` ↔ `/browse`), plus category
 * labels for search chips. `(reduced)` checkout stays outside this shell.
 *
 * COP-4822: the products mode is resolved once per request (React `cache()`), the header /
 * footer forest follows it (segment forest in `assigned` mode only; the `all` opt-out renders the
 * site-wide forest and "All Products" labels like an anonymous customer) and the mode is seeded
 * into `ProductsModeProvider` for client components. `ProductsModeSessionSync` refreshes this
 * server tree when the client session (dialog login / expired session) disagrees with the mode.
 */
export default async function NavShellLayout({ children, params }: Props) {
  const { locale, site } = await params;
  setRequestSite(site);
  setRequestLocale(locale);

  const ctx = await getProductsModeContext(site);
  const isSegmented = isSegmentedMode(ctx);
  const productsMode = {
    mode: ctx.mode,
    isSegmented,
    canToggleAllProducts: ctx.canToggleAllProducts,
    customerId: ctx.customerId,
  };

  const navigationRoots = await getNavigationCategoryTreesForMode(site, locale, ctx);
  const allProductCategorySubmenu = categoriesToSubMenuItems(navigationRoots, locale);
  const rootCategoriesPageSize = getNavigationRootCategoriesPageSize();
  const {
    visible: productCategorySubmenu,
    truncated: productCategorySubmenuTruncated,
    total: navigationRootCategoryTotal,
  } = takeRootCategoryPage(allProductCategorySubmenu, rootCategoriesPageSize);
  const topProductCategories = productCategorySubmenu.map(({ label, href }) => ({ label, href }));
  const categoryDisplayLabelIndex = buildCategoryDisplayLabelIndex(navigationRoots, locale);

  return (
    <ProductsModeProvider value={productsMode}>
      <ProductsModeSessionSync />
      <Header
        productCategorySubmenu={productCategorySubmenu.length > 0 ? productCategorySubmenu : null}
        navigationRootCategoryTotal={navigationRootCategoryTotal}
      />
      <CategoryDisplayLabelIndexProvider labelIndex={categoryDisplayLabelIndex}>
        {children}
      </CategoryDisplayLabelIndexProvider>
      <footer>
        <FooterWrapper>
          <FooterLinks
            topProductCategories={topProductCategories}
            showAllProductsBrowse={productCategorySubmenuTruncated}
            assignedProductsMode={isSegmented}
          />
          <Footer />
        </FooterWrapper>
        <LegalFooter />
      </footer>
    </ProductsModeProvider>
  );
}
