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

    expect(screen.getByRole('link', { name: 'backLinkAriaLabel' })).toHaveAttribute('href', '/account');
  });

  it('targets Back to the immediate parent on deeper breadcrumb paths', () => {
    const items: BreadcrumbContent[] = [
      { href: '/account', label: 'Account Details' },
      { href: '/account/returns', label: 'Returns' },
      { href: '/account/returns/ret-42', label: 'Return #ret-42' },
    ];

    render(<UiBreadcrumb items={items} />);

    expect(screen.getByRole('link', { name: 'backLinkAriaLabel' })).toHaveAttribute('href', '/account/returns');
  });

  it('falls back to the only item href when no parent breadcrumb exists', () => {
    const items: BreadcrumbContent[] = [{ href: '/quick-order', label: 'Quick Order' }];

    render(<UiBreadcrumb items={items} />);

    expect(screen.getByRole('link', { name: 'backLinkAriaLabel' })).toHaveAttribute('href', '/quick-order');
  });
});
