/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { PlpCategoryContext } from '@/lib/category/plp-category-context';
import { PlpCategoryBreadcrumbs } from './plp-category-breadcrumbs';

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

  it('renders a clickable All Products reset link at the root level when there are resettable params', () => {
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
    const allProductsLink = screen.getByRole('link', { name: 'allProducts' });
    expect(allProductsLink).toHaveAttribute('href', '/browse?currency=EUR');
    expect(allProductsLink.closest('li')).not.toHaveAttribute('aria-current');
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
});
