/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { type ProductsModeContextValue, ProductsModeProvider } from '@/components/navigation/products-mode-context';
import type { PlpCategoryContext } from '@/lib/category/plp-category-context';
import { PlpCategoryBreadcrumbs } from './plp-category-breadcrumbs';

const rootContext: PlpCategoryContext = {
  ancestorTrail: [],
  currentCategory: undefined,
  currentChildren: [],
  ribbonCategories: [],
  sidebarCountCategoryIds: [],
};

const assignedMode: ProductsModeContextValue = { mode: 'assigned', isSegmented: true, canToggleAllProducts: true };
const allMode: ProductsModeContextValue = { mode: 'all', isSegmented: true, canToggleAllProducts: true };

const renderWithMode = (mode: ProductsModeContextValue, plpCategoryContext: PlpCategoryContext = rootContext) =>
  render(
    <ProductsModeProvider value={mode}>
      <PlpCategoryBreadcrumbs plpCategoryContext={plpCategoryContext} locale="en" />
    </ProductsModeProvider>,
  );

let mockSearchParams = new URLSearchParams('currency=EUR&q=solar&filters[brand]=X');

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
  Link: React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(function MockLink(
    { children, ...props },
    ref,
  ) {
    return (
      <a ref={ref} {...props}>
        {children}
      </a>
    );
  }),
}));

describe('PlpCategoryBreadcrumbs', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams('currency=EUR&q=solar&filters[brand]=X');
  });

  it('renders a dynamic category trail with matching category browse links', () => {
    const parent = { id: 'parent-1', name: { en: 'Parent 1' }, children: [] };
    const child = { id: 'child-1', name: { en: 'Child 1' }, children: [] };
    const plpCategoryContext: PlpCategoryContext = {
      ancestorTrail: [{ kind: 'virtual-all-products' }, { kind: 'category', category: parent }],
      currentCategory: child,
      currentChildren: [],
      ribbonCategories: [],
      sidebarCountCategoryIds: [],
    };

    render(<PlpCategoryBreadcrumbs plpCategoryContext={plpCategoryContext} locale="en" />);

    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveTextContent('homeLink');
    expect(links[0]).toHaveAttribute('href', '/');
    expect(links[1]).toHaveTextContent('allProducts');
    expect(links[1]).toHaveAttribute('href', '/browse?currency=EUR');
    expect(links[2]).toHaveTextContent('searchResults');
    expect(links[2]).toHaveAttribute('href', '/browse?currency=EUR&q=solar&filters%5Bbrand%5D=X');
    expect(links[3]).toHaveTextContent('Parent 1');
    expect(links[3]).toHaveAttribute(
      'href',
      expect.stringContaining('/browse?currency=EUR&q=solar&filters%5Bbrand%5D=X&filters%5BcategoryIds%5D=parent-1'),
    );
    expect(screen.getByText('Child 1')).toHaveAttribute('aria-current', 'page');
  });

  it('falls back to Home -> All Products at the root level when there are NO resettable params', () => {
    mockSearchParams = new URLSearchParams('currency=EUR');
    const plpCategoryContext: PlpCategoryContext = {
      ancestorTrail: [],
      currentCategory: undefined,
      currentChildren: [],
      ribbonCategories: [],
      sidebarCountCategoryIds: [],
    };

    render(<PlpCategoryBreadcrumbs plpCategoryContext={plpCategoryContext} locale="en" />);

    expect(screen.getByRole('link', { name: 'homeLink' })).toHaveAttribute('href', '/');
    expect(screen.getByText('allProducts').closest('li')).toHaveAttribute('aria-current', 'page');
  });

  it('renders Search Results as the terminal breadcrumb for query-only searches', () => {
    mockSearchParams = new URLSearchParams('currency=EUR&q=solar');
    const plpCategoryContext: PlpCategoryContext = {
      ancestorTrail: [],
      currentCategory: undefined,
      currentChildren: [],
      ribbonCategories: [],
      sidebarCountCategoryIds: [],
    };

    render(<PlpCategoryBreadcrumbs plpCategoryContext={plpCategoryContext} locale="en" />);

    expect(screen.getByRole('link', { name: 'homeLink' })).toHaveAttribute('href', '/');
    expect(screen.getByText('searchResults').closest('span')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'allProducts' })).toBeInTheDocument();
  });

  it('renders All Products as the current page (non-link) at the root level when there are resettable params EXCEPT facets and sort', () => {
    mockSearchParams = new URLSearchParams('currency=EUR&sort=x&filters[brand]=Victron');
    const plpCategoryContext: PlpCategoryContext = {
      ancestorTrail: [],
      currentCategory: undefined,
      currentChildren: [],
      ribbonCategories: [],
      sidebarCountCategoryIds: [],
    };

    render(<PlpCategoryBreadcrumbs plpCategoryContext={plpCategoryContext} locale="en" />);

    expect(screen.getByRole('link', { name: 'homeLink' })).toHaveAttribute('href', '/');
    const allProductsLink = screen.getByText('allProducts');
    expect(allProductsLink.closest('li')).toHaveAttribute('aria-current', 'page');
  });

  it('does not render the missing-label placeholder for category breadcrumbs', () => {
    const parent = { id: 'parent-1', name: { de: 'Eltern' }, children: [] };
    const child = { id: 'child-1', name: { de: 'Kind' }, children: [] };
    const plpCategoryContext: PlpCategoryContext = {
      ancestorTrail: [{ kind: 'category', category: parent }],
      currentCategory: child,
      currentChildren: [],
      ribbonCategories: [],
      sidebarCountCategoryIds: [],
    };

    render(<PlpCategoryBreadcrumbs plpCategoryContext={plpCategoryContext} locale="en" />);

    expect(screen.queryByText('-')).not.toBeInTheDocument();
  });

  describe('products mode (COP-4822)', () => {
    it('renders Home -> Assigned Products at the root level in assigned mode without a query', () => {
      mockSearchParams = new URLSearchParams('currency=EUR');

      renderWithMode(assignedMode);

      expect(screen.getByRole('link', { name: 'homeLink' })).toHaveAttribute('href', '/');
      expect(screen.getByText('assignedProducts').closest('li')).toHaveAttribute('aria-current', 'page');
      expect(screen.queryByText('allProducts')).not.toBeInTheDocument();
      // Landmark name must match the visible root copy so assistive tech does not announce "All Products".
      expect(screen.getByRole('navigation', { name: 'assignedProducts' })).toBeInTheDocument();
    });

    it('renders Home -> Assigned Products (link) -> Search Results in assigned mode with a query', () => {
      mockSearchParams = new URLSearchParams('currency=EUR&q=abc');

      renderWithMode(assignedMode);

      expect(screen.getByRole('link', { name: 'homeLink' })).toHaveAttribute('href', '/');
      expect(screen.getByRole('link', { name: 'assignedProducts' })).toHaveAttribute('href', '/browse?currency=EUR');
      expect(screen.getByText('searchResults').closest('span')).toBeInTheDocument();
      expect(screen.queryByText('allProducts')).not.toBeInTheDocument();
    });

    it('uses Assigned Products for the virtual root crumb inside a category trail in assigned mode', () => {
      const child = { id: 'child-1', name: { en: 'Child 1' }, children: [] };

      renderWithMode(assignedMode, {
        ...rootContext,
        ancestorTrail: [{ kind: 'virtual-all-products' }],
        currentCategory: child,
      });

      expect(screen.getByRole('link', { name: 'assignedProducts' })).toHaveAttribute('href', '/browse?currency=EUR');
      expect(screen.getByText('Child 1')).toHaveAttribute('aria-current', 'page');
      expect(screen.queryByText('allProducts')).not.toBeInTheDocument();
    });

    it('keeps All Products in ALL mode', () => {
      mockSearchParams = new URLSearchParams('currency=EUR');

      renderWithMode(allMode);

      expect(screen.getByText('allProducts').closest('li')).toHaveAttribute('aria-current', 'page');
      expect(screen.queryByText('assignedProducts')).not.toBeInTheDocument();
    });

    it('keeps All Products for anonymous visitors (no provider)', () => {
      mockSearchParams = new URLSearchParams('currency=EUR');

      render(<PlpCategoryBreadcrumbs plpCategoryContext={rootContext} locale="en" />);

      expect(screen.getByText('allProducts').closest('li')).toHaveAttribute('aria-current', 'page');
      expect(screen.queryByText('assignedProducts')).not.toBeInTheDocument();
      expect(screen.getByRole('navigation', { name: 'allProducts' })).toBeInTheDocument();
    });
  });
});
