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

  it('marks disabled link variants as non-interactive and does not call the click handler', () => {
    const onClick = jest.fn();

    render(
      <>
        <UiLink type="Link" href="/browse" variant="secondary" disabled onClick={onClick}>
          Browse
        </UiLink>
        <UiLink type="A" href="/external" variant="buttonPrimary" disabled onClick={onClick}>
          External
        </UiLink>
      </>,
    );

    const link = screen.getByRole('link', { name: 'Browse' });
    const anchor = screen.getByRole('link', { name: 'External' });

    expect(link).toHaveAttribute('aria-disabled', 'true');
    expect(link).toHaveAttribute('tabindex', '-1');
    expect(anchor).toHaveAttribute('aria-disabled', 'true');
    expect(anchor).toHaveAttribute('tabindex', '-1');

    fireEvent.click(link);
    fireEvent.click(anchor);

    expect(onClick).not.toHaveBeenCalled();
    expect(document.documentElement).not.toHaveAttribute('data-global-cursor');
  });

  it('passes the disabled attribute to button links', () => {
    const onClick = jest.fn();

    render(
      <UiLink type="Button" variant="buttonPrimary" disabled onClick={onClick}>
        Submit
      </UiLink>,
    );

    const button = screen.getByRole('button', { name: 'Submit' });

    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders the table variant with shared no-underline table link styling', () => {
    render(
      <UiLink type="Link" href="/account/orders/order-1" variant="table" className="font-bold">
        Order #1
      </UiLink>,
    );

    const link = screen.getByRole('link', { name: 'Order #1' });
    expect(link).toHaveClass(
      'no-underline',
      'hover:no-underline',
      'cursor-default',
      'font-secondary',
      'text-[16px]',
      'leading-[24px]',
      'text-text-action',
      'hover:text-text-action-hover',
      'font-bold',
    );
    expect(link).not.toHaveClass('underline');
  });

  it('renders the textBold variant with bold underlined action-link token classes', () => {
    render(
      <UiLink type="Button" variant="textBold" size="m">
        Show more
      </UiLink>,
    );

    const link = screen.getByRole('button', { name: 'Show more' });
    expect(link).toHaveClass('font-bold', 'text-text-action', 'underline', 'hover:text-text-action-hover', 'text-base');
  });
});
