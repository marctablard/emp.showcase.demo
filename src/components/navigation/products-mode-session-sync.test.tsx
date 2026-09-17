/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import { type ProductsModeContextValue, ProductsModeProvider } from './products-mode-context';
import { ProductsModeSessionSync } from './products-mode-session-sync';

type SessionStatus = 'authenticated' | 'unauthenticated' | 'loading';

const mockRefresh = jest.fn();
const mockUseSession = jest.fn<{ status: SessionStatus; data?: { user?: { id?: string } } | null }, []>();
const mockUsePathname = jest.fn<string, []>();
const mockLoggerDebug = jest.fn();

jest.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
  usePathname: () => mockUsePathname(),
}));

jest.mock('@/hooks/common/useLogger', () => ({
  useLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: mockLoggerDebug,
  }),
}));

const modeValue = (mode: ProductsModeContextValue['mode'], customerId?: string): ProductsModeContextValue => ({
  mode,
  isSegmented: mode === 'assigned',
  canToggleAllProducts: false,
  ...(customerId !== undefined ? { customerId } : {}),
});

const renderSync = (mode: ProductsModeContextValue['mode']) =>
  render(
    <ProductsModeProvider value={modeValue(mode)}>
      <ProductsModeSessionSync />
    </ProductsModeProvider>,
  );

describe('ProductsModeSessionSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePathname.mockReturnValue('/showcase/en/browse');
  });

  it('refreshes once when authenticated but the layout was rendered anonymous', () => {
    mockUseSession.mockReturnValue({ status: 'authenticated' });

    const { rerender } = renderSync('anonymous');

    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockLoggerDebug).toHaveBeenCalledWith(
      {
        status: 'authenticated',
        mode: 'anonymous',
        pathname: '/showcase/en/browse',
        authCustomerId: undefined,
        seededCustomerId: undefined,
      },
      'Products mode out of sync with the auth session; refreshing server components',
    );

    rerender(
      <ProductsModeProvider value={modeValue('anonymous')}>
        <ProductsModeSessionSync />
      </ProductsModeProvider>,
    );

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('does not refresh when authenticated and the mode is already personalised', () => {
    mockUseSession.mockReturnValue({ status: 'authenticated' });

    renderSync('assigned');

    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('does not refresh when unauthenticated and the mode is anonymous', () => {
    mockUseSession.mockReturnValue({ status: 'unauthenticated' });

    renderSync('anonymous');

    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('refreshes once when unauthenticated but the layout still shows a personalised mode', () => {
    mockUseSession.mockReturnValue({ status: 'unauthenticated' });

    const { rerender } = renderSync('assigned');

    expect(mockRefresh).toHaveBeenCalledTimes(1);

    rerender(
      <ProductsModeProvider value={modeValue('assigned')}>
        <ProductsModeSessionSync />
      </ProductsModeProvider>,
    );

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('does nothing while the session is loading', () => {
    mockUseSession.mockReturnValue({ status: 'loading' });

    renderSync('anonymous');

    expect(mockRefresh).not.toHaveBeenCalled();
    expect(mockLoggerDebug).not.toHaveBeenCalled();
  });

  it('refreshes again after a pathname change when the mode is still stale', () => {
    mockUseSession.mockReturnValue({ status: 'authenticated' });

    const { rerender } = renderSync('anonymous');
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    mockUsePathname.mockReturnValue('/showcase/en/product/p-1');
    rerender(
      <ProductsModeProvider value={modeValue('anonymous')}>
        <ProductsModeSessionSync />
      </ProductsModeProvider>,
    );
    expect(mockRefresh).toHaveBeenCalledTimes(2);

    rerender(
      <ProductsModeProvider value={modeValue('anonymous')}>
        <ProductsModeSessionSync />
      </ProductsModeProvider>,
    );
    expect(mockRefresh).toHaveBeenCalledTimes(2);
  });

  it('refreshes when the authenticated customer id differs from the server-seeded id', () => {
    mockUseSession.mockReturnValue({ status: 'authenticated', data: { user: { id: 'cust-new' } } });

    render(
      <ProductsModeProvider value={modeValue('assigned', 'cust-old')}>
        <ProductsModeSessionSync />
      </ProductsModeProvider>,
    );

    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockLoggerDebug).toHaveBeenCalledWith(
      expect.objectContaining({ authCustomerId: 'cust-new', seededCustomerId: 'cust-old', mode: 'assigned' }),
      'Products mode out of sync with the auth session; refreshing server components',
    );
  });

  it('does not refresh when the authenticated customer matches the seeded id', () => {
    mockUseSession.mockReturnValue({ status: 'authenticated', data: { user: { id: 'cust-42' } } });

    render(
      <ProductsModeProvider value={modeValue('assigned', 'cust-42')}>
        <ProductsModeSessionSync />
      </ProductsModeProvider>,
    );

    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('stops refreshing once the server answers with a matching mode', () => {
    mockUseSession.mockReturnValue({ status: 'authenticated' });

    const { rerender } = renderSync('anonymous');
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    rerender(
      <ProductsModeProvider value={modeValue('assigned')}>
        <ProductsModeSessionSync />
      </ProductsModeProvider>,
    );
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });
});
