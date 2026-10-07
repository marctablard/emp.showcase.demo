/**
 * @jest-environment jsdom
 */
import type { ReactNode } from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { BreadcrumbContent } from '@/lib/breadcrumb';
import { UiBreadcrumb } from './ui-breadcrumb';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('UiBreadcrumb', () => {
  it('targets Back to the parent breadcrumb on two-level list pages', () => {
    const items: BreadcrumbContent[] = [
      { href: '/account', label: 'Account Details' },
      { href: '/account/returns', label: 'Returns' },
    ];

    render(<UiBreadcrumb items={items} />);

    expect(screen.getByRole('link', { name: 'backLink' })).toHaveAttribute('href', '/account');
  });

  it('targets Back to the immediate parent on deeper breadcrumb paths', () => {
    const items: BreadcrumbContent[] = [
      { href: '/account', label: 'Account Details' },
      { href: '/account/returns', label: 'Returns' },
      { href: '/account/returns/ret-42', label: 'Return #ret-42' },
    ];

    render(<UiBreadcrumb items={items} />);

    expect(screen.getByRole('link', { name: 'backLink' })).toHaveAttribute('href', '/account/returns');
  });

  it('falls back to the only item href when no parent breadcrumb exists', () => {
    const items: BreadcrumbContent[] = [{ href: '/quick-order', label: 'Quick Order' }];

    render(<UiBreadcrumb items={items} />);

    expect(screen.getByRole('link', { name: 'backLink' })).toHaveAttribute('href', '/quick-order');
  });

  it('exposes a single Back accessible name without duplicate text', () => {
    const items: BreadcrumbContent[] = [
      { href: '/account', label: 'Account Details' },
      { href: '/account/returns', label: 'Returns' },
    ];

    render(<UiBreadcrumb items={items} />);

    const backLink = screen.getByRole('link', { name: 'backLink' });
    expect(backLink).toHaveAccessibleName('backLink');
    expect(backLink).not.toHaveAccessibleName('backLinkbackLink');
  });

  it.each([
    { caseName: 'when disabledCategories is unset' },
    { caseName: 'when disabledCategories is false', disabledCategories: false },
  ])('renders clickable non-last category crumbs and non-clickable last crumb $caseName', ({ disabledCategories }) => {
    const items: BreadcrumbContent[] = [
      { href: '/products', label: 'All Products' },
      { href: '/products/furniture', label: 'Furniture' },
      { href: '/product/ecoflow-extension-cable', label: 'EcoFlow Extension Cable' },
    ];

    render(<UiBreadcrumb items={items} maxItems={10} disabledCategories={disabledCategories} />);

    expect(screen.getByRole('link', { name: 'homeLink' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'All Products' })).toHaveAttribute('href', '/products');
    expect(screen.getByRole('link', { name: 'Furniture' })).toHaveAttribute('href', '/products/furniture');
    const currentPageCrumb = screen.getByText('EcoFlow Extension Cable');
    expect(currentPageCrumb).toHaveAttribute('aria-current', 'page');
    expect(currentPageCrumb).not.toHaveAttribute('role', 'link');
    expect(currentPageCrumb.closest('a')).toBeNull();
  });
});
