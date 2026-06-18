/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { releaseNavigationWaitCursorLease } from '@/hooks/common/useGlobalCursor';
import UiLink from './link';

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, onClick, ...props }: any) => (
    <a href={typeof href === 'string' ? href : '#'} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

describe('UiLink', () => {
  beforeEach(() => {
    releaseNavigationWaitCursorLease({ force: true });
  });

  afterEach(() => {
    releaseNavigationWaitCursorLease({ force: true });
  });

  it('acquires the navigation wait-cursor lease before handling internal browse clicks', () => {
    const onClick = jest.fn((event?: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
      expect(document.documentElement).toHaveAttribute('data-global-cursor', 'wait');
      expect(event?.defaultPrevented).toBe(false);
    });

    render(
      <UiLink
        type="Link"
        href="/browse?filters%5B_product_i18n.categoryBreadcrumbs.displayPath%5D=Electrical+supplies"
        variant="secondary"
        onClick={onClick}
      >
        Electrical supplies
      </UiLink>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Electrical supplies' }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(document.documentElement).toHaveAttribute('data-global-cursor', 'wait');
  });

  it('does not acquire the navigation wait-cursor lease for non-browse links', () => {
    render(
      <UiLink type="Link" href="/account/orders" variant="secondary">
        Orders
      </UiLink>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Orders' }));

    expect(document.documentElement).not.toHaveAttribute('data-global-cursor');
  });
});
