/**
 * @jest-environment jsdom
 *
 * Not Found contract for `ProductDetail` cold-bootstrap vs true absence.
 *
 * Documents:
 * - True absence (no usable SSR seed + ready + !loading + product null) → `notFound()`
 * - Cold bootstrap with SSR `initialProduct` + transient null/error → must NOT call `notFound()`
 * - Shop-context / product loading with an SSR seed → painted PDP, not spinner
 * - Shop-context / product loading with no painted product → spinner, not Not Found
 *
 * `notFound()` is mocked as throwing (Next.js control-flow halt), matching
 * `src/components/cms/_core/cms-page.test.tsx`.
 *
 * Task 2.2 guards: SSR-seed + transient null/error must not invoke `notFound()`.
 */
import React from 'react';
import { notFound } from 'next/navigation';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { useProductsMode } from '@/components/navigation/products-mode-context';
import { useShopContextReady } from '@/hooks/common/useShopContextReady';
import { usePdpCurrentProduct } from '@/hooks/product/usePdpCurrentProduct';
import { usePdpPurchaseData } from '@/hooks/product/usePdpPurchaseData';
import { useProduct } from '@/hooks/product/useProduct';
import { useSession } from '@/hooks/session/useSession';
import { useSite } from '@/hooks/site/useSite';
import type { Product } from '@/platform/services/model/product';
import type { ProductFetchOptions } from '@/platform/services/product';
import ProductDetail from './product-detail';

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={alt} {...props} />,
}));

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));

jest.mock('@/components/navigation/products-mode-context', () => ({
  useProductsMode: jest.fn(),
}));

jest.mock('@/hooks/common/useShopContextReady', () => ({
  useShopContextReady: jest.fn(),
}));

jest.mock('@/hooks/product/useProduct', () => ({
  useProduct: jest.fn(),
}));

jest.mock('@/hooks/session/useSession', () => ({
  useSession: jest.fn(),
}));

jest.mock('@/hooks/site/useSite', () => ({
  useSite: jest.fn(),
}));

jest.mock('@/hooks/product/usePdpPurchaseData', () => ({
  usePdpPurchaseData: jest.fn(),
}));

jest.mock('@/hooks/product/usePdpCurrentProduct', () => ({
  usePdpCurrentProduct: jest.fn(),
}));

jest.mock('@/hooks/product/usePdpShippingCost', () => ({
  usePdpShippingCost: () => ({ shippingCost: null, loading: false }),
}));

jest.mock('@/hooks/product/usePdpStickyAtcVisibility', () => ({
  usePdpStickyAtcVisibility: () => ({ stickyVisible: false, primaryAtcRef: { current: null } }),
}));

jest.mock('@/hooks/cart/useValidateAddToCart', () => ({
  useValidateAddToCart: () => ({ disabled: false, tooltip: undefined }),
}));

jest.mock('@/hooks/comparison/useComparison', () => ({
  useComparison: () => ({
    isInComparison: () => false,
    toggleProduct: jest.fn(),
    isFull: false,
  }),
}));

jest.mock('@/hooks/comparison/useValidateAddToComparison', () => ({
  useValidateAddToComparison: () => ({ disabled: false, tooltip: undefined }),
}));

jest.mock('@/hooks/wishlist/useWishlistAddWithAuth', () => ({
  useWishlistAddWithAuth: () => ({
    addToWishlist: jest.fn(),
    isAdding: false,
    loginDialog: null,
  }),
}));

jest.mock('@/hooks/common/useLogger', () => ({
  useLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('@/hooks/useBreakpoint', () => ({
  useBreakpoint: () => ({ isMobile: false, isTablet: false, isDesktop: true }),
}));

jest.mock('@/hooks/useL10n', () => ({
  useL10n: () => ({
    l10n: (value: unknown) => (typeof value === 'string' ? value : '-'),
    l10nOrEmpty: (value: unknown) => (typeof value === 'string' ? value : ''),
  }),
}));

jest.mock('@/components/ui/spinner', () => ({
  Spinner: ({ variant }: { variant?: string }) => (
    <div data-testid="pdp-spinner" data-variant={variant ?? 'md'} role="status" />
  ),
}));

jest.mock('../cms/recommendations', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('./product-add-to-cart', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('./product-add-to-cart-bar', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('./product-variant-selector', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/wishlist/wishlist-pin-button', () => ({
  WishlistPinButton: () => null,
}));

jest.mock('../ui/toast-notification', () => ({
  ToastType: { Success: 'success', Error: 'error', Info: 'info', Warning: 'warning' },
  notify: jest.fn(),
}));

class ResizeObserverStub {
  observe(): void {
    // Inert stub: Component Tests jsdom has no ResizeObserver (jest.react.setup.js is React project only).
  }
  unobserve(): void {
    // Inert stub: nothing is ever observed.
  }
  disconnect(): void {
    // Inert stub: nothing is ever observed.
  }
}
Object.defineProperty(globalThis, 'ResizeObserver', { writable: true, value: ResizeObserverStub });
Object.defineProperty(window, 'ResizeObserver', { writable: true, value: ResizeObserverStub });

const useProductsModeMock = useProductsMode as jest.Mock;
const useShopContextReadyMock = useShopContextReady as jest.Mock;
const useProductMock = useProduct as jest.Mock;
const useSessionMock = useSession as jest.Mock;
const useSiteMock = useSite as jest.Mock;
const usePdpPurchaseDataMock = usePdpPurchaseData as jest.Mock;
const usePdpCurrentProductMock = usePdpCurrentProduct as jest.Mock;
const notFoundMock = notFound as unknown as jest.Mock;

const PUBLIC_PDP_OPTIONS: ProductFetchOptions = {
  prices: false,
  variants: true,
  categories: true,
};

const ssrSeedProduct: Product = {
  id: 'enjoysolar-200w-module',
  name: 'EnjoySolar 200W Module',
  description: 'SSR public seed without displayable price',
  purchasable: true,
  // Public PDP SSR omits price.currency (PUBLIC_PRODUCT_OPTIONS.prices = false)
};

function mockReadyHooks(productResult: { product: Product | null; loading: boolean; error?: Error | null }): void {
  useShopContextReadyMock.mockReturnValue({ ready: true, timedOut: false });
  useProductMock.mockReturnValue({
    product: productResult.product,
    loading: productResult.loading,
    error: productResult.error ?? null,
    setAsCurrent: jest.fn(),
    refetch: jest.fn(),
    currentProductId: productResult.product?.id ?? null,
  });
  useSessionMock.mockReturnValue({
    session: { id: 'sess', siteCode: 'main', currency: 'EUR', customerId: 'ANONYMOUS' },
    loading: false,
  });
  useSiteMock.mockReturnValue({
    site: { code: 'main', defaultCurrency: { id: 'EUR' }, currencies: [{ id: 'EUR' }] },
  });
  usePdpPurchaseDataMock.mockReturnValue({ price: undefined, availability: undefined });
  usePdpCurrentProductMock.mockReturnValue(undefined);
}

beforeEach(() => {
  jest.clearAllMocks();
  useProductsModeMock.mockReturnValue({
    mode: 'anonymous',
    isSegmented: false,
    canToggleAllProducts: false,
  });
  notFoundMock.mockImplementation(() => {
    throw new Error('NEXT_NOT_FOUND');
  });
});

describe('ProductDetail — loading / shop-context gate', () => {
  it('paints the SSR seed and does not show spinner while shop context is not ready', () => {
    useShopContextReadyMock.mockReturnValue({ ready: false, timedOut: false });
    useProductMock.mockReturnValue({
      product: null,
      loading: false,
      error: null,
      setAsCurrent: jest.fn(),
      refetch: jest.fn(),
      currentProductId: null,
    });
    useSessionMock.mockReturnValue({ session: null, loading: true });
    useSiteMock.mockReturnValue({ site: { code: 'main' } });
    usePdpPurchaseDataMock.mockReturnValue({ price: undefined, availability: undefined });
    usePdpCurrentProductMock.mockReturnValue(undefined);

    render(<ProductDetail product={ssrSeedProduct} options={PUBLIC_PDP_OPTIONS} />);

    expect(screen.queryByTestId('pdp-spinner')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'EnjoySolar 200W Module' })).toBeInTheDocument();
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it('paints the SSR seed and does not show spinner while product is loading', () => {
    mockReadyHooks({ product: null, loading: true, error: null });
    useShopContextReadyMock.mockReturnValue({ ready: true, timedOut: false });

    render(<ProductDetail product={ssrSeedProduct} options={PUBLIC_PDP_OPTIONS} />);

    expect(screen.queryByTestId('pdp-spinner')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'EnjoySolar 200W Module' })).toBeInTheDocument();
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it('shows spinner and does not call notFound while product is loading without a usable seed', () => {
    mockReadyHooks({ product: null, loading: true, error: null });

    render(<ProductDetail options={PUBLIC_PDP_OPTIONS} />);

    expect(screen.getByTestId('pdp-spinner')).toBeInTheDocument();
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});

describe('ProductDetail — Not Found contract (true absence vs cold bootstrap)', () => {
  it('invokes notFound when ready, not loading, product is null, and there is no usable SSR seed', () => {
    mockReadyHooks({ product: null, loading: false, error: null });

    expect(() => render(<ProductDetail options={PUBLIC_PDP_OPTIONS} />)).toThrow('NEXT_NOT_FOUND');

    // React may invoke the render path more than once in tests; assert invocation, not exact count.
    expect(notFoundMock).toHaveBeenCalled();
  });

  it('invokes notFound when ready, not loading, product is null, and initialProduct was only an id string', () => {
    mockReadyHooks({ product: null, loading: false, error: null });

    expect(() => render(<ProductDetail product="missing-product-id" options={PUBLIC_PDP_OPTIONS} />)).toThrow(
      'NEXT_NOT_FOUND',
    );

    expect(notFoundMock).toHaveBeenCalled();
  });

  /**
   * SSR object seed + resolved client null/error must not map to permanent absence.
   */
  it('does not invoke notFound when SSR initialProduct exists and hook reports transient null with error', () => {
    mockReadyHooks({
      product: null,
      loading: false,
      error: new Error('client refetch failed during session pricing bootstrap'),
    });

    expect(() => render(<ProductDetail product={ssrSeedProduct} options={PUBLIC_PDP_OPTIONS} />)).not.toThrow(
      'NEXT_NOT_FOUND',
    );

    expect(notFoundMock).not.toHaveBeenCalled();
  });

  /**
   * Same contract without an explicit error signal: transient null after SSR seed
   * (force-refresh wipe) must not become Not Found.
   */
  it('does not invoke notFound when SSR initialProduct exists and hook reports transient null without error', () => {
    mockReadyHooks({ product: null, loading: false, error: null });

    expect(() => render(<ProductDetail product={ssrSeedProduct} options={PUBLIC_PDP_OPTIONS} />)).not.toThrow(
      'NEXT_NOT_FOUND',
    );

    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it('does not invoke notFound in assigned mode when the hook reports an error (price / 5xx) and an SSR seed exists', () => {
    useProductsModeMock.mockReturnValue({
      mode: 'assigned',
      isSegmented: true,
      canToggleAllProducts: false,
    });
    mockReadyHooks({
      product: null,
      loading: false,
      error: new Error('Failed to fetch product: Failed to match prices'),
    });

    expect(() => render(<ProductDetail product={ssrSeedProduct} options={PUBLIC_PDP_OPTIONS} />)).not.toThrow(
      'NEXT_NOT_FOUND',
    );

    expect(screen.getByRole('heading', { level: 1, name: 'EnjoySolar 200W Module' })).toBeInTheDocument();
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it('invokes notFound in assigned mode when the catalog miss is confirmed even if an SSR seed exists', () => {
    useProductsModeMock.mockReturnValue({
      mode: 'assigned',
      isSegmented: true,
      canToggleAllProducts: false,
    });
    mockReadyHooks({ product: null, loading: false, error: null });

    expect(() => render(<ProductDetail product={ssrSeedProduct} options={PUBLIC_PDP_OPTIONS} />)).toThrow(
      'NEXT_NOT_FOUND',
    );

    expect(notFoundMock).toHaveBeenCalled();
  });

  it('paints catalogDisplayName on H1 when the seed name is parent-shaped and does not call notFound', () => {
    mockReadyHooks({ product: null, loading: false, error: null });
    const parentSeed: Product = {
      ...ssrSeedProduct,
      name: 'Parent',
    };

    render(<ProductDetail product={parentSeed} options={PUBLIC_PDP_OPTIONS} catalogDisplayName="Settled DE" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Settled DE' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Parent' })).not.toBeInTheDocument();
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});
