/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { breakpoints } from '@/hooks/useBreakpoint';
import { AccountLayout } from './account-layout';

function setViewportWidth(width: number) {
  Object.defineProperty(globalThis, 'innerWidth', {
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
  const originalInnerWidth = globalThis.innerWidth;

  afterEach(() => {
    setViewportWidth(originalInnerWidth);
  });

  // Regression coverage for COP-4880/COP-6025: the persistent account rail and the mobile
  // off-canvas menu toggle must switch on one and the same useBreakpoint boundary, keeping the
  // spacing and sidebar width classes aligned to it.
  //
  // SHOW-320 moved that boundary from 'md' (1024) to 'sm' (768). Figma draws a persistent rail on
  // all four account templates at 768 — Order History 6354:68313 closes exactly on
  // 16 + 180 + 24 + 532 + 16 = 768 — and drops it only at 360, where an "ACCOUNT MENU" button
  // (6354:68546, 328x48) takes its place. The 'Account nav bar' component set 3445:157880 backs
  // this up: its only two variants are the desktop rail and a 360-wide full-screen drawer, i.e.
  // there is no tablet drawer state to render between 768 and 1023.
  //
  // The rail's WIDTH still swaps at md (180 @768 -> 288 @1024) — that is a separate boundary from
  // its PRESENCE, and both are asserted below.
  it('shows the mobile menu button and hides the persistent rail just below the sm boundary (767px)', () => {
    setViewportWidth(breakpoints.sm - 1);

    render(
      <AccountLayout>
        <div>content</div>
      </AccountLayout>,
    );

    expect(screen.getByRole('button', { name: 'sidebar.menu' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('shows the persistent rail at 180px from the sm boundary (768px), without the mobile button', () => {
    setViewportWidth(breakpoints.sm);

    render(
      <AccountLayout>
        <div>content</div>
      </AccountLayout>,
    );

    expect(screen.queryByRole('button', { name: 'sidebar.menu' })).not.toBeInTheDocument();
    expect(screen.getByRole('navigation')).toHaveClass('min-w-[180px]');
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

    // The outermost box only caps and centres: max-w-6xl is 1920px here (globals.css overrides
    // --container-6xl with --theme-container-6xl: 120rem), which is the Figma frame width, so the
    // 36px margin below yields the 1848px content cap of the grid master 463:11124.
    expect(container.firstChild).toHaveClass('max-w-6xl');
    expect(container.firstChild).toHaveClass('mx-auto');

    // The side margins themselves sit on the layout row: 16px from sm, 36px from md — matching
    // Figma Order History 768 (16/736/16) and 1024 (36/952/36).
    const row = container.querySelector('.min-h-screen');
    expect(row).toHaveClass('sm:mx-4');
    expect(row).toHaveClass('md:mx-9');
    expect(row).not.toHaveClass('lg:mx-9');
  });
});
