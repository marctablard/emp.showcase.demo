/**
 * Behaviour coverage for the `recommendations-carousel` client island.
 *
 * The parent `recommendations.tsx` wrapper stubs this island out in its own
 * test so it can assert wrapper-level DOM spreading deterministically. Here
 * the island is mounted for real to pin its operating modes:
 *
 *   - `productId` set         → driven by `useRecommendations(productId)`
 *   - `products` set (csv)    → driven by `useProducts(splitIds)`
 *   - neither / error / empty → renders nothing
 *
 * Only the two data hooks are mocked. The heavy `ProductTile` /
 * `ProductTileSkeleton` children are stubbed via the React project's
 * moduleNameMapper, so the carousel tree hydrates without the full Zustand
 * provider stack. The `<Carousel>` UI primitive renders for real.
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { useProducts } from '@/hooks/product/useProducts';
import { useRecommendations } from '@/hooks/recommendations/useRecommendations';
import type { Product } from '@/platform/services/model/product';
import RecommendationsCarousel from './recommendations-carousel';

jest.mock('@/hooks/recommendations/useRecommendations', () => ({
  useRecommendations: jest.fn(),
}));
jest.mock('@/hooks/product/useProducts', () => ({
  useProducts: jest.fn(),
}));

// The island imports its product children through relative paths, which the
// project-level `@/components/product/*` moduleNameMapper stubs do not match.
// Stub them here so the carousel tree hydrates without the full Zustand
// provider stack — mirroring those project stubs.
jest.mock('../../product/product-tile', () => ({
  ProductTile: ({ product }: { product?: { id?: string; name?: string } }) => (
    <div data-testid="mock-product-tile" data-product-id={product?.id ?? ''}>
      {product?.name ?? ''}
    </div>
  ),
}));
jest.mock('../../product/product-tile-skeleton', () => ({
  ProductTileSkeleton: () => <div data-testid="mock-product-tile-skeleton" />,
}));

const mockedUseRecs = useRecommendations as jest.MockedFunction<typeof useRecommendations>;
const mockedUseProds = useProducts as jest.MockedFunction<typeof useProducts>;

type UseRecsReturn = ReturnType<typeof useRecommendations>;
type UseProdsReturn = ReturnType<typeof useProducts>;

// Typed partial→full helpers: each test sets only the fields it cares about
// while the type-checker still pins the full hook return shape.
function buildRecs(overrides: Partial<UseRecsReturn> = {}): UseRecsReturn {
  return {
    recommendations: undefined,
    loading: false,
    error: null,
    ...overrides,
  };
}

function buildProds(overrides: Partial<UseProdsReturn> = {}): UseProdsReturn {
  return {
    products: [],
    loading: false,
    error: null,
    refetch: async () => undefined,
    setAsCurrent: () => undefined,
    ...overrides,
  };
}

beforeEach(() => {
  mockedUseRecs.mockReset();
  mockedUseProds.mockReset();
  // Default: nothing returned. Individual tests override.
  mockedUseRecs.mockReturnValue(buildRecs());
  mockedUseProds.mockReturnValue(buildProds());
});

describe('RecommendationsCarousel — client island', () => {
  it('renders nothing when neither productId nor products is supplied', () => {
    const { container } = render(<RecommendationsCarousel />);

    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when useRecommendations reports an error', () => {
    mockedUseRecs.mockReturnValue(buildRecs({ error: 'boom' }));

    const { container } = render(<RecommendationsCarousel productId="p-1" />);

    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when recommendations resolves to an empty list', () => {
    mockedUseRecs.mockReturnValue(buildRecs({ recommendations: { products: [] } }));

    const { container } = render(<RecommendationsCarousel productId="p-1" />);

    expect(container.firstChild).toBeNull();
  });

  it('renders the headline when provided and the carousel has products', () => {
    mockedUseRecs.mockReturnValue(
      buildRecs({
        recommendations: { products: [{ id: 'r1', name: 'Hammer' } as unknown as Product] },
      }),
    );

    const { getByText } = render(<RecommendationsCarousel productId="p-1" headline="Customers also bought" />);

    expect(getByText('Customers also bought')).toBeInTheDocument();
  });

  it('renders the overline when provided', () => {
    mockedUseRecs.mockReturnValue(
      buildRecs({
        recommendations: { products: [{ id: 'r1', name: 'Hammer' } as unknown as Product] },
      }),
    );

    const { getByText } = render(<RecommendationsCarousel productId="p-1" overline="Promo" />);

    expect(getByText('Promo')).toBeInTheDocument();
  });

  it('renders a product tile per resolved recommendation in the happy path', () => {
    mockedUseRecs.mockReturnValue(
      buildRecs({
        recommendations: {
          products: [{ id: 'r1', name: 'A' } as unknown as Product, { id: 'r2', name: 'B' } as unknown as Product],
        },
      }),
    );

    const { container } = render(<RecommendationsCarousel productId="p-1" />);

    expect(container.querySelectorAll('[data-testid="mock-product-tile"]')).toHaveLength(2);
  });

  it('renders five skeleton tiles while the source list is loading', () => {
    // The early-return guard requires `recommendationsToShow.length > 0` before
    // the skeleton-or-tiles branch runs at all. Provide one resolved product so
    // the guard passes and the loading branch takes effect.
    mockedUseRecs.mockReturnValue(
      buildRecs({
        loading: true,
        recommendations: { products: [{ id: 'r1', name: 'A' } as unknown as Product] },
      }),
    );

    const { container } = render(<RecommendationsCarousel productId="p-1" />);

    expect(container.querySelectorAll('[data-testid="mock-product-tile-skeleton"]')).toHaveLength(5);
  });

  it('uses useProducts when the comma-separated `products` string is supplied', () => {
    mockedUseProds.mockReturnValue(buildProds({ products: [{ id: 'p-1', name: 'A' } as unknown as Product] }));

    render(<RecommendationsCarousel products="p-1, p-2, p-3" />);

    expect(mockedUseProds).toHaveBeenCalled();
    const callArgs = mockedUseProds.mock.calls[0]?.[0];
    expect(callArgs).toEqual(['p-1', 'p-2', 'p-3']);
  });
});
