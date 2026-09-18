/**
 * @jest-environment jsdom
 *
 * The strip names the columns once the cards themselves are gone behind the sticky bar. It cannot
 * be sticky inside the horizontal scroller, so the scroller drives this row's transform directly
 * through the ref handed in here.
 */
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import type { Product } from '@/platform/services/model/product';
import { ComparisonNameStrip } from './comparison-name-strip';

jest.mock('next-intl', () => ({ useLocale: () => 'de' }));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, src, className }: { alt: string; src: string; className?: string }) => (
    <img alt={alt} src={src} className={className} />
  ),
}));

jest.mock('@/hooks/useL10n', () => ({
  useL10n: () => ({ l10n: (input: unknown) => (typeof input === 'string' ? input : '') }),
}));

/** Stands in for the scroller: every column but the first is separated. */
const hasSeparator = (columnIndex: number) => columnIndex > 0;

const PRODUCTS = [
  { id: 'p1', name: 'Widget', primaryImage: { url: '/widget.png' } },
  { id: 'p2', name: 'Gadget' },
] as unknown as Product[];

describe('ComparisonNameStrip', () => {
  it('hands its row to the scroller, which drives the offset', () => {
    const rowRef = createRef<HTMLDivElement>();
    render(
      <ComparisonNameStrip
        products={PRODUCTS}
        labelPlacement="left"
        rowRef={rowRef}
        visible
        hasSeparator={hasSeparator}
      />,
    );

    expect(screen.getByTestId('comparison-name-strip')).toHaveAttribute('data-visible', 'true');
    expect(rowRef.current).toBe(screen.getByTestId('comparison-name-strip-row'));
  });

  it("carries no card of its own — it sits inside the sticky bar's", () => {
    render(
      <ComparisonNameStrip
        products={PRODUCTS}
        labelPlacement="left"
        rowRef={createRef<HTMLDivElement>()}
        visible
        hasSeparator={hasSeparator}
      />,
    );

    // Its own shadow left a smudge across the bar above it.
    const strip = screen.getByTestId('comparison-name-strip');
    expect(strip.className).not.toMatch(/shadow|rounded|bg-surface-page/);
  });

  it('collapses to nothing while the cards are still on screen', () => {
    render(
      <ComparisonNameStrip
        products={PRODUCTS}
        labelPlacement="left"
        rowRef={createRef<HTMLDivElement>()}
        visible={false}
        hasSeparator={hasSeparator}
      />,
    );

    const strip = screen.getByTestId('comparison-name-strip');
    expect(strip).toHaveClass('h-0');
    expect(strip).not.toHaveAttribute('data-visible');
  });

  it('repeats the names a screen reader already gets from the cards silently', () => {
    render(
      <ComparisonNameStrip
        products={PRODUCTS}
        labelPlacement="left"
        rowRef={createRef<HTMLDivElement>()}
        visible
        hasSeparator={hasSeparator}
      />,
    );

    expect(screen.getByTestId('comparison-name-strip')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Widget')).toBeInTheDocument();
    expect(screen.getByText('Gadget')).toBeInTheDocument();
  });

  it('falls back to the placeholder image where a product has none', () => {
    render(
      <ComparisonNameStrip
        products={PRODUCTS}
        labelPlacement="above"
        rowRef={createRef<HTMLDivElement>()}
        visible
        hasSeparator={hasSeparator}
      />,
    );

    const sources = screen.getAllByRole('presentation', { hidden: true }).map((image) => image.getAttribute('src'));
    expect(sources).toEqual(['/widget.png', '/images/no_image_alt.png']);
  });
});
