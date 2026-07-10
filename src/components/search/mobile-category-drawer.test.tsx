/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { PlpCategoryContext } from '@/lib/category/plp-category-context';
import type { BatteryIncludedFacet } from '@/platform/services/model/common';
import { MobileCategoryDrawer } from './mobile-category-drawer';

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
        <button type="button" aria-label="close" onClick={onClose}>
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
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'filterButton' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByTestId('plp-category-tree-nested')).toBeInTheDocument();
    expect(screen.getByTestId('plp-facet-panel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'showProducts:12' })).toBeInTheDocument();
    const tree = screen.getByTestId('plp-category-tree-nested');
    const facetPanel = screen.getByTestId('plp-facet-panel');
    const cta = screen.getByRole('button', { name: 'showProducts:12' });

    expect(tree.compareDocumentPosition(facetPanel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(facetPanel.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'filterButton' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'filterButton' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'showProducts:12' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
