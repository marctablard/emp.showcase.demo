/**
 * Failing-test contract for the `recommendations` CMS component.
 *
 * Recommendations renders either a single-product carousel (driven by
 * `productId`) or a fixed-list carousel (driven by `products`, a
 * comma-separated string of product ids). The heavy carousel UI — which
 * embeds the live `useRecommendations`/`useProducts` hooks plus the
 * `<Carousel>` primitive — lives in a separate client island
 * (`recommendations-carousel.tsx`) that is exercised in its own test file.
 * It is stubbed here so the wrapper renders deterministically and never
 * schedules state-updating effects during these render assertions.
 *
 * Behaviour contract: when there is no data to show (neither `productId`
 * nor a non-empty `products`), the wrapper collapses to nothing
 * (`return null`) rather than rendering an empty wrapper. The padded
 * `py-8 content-container` shell lives inside the client island so an
 * empty/error final state cannot leave a spacer above the footer.
 *
 * Co-located with the implementation they pin.
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import Recommendations, { type RecommendationsData, RecommendationsSchema } from './index';
import RecommendationsCarousel from './recommendations-carousel';

jest.mock('./recommendations-carousel', () => ({
  __esModule: true,
  default: jest.fn(({ className, ...rest }: { className?: string } & Record<string, unknown>) => (
    <div className={['py-8', 'content-container', className].filter(Boolean).join(' ')} {...rest} />
  )),
}));

const mockedCarousel = RecommendationsCarousel as unknown as jest.Mock;

const MINIMAL: RecommendationsData = {
  id: 'rec-1',
  type: 'recommendations',
};

const WITH_PRODUCT_ID: RecommendationsData = {
  id: 'rec-2',
  type: 'recommendations',
  headline: 'Customers also bought',
  productId: 'prod-001',
  locale: 'en',
};

const WITH_PRODUCTS: RecommendationsData = {
  id: 'rec-3',
  type: 'recommendations',
  overline: 'Promo',
  headline: 'Spring picks',
  products: 'p-1, p-2, p-3',
};

beforeEach(() => {
  mockedCarousel.mockImplementation(({ className, ...rest }: { className?: string } & Record<string, unknown>) => (
    <div className={['py-8', 'content-container', className].filter(Boolean).join(' ')} {...rest} />
  ));
});

describe('Recommendations — schema', () => {
  it('parses a minimal payload with only `id` and `type`', () => {
    const parsed = RecommendationsSchema.parse(MINIMAL);

    expect(parsed.type).toBe('recommendations');
    expect(parsed.productId).toBeUndefined();
  });

  it('parses a single-product variant (`productId`)', () => {
    const parsed = RecommendationsSchema.parse(WITH_PRODUCT_ID);

    expect(parsed.productId).toBe('prod-001');
    expect(parsed.locale).toBe('en');
  });

  it('parses a fixed-list variant (`products` as comma-separated string)', () => {
    const parsed = RecommendationsSchema.parse(WITH_PRODUCTS);

    expect(parsed.products).toBe('p-1, p-2, p-3');
  });

  it('rejects a wrong discriminator value', () => {
    expect(() =>
      RecommendationsSchema.parse({
        id: 'rec-4',
        type: 'hero',
      }),
    ).toThrow();
  });
});

describe('Recommendations — component', () => {
  it('spreads `data-testid` onto its root DOM element', () => {
    const { container } = render(<Recommendations {...WITH_PRODUCT_ID} data-testid="cms-recommendations-root" />);

    expect(container.firstChild).toHaveAttribute('data-testid', 'cms-recommendations-root');
  });

  it('merges incoming className with its own root classes (does not clobber)', () => {
    const { container } = render(<Recommendations {...WITH_PRODUCT_ID} className="extra-class" />);

    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('extra-class');
  });
});

describe('Recommendations — no-data / error path returns null', () => {
  it('renders nothing (firstChild === null) for the no-data path (neither productId nor products)', () => {
    const { container } = render(<Recommendations {...MINIMAL} data-testid="cms-recommendations-root" />);

    expect(container.firstChild).toBeNull();
  });

  it('renders nothing (firstChild === null) for the empty-result path', () => {
    const EMPTY_RESULT: RecommendationsData = {
      id: 'rec-empty',
      type: 'recommendations',
      products: '',
    };
    const { container } = render(<Recommendations {...EMPTY_RESULT} />);

    expect(container.firstChild).toBeNull();
  });

  it('does not leave a py-8 shell when the client island collapses to null', () => {
    mockedCarousel.mockReturnValue(null);

    const { container } = render(<Recommendations {...WITH_PRODUCT_ID} />);

    expect(container.firstChild).toBeNull();
    expect(container.querySelector('.py-8')).toBeNull();
    expect(container.querySelector('.content-container')).toBeNull();
  });
});

describe('Recommendations — CMS editable attributes', () => {
  it('spreads data-blok-* attributes onto its root when the CMS wires them', () => {
    const { container } = render(
      <Recommendations {...WITH_PRODUCT_ID} data-blok-c="recommendations" data-blok-uid="editable-uid-recs" />,
    );

    const root = container.firstChild as HTMLElement;
    expect(root.dataset.blokC).toBe('recommendations');
    expect(root.dataset.blokUid).toBe('editable-uid-recs');
  });
});
