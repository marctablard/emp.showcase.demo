/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { breakpoints } from '@/hooks/useBreakpoint';
import { AccountLayout } from './account-layout';

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
}

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

jest.mock('next/navigation', () => ({
  usePathname: () => '/account',
}));

jest.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

jest.mock('@/hooks/authentication/useAuthentication', () => ({
  useAuthentication: () => ({ logout: jest.fn() }),
}));

describe('AccountLayout responsive sidebar/mobile-menu switching', () => {
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    setViewportWidth(originalInnerWidth);
  });

  // Regression coverage for COP-4880/COP-6025: the persistent account rail and the mobile
  // off-canvas menu toggle must switch on the same 'md' (1024px) boundary that useBreakpoint
  // uses, keeping the outer spacing and sidebar width classes aligned to it.
  it('shows the mobile menu button and hides the persistent rail just below the md boundary (1023px)', () => {
    setViewportWidth(breakpoints.md - 1);

    render(
      <AccountLayout>
        <div>content</div>
      </AccountLayout>,
    );

    expect(screen.getByRole('button', { name: 'sidebar.menu' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('shows the persistent rail at the correct width and hides the mobile menu button at the md boundary (1024px)', () => {
    setViewportWidth(breakpoints.md);

    render(
      <AccountLayout>
        <div>content</div>
      </AccountLayout>,
    );

    expect(screen.queryByRole('button', { name: 'sidebar.menu' })).not.toBeInTheDocument();
    const sidebar = screen.getByRole('navigation');
    expect(sidebar).toBeInTheDocument();
    expect(sidebar).toHaveClass('md:min-w-[288px]');
    expect(sidebar).not.toHaveClass('lg:min-w-[288px]');
  });

  it('aligns the outer layout spacing to the md breakpoint instead of lg', () => {
    setViewportWidth(breakpoints.md);

    const { container } = render(
      <AccountLayout>
        <div>content</div>
      </AccountLayout>,
    );

    expect(container.firstChild).toHaveClass('md:mx-9');
    expect(container.firstChild).not.toHaveClass('lg:mx-9');
  });
});
