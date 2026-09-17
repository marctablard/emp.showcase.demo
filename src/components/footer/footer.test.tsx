/**
 * @jest-environment jsdom
 */
import type { ReactNode } from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { FooterLinks, type FooterTopProductCategoryLink } from './footer';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    if (key === 'products') {
      return 'Products';
    }
    if (key === 'assignedProducts') {
      return 'Assigned Products';
    }
    if (key === 'showAllCategories') {
      return 'Show all';
    }
    return key;
  },
}));

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock('@/hooks/newsletter/useNewsletterForm', () => ({
  useNewsletterForm: () => ({ form: {}, onSubmit: jest.fn() }),
}));

const topProductCategories: FooterTopProductCategoryLink[] = [
  { label: 'Solar Panels', href: '/browse/solar-panels' },
  { label: 'Inverters', href: '/browse/inverters' },
];

describe('FooterLinks product column heading (COP-4822 Task 5.4)', () => {
  it('renders "Products" by default', () => {
    render(<FooterLinks topProductCategories={topProductCategories} />);

    expect(screen.getByText('Products')).toBeInTheDocument();
    expect(screen.queryByText('Assigned Products')).not.toBeInTheDocument();
  });

  it('renders "Assigned Products" when assignedProductsMode is true', () => {
    render(<FooterLinks topProductCategories={topProductCategories} assignedProductsMode />);

    expect(screen.getByText('Assigned Products')).toBeInTheDocument();
    expect(screen.queryByText('Products')).not.toBeInTheDocument();
  });

  it('keeps the category links from topProductCategories and the "Show all" link on /browse in assigned mode', () => {
    render(<FooterLinks topProductCategories={topProductCategories} showAllProductsBrowse assignedProductsMode />);

    expect(screen.getByRole('link', { name: 'Solar Panels' })).toHaveAttribute('href', '/browse/solar-panels');
    expect(screen.getByRole('link', { name: 'Inverters' })).toHaveAttribute('href', '/browse/inverters');
    expect(screen.getByRole('link', { name: 'Show all' })).toHaveAttribute('href', '/browse');
  });
});
