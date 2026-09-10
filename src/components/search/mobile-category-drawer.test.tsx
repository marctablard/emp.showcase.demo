/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProductsModeProvider } from '@/components/navigation/products-mode-context';
import type { PlpCategoryContext } from '@/lib/category/plp-category-context';
import type { BatteryIncludedFacet } from '@/platform/services/model/common';
import { MobileCategoryDrawer } from './mobile-category-drawer';

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }),
}));

jest.mock('@/lib/client/customer-segment', () => ({
  setProductsMode: jest.fn(),
}));

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
  Link: ({ children, href, className, onClick }: any) => (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  ),
  usePathname: () => '/',
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) => {
    if (values && 'count' in values) {
      return `${key}:${values.count}`;
    }

    return key;
  },
}));

jest.mock('@/hooks/category/useCategoryProductCounts', () => ({
  useCategoryProductCounts: () => ({
    counts: {},
    requestCounts: jest.fn(),
  }),
}));

jest.mock('@/components/search/facets', () => ({
  PlpFacetPanel: ({ onClose }: { onClose?: () => void }) => (
    <div data-testid="plp-facet-panel">
      {onClose ? (
        <button type="button" aria-label="facet-panel-close" onClick={onClose}>
          close
        </button>
      ) : null}
    </div>
  ),
}));

jest.mock('@/components/ui/drawer', () => {
  const React = require('react');
  const DrawerContext = React.createContext({
    open: false,
    onOpenChange: (_nextOpen: boolean) => {},
  });

  const Drawer = ({ open, onOpenChange, children }: any) => (
    <DrawerContext.Provider value={{ open, onOpenChange }}>{children}</DrawerContext.Provider>
  );

  const DrawerTrigger = ({ asChild, children }: any) => {
    const { onOpenChange } = React.useContext(DrawerContext);
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        onClick: (event: React.MouseEvent) => {
          children.props.onClick?.(event);
          onOpenChange(true);
        },
      });
    }

    return <button onClick={() => onOpenChange(true)}>{children}</button>;
  };

  const DrawerClose = ({ asChild, children }: any) => {
    const { onOpenChange } = React.useContext(DrawerContext);
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        onClick: (event: React.MouseEvent) => {
          children.props.onClick?.(event);
          onOpenChange(false);
        },
      });
    }

    return <button onClick={() => onOpenChange(false)}>{children}</button>;
  };

  const DrawerContent = ({ children }: any) => {
    const { open } = React.useContext(DrawerContext);
    if (!open) {
      return null;
    }

    return <div role="dialog">{children}</div>;
  };

  const DrawerTitle = ({ asChild, children }: any) => {
    if (asChild && React.isValidElement(children)) {
      return children;
    }

    return <h2>{children}</h2>;
  };

  return {
    Drawer,
    DrawerTrigger,
    DrawerClose,
    DrawerContent,
    DrawerTitle,
  };
});

describe('MobileCategoryDrawer', () => {
  const plpCategoryContext: PlpCategoryContext = {
    ancestorTrail: [],
    currentCategory: undefined,
    currentChildren: [],
    ribbonCategories: [],
    sidebarCountCategoryIds: [],
  };

  const facets: BatteryIncludedFacet[] = [
    {
      id: 'color',
      label: 'Color',
      kind: 'select',
      options: [{ id: 'red', label: 'Red', active: false }],
    },
  ];

  it('opens the drawer and renders category tree, facet panel, then CTA in order', async () => {
    render(
      <MobileCategoryDrawer
        plpCategoryContext={plpCategoryContext}
        locale="en"
        total={12}
        facets={facets}
        activeFilters={{}}
        applyFacet={jest.fn()}
        applyRangeFacet={jest.fn()}
        resetFacet={jest.fn()}
        appliedFilterCount={2}
      />,
    );

    fireEvent.click(screen.getByTestId('mobile-category-drawer-toggle'));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByTestId('plp-category-tree-nested')).toBeInTheDocument();
    expect(screen.getByTestId('plp-facet-panel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'showProducts:12' })).toBeInTheDocument();
    expect(screen.getByTestId('mobile-category-drawer-toggle')).toHaveTextContent('2');
    const tree = screen.getByTestId('plp-category-tree-nested');
    const facetPanel = screen.getByTestId('plp-facet-panel');
    const cta = screen.getByRole('button', { name: 'showProducts:12' });

    expect(tree.compareDocumentPosition(facetPanel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(facetPanel.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('mounts the products mode switch above the nested tree when the toggle is available (COP-4822 CR-1)', async () => {
    render(
      <ProductsModeProvider value={{ mode: 'assigned', isSegmented: true, canToggleAllProducts: true }}>
        <MobileCategoryDrawer
          plpCategoryContext={plpCategoryContext}
          locale="en"
          total={12}
          facets={facets}
          activeFilters={{}}
          applyFacet={jest.fn()}
          applyRangeFacet={jest.fn()}
          resetFacet={jest.fn()}
        />
      </ProductsModeProvider>,
    );

    fireEvent.click(screen.getByTestId('mobile-category-drawer-toggle'));

    const dialog = await screen.findByRole('dialog');
    const control = screen.getByTestId('plp-productsModeSwitch');
    const tree = screen.getByTestId('plp-category-tree-nested');

    expect(dialog).toContainElement(control);
    expect(control).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('plp-productsModeLabel')).toHaveTextContent('assignedProducts');
    expect(control.compareDocumentPosition(tree) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('does not mount the products mode switch when the toggle is not available', async () => {
    render(
      <MobileCategoryDrawer
        plpCategoryContext={plpCategoryContext}
        locale="en"
        total={12}
        facets={facets}
        activeFilters={{}}
        applyFacet={jest.fn()}
        applyRangeFacet={jest.fn()}
        resetFacet={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('mobile-category-drawer-toggle'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    expect(screen.queryByTestId('plp-productsModeSwitch')).not.toBeInTheDocument();
  });

  it('closes the drawer through both close affordances', async () => {
    render(
      <MobileCategoryDrawer
        plpCategoryContext={plpCategoryContext}
        locale="en"
        total={12}
        facets={facets}
        activeFilters={{}}
        applyFacet={jest.fn()}
        applyRangeFacet={jest.fn()}
        resetFacet={jest.fn()}
        appliedFilterCount={1}
      />,
    );

    fireEvent.click(screen.getByTestId('mobile-category-drawer-toggle'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mobile-category-drawer-toggle'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'showProducts:12' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
