import type { ReactNode } from 'react';
import { setRequestLocale } from 'next-intl/server';
import Footer from '@/components/footer';
import { FooterLinks, FooterWrapper, LegalFooter } from '@/components/footer/footer';
import { Header } from '@/components/header/header';
import { CategoryDisplayLabelIndexProvider } from '@/components/navigation/category-display-label-index-context';
import { buildCategoryDisplayLabelIndex } from '@/lib/navigation/build-category-display-label-index';
import { categoriesToSubMenuItems } from '@/lib/navigation/categories-to-submenu';
import { getNavigationRootCategoriesPageSize } from '@/lib/navigation/navigation-root-categories-page-size';
import { takeRootCategoryPage } from '@/lib/navigation/take-root-category-page';
import { getCachedNavigationCategoryTrees } from '@/lib/ssr/navigation-category-trees';
import { setRequestSite } from '@/site/server/';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string; site: string }>;
};

/**
 * Shared chrome for `(default)` and `(no-margin)` routes: one navigation tree load per
 * `[locale]` segment while switching between them (e.g. `/` ↔ `/browse`), plus category
 * labels for search chips. `(reduced)` checkout stays outside this shell.
 */
export default async function NavShellLayout({ children, params }: Props) {
  const { locale, site } = await params;
  setRequestSite(site);
  setRequestLocale(locale);

  const navigationRoots = await getCachedNavigationCategoryTrees(site);
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
    <>
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
          />
          <Footer />
        </FooterWrapper>
        <LegalFooter />
      </footer>
    </>
  );
}
