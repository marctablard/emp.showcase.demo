/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { PlpCategoryContext } from '@/lib/category/plp-category-context';
import { PlpCategoryTree } from './plp-category-tree';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

// Provide minimal mock for next/image if necessary, or other components
jest.mock('@/i18n/navigation', () => ({
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
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

window.HTMLElement.prototype.scrollIntoView = jest.fn();

/* Mock out the helper if needed or use real */
const mockContext: PlpCategoryContext = {
  ancestorTrail: [
    { kind: 'virtual-all-products' },
    { kind: 'category', category: { id: 'parent-1', name: { en: 'Parent 1' }, children: [] } },
  ],
  currentCategory: { id: 'cat-1', name: { en: 'Category 1' }, children: [] },
  currentChildren: [
    { id: 'child-1', name: { en: 'Child 1' }, children: [] },
    { id: 'child-2', name: { en: 'Child 2' }, children: [] },
  ],
  ribbonCategories: [],
  sidebarCountCategoryIds: [],
};

const mockNoFilterContext: PlpCategoryContext = {
  ancestorTrail: [],
  currentCategory: undefined,
  currentChildren: [{ id: 'root-1', name: { en: 'Root 1' }, children: [] }],
  ribbonCategories: [],
  sidebarCountCategoryIds: [],
};

describe('PlpCategoryTree', () => {
  it('renders drill-down hierarchy with current node and ancestors', () => {
    // Override the mock to inject something
    jest
      .spyOn(require('next/navigation'), 'useSearchParams')
      .mockReturnValue(new URLSearchParams('q=tubes&filters[brand]=X'));

    render(
      <PlpCategoryTree
        plpCategoryContext={mockContext}
        locale="en"
        total={100}
        categoryCountsById={{ 'cat-1': 10, 'child-1': 5, 'child-2': 0 }}
      />,
    );

    // Get the breadcrumb links (the ancestors before the current node)
    // We render the ancestors inside a <ul>. Let's find all the links inside that nav list.
    const nav = screen.getByRole('navigation', { name: 'title' });
    const ul = nav.querySelector('ul');
    const breadcrumbLinks = ul ? Array.from(ul.querySelectorAll('a')) : [];

    // Assert that 'All Categories' is at index 0 of the breadcrumb stack
    expect(breadcrumbLinks[0]).toHaveTextContent('allCategories');
    expect(breadcrumbLinks[0]).toHaveAttribute('title', 'allCategories');
    // Check that 'All Categories' drops the category filter but preserves search and brand filter
    expect(breadcrumbLinks[0]).toHaveAttribute('href', expect.stringContaining('q=tubes'));
    expect(breadcrumbLinks[0]).toHaveAttribute('href', expect.stringContaining('filters%5Bbrand%5D=X'));

    // Assert that 'Parent 1' is at index 1 of the breadcrumb stack
    expect(breadcrumbLinks[1]).toHaveTextContent('Parent 1');
    expect(breadcrumbLinks[1]).toHaveAttribute('title', 'Parent 1');

    // Current row
    expect(screen.getByText('Category 1')).toBeInTheDocument();
    const currLink = screen.getByText('Category 1').closest('a');
    expect(currLink).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Category 1')).toHaveAttribute('title', 'Category 1');
    expect(currLink).toHaveAttribute(
      'href',
      expect.stringContaining('/browse?q=tubes&filters%5Bbrand%5D=X&filters%5BcategoryIds%5D=cat-1'),
    );

    // Children row
    expect(screen.getByText('Child 1')).toBeInTheDocument();
    expect(screen.getByText('Child 1')).toHaveAttribute('title', 'Child 1');
    // Verify count appears for child 1 (5 was added in mock)
    expect(screen.getByText('Child 1').parentElement).toHaveTextContent('Child 15');

    // Children row with 0 count still renders
    expect(screen.getByText('Child 2')).toBeInTheDocument();
    expect(screen.getByText('Child 2')).toHaveAttribute('title', 'Child 2');
    expect(screen.getByText('Child 2').parentElement).toHaveTextContent('Child 20');
  });

  it('renders virtual All Products row when no category is selected and drops facets on click', () => {
    jest
      .spyOn(require('next/navigation'), 'useSearchParams')
      .mockReturnValue(new URLSearchParams('q=tubes&filters[brand]=X'));

    render(
      <PlpCategoryTree
        plpCategoryContext={mockNoFilterContext}
        locale="en"
        total={999}
        categoryCountsById={{ 'root-1': 12 }}
      />,
    );

    // Virtual current row
    expect(screen.getByText('allProducts')).toBeInTheDocument();
    const currLink = screen.getByText('allProducts').closest('a');
    expect(currLink).toHaveAttribute('aria-current', 'page');
    // Main level All Products should reset all
    expect(currLink).toHaveAttribute('href', '/browse');

    // Children
    expect(screen.getByText('Root 1')).toBeInTheDocument();
  });
});
