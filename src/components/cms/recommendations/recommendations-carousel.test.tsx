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
import { act, render } from '@testing-library/react';
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

// The project-level `@/components/product/*` moduleNameMapper stubs already
// cover these children. Re-declaring them here keeps this suite's assertions
// (`data-product-id`) self-describing and independent of the shared stubs'
// exact markup — the specifiers must stay alias-form so both this factory and
// the project mapper resolve to the same module the island imports.
jest.mock('@/components/product/product-tile', () => ({
  ProductTile: ({ product }: { product?: { id?: string; name?: string } }) => (
    <div data-testid="mock-product-tile" data-product-id={product?.id ?? ''}>
      {product?.name ?? ''}
    </div>
  ),
}));
jest.mock('@/components/product/product-tile-skeleton', () => ({
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

async function renderCarousel(ui: Parameters<typeof render>[0]) {
  const view = render(ui);
  await act(async () => {
    await Promise.resolve();
  });
  return view;
}

beforeEach(() => {
  mockedUseRecs.mockReset();
  mockedUseProds.mockReset();
  // Default: nothing returned. Individual tests override.
  mockedUseRecs.mockReturnValue(buildRecs());
  mockedUseProds.mockReturnValue(buildProds());
});

describe('RecommendationsCarousel — client island', () => {
  it('renders nothing when neither productId nor products is supplied', async () => {
    const { container } = await renderCarousel(<RecommendationsCarousel />);

    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when useRecommendations reports an error', async () => {
    mockedUseRecs.mockReturnValue(buildRecs({ error: 'boom' }));

    const { container } = await renderCarousel(<RecommendationsCarousel productId="p-1" />);

    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when recommendations resolves to an empty list', async () => {
    mockedUseRecs.mockReturnValue(buildRecs({ recommendations: { products: [] } }));

    const { container } = await renderCarousel(<RecommendationsCarousel productId="p-1" />);

    expect(container.firstChild).toBeNull();
    expect(container.querySelector('.py-8')).toBeNull();
    expect(container.querySelector('.content-container')).toBeNull();
  });

  it('renders nothing (no py-8 shell) when useRecommendations finishes with undefined products', async () => {
    mockedUseRecs.mockReturnValue(buildRecs({ loading: false, recommendations: undefined }));

    const { container } = await renderCarousel(
      <RecommendationsCarousel productId="p-1" className="should-not-appear" />,
    );

    expect(container.firstChild).toBeNull();
    expect(container.querySelector('.py-8')).toBeNull();
  });

  it('keeps the py-8 shell while loading skeleton tiles (even before products arrive)', async () => {
    mockedUseRecs.mockReturnValue(buildRecs({ loading: true, recommendations: undefined }));

    const { container } = await renderCarousel(<RecommendationsCarousel productId="p-1" />);

    expect(container.firstChild).toHaveClass('py-8', 'content-container');
    expect(container.querySelectorAll('[data-testid="mock-product-tile-skeleton"]')).toHaveLength(5);
  });

  it('renders the headline when provided and the carousel has products', async () => {
    mockedUseRecs.mockReturnValue(
      buildRecs({
        recommendations: { products: [{ id: 'r1', name: 'Hammer' } as unknown as Product] },
      }),
    );

    const { getByText, container } = await renderCarousel(
      <RecommendationsCarousel productId="p-1" headline="Customers also bought" />,
    );

    expect(container.firstChild).toHaveClass('py-8', 'content-container');
    expect(getByText('Customers also bought')).toBeInTheDocument();
  });

  it('renders the overline when provided', async () => {
    mockedUseRecs.mockReturnValue(
      buildRecs({
        recommendations: { products: [{ id: 'r1', name: 'Hammer' } as unknown as Product] },
      }),
    );

    const { getByText } = await renderCarousel(<RecommendationsCarousel productId="p-1" overline="Promo" />);

    expect(getByText('Promo')).toBeInTheDocument();
  });

  it('renders a product tile per resolved recommendation in the happy path', async () => {
    mockedUseRecs.mockReturnValue(
      buildRecs({
        recommendations: {
          products: [{ id: 'r1', name: 'A' } as unknown as Product, { id: 'r2', name: 'B' } as unknown as Product],
        },
      }),
    );

    const { container } = await renderCarousel(<RecommendationsCarousel productId="p-1" />);

    expect(container.querySelectorAll('[data-testid="mock-product-tile"]')).toHaveLength(2);
  });

  it('renders five skeleton tiles while the source list is loading with a prior product', async () => {
    mockedUseRecs.mockReturnValue(
      buildRecs({
        loading: true,
        recommendations: { products: [{ id: 'r1', name: 'A' } as unknown as Product] },
      }),
    );

    const { container } = await renderCarousel(<RecommendationsCarousel productId="p-1" />);

    expect(container.querySelectorAll('[data-testid="mock-product-tile-skeleton"]')).toHaveLength(5);
  });

  it('uses useProducts when the comma-separated `products` string is supplied', async () => {
    mockedUseProds.mockReturnValue(buildProds({ products: [{ id: 'p-1', name: 'A' } as unknown as Product] }));

    await renderCarousel(<RecommendationsCarousel products="p-1, p-2, p-3" />);

    expect(mockedUseProds).toHaveBeenCalled();
    const callArgs = mockedUseProds.mock.calls[0]?.[0];
    expect(callArgs).toEqual(['p-1', 'p-2', 'p-3']);
  });
});
