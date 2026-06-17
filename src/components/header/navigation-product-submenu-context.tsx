'use client';

import { type ReactNode, createContext, useContext, useMemo } from 'react';
import type { SubMenuItem } from '@/data/navigation-menu';
import { getNavigationRootCategoriesPageSize } from '@/lib/navigation/navigation-root-categories-page-size';

export type NavigationProductSubmenuState = {
  submenuItems: SubMenuItem[] | null;
  /** Total root categories from the catalog (before slicing for the flyout). */
  totalRootCategoryCount: number;
  /** When true, navigation UIs show a "See all" / "Show all" control linking to /browse. */
  showSeeAllBrowse: boolean;
};

const NavigationProductSubmenuContext = createContext<NavigationProductSubmenuState | null>(null);

export function NavigationProductSubmenuProvider({
  children,
  submenuItems,
  totalRootCategoryCount,
}: {
  children: ReactNode;
  submenuItems: SubMenuItem[] | null;
  totalRootCategoryCount: number;
}) {
  const value = useMemo((): NavigationProductSubmenuState => {
    const pageSize = getNavigationRootCategoriesPageSize();
    return {
      submenuItems,
      totalRootCategoryCount,
      showSeeAllBrowse: totalRootCategoryCount > pageSize,
    };
  }, [submenuItems, totalRootCategoryCount]);

  return <NavigationProductSubmenuContext.Provider value={value}>{children}</NavigationProductSubmenuContext.Provider>;
}

export function useNavigationProductSubmenu(): NavigationProductSubmenuState {
  return (
    useContext(NavigationProductSubmenuContext) ?? {
      submenuItems: null,
      totalRootCategoryCount: 0,
      showSeeAllBrowse: false,
    }
  );
}
