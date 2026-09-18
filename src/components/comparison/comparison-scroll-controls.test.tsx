/**
 * @jest-environment jsdom
 *
 * The controls are the only hint that the comparison holds more products than fit. Beside the
 * position indicator a disabled arrow reads as the end of the list, so both stay in place — but
 * the pair disappears once everything is visible.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { ComparisonScrollControls } from './comparison-scroll-controls';

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const translate = (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${JSON.stringify(values)}` : key;
    translate.rich = (key: string) => key;
    translate.has = () => false;
    return translate;
  },
}));

const onScroll = jest.fn();

beforeEach(() => {
  onScroll.mockClear();
});

describe('ComparisonScrollControls', () => {
  it('renders nothing while every product is visible', () => {
    const { container } = render(
      <ComparisonScrollControls
        canScrollBack={false}
        canScrollForward={false}
        firstVisible={1}
        lastVisible={4}
        total={4}
        onScroll={onScroll}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('disables the direction with nothing behind it', () => {
    render(
      <ComparisonScrollControls
        canScrollBack={false}
        canScrollForward
        firstVisible={1}
        lastVisible={2}
        total={4}
        onScroll={onScroll}
      />,
    );

    expect(screen.getByTestId('comparison-scroll-prev')).toBeDisabled();
    expect(screen.getByTestId('comparison-scroll-next')).toBeEnabled();
  });

  it('reports the visible range against the total', () => {
    render(
      <ComparisonScrollControls
        canScrollBack
        canScrollForward={false}
        firstVisible={3}
        lastVisible={4}
        total={4}
        onScroll={onScroll}
      />,
    );

    expect(screen.getByTestId('comparison-scroll-position')).toHaveTextContent('"range":"3–4","total":4');
  });

  it('reports a single visible product as one number, not as a range', () => {
    render(
      <ComparisonScrollControls
        canScrollBack={false}
        canScrollForward
        firstVisible={1}
        lastVisible={1}
        total={4}
        onScroll={onScroll}
      />,
    );

    expect(screen.getByTestId('comparison-scroll-position')).toHaveTextContent('"range":"1","total":4');
  });

  it('speaks the position as a sentence, since the dash is not read', () => {
    render(
      <ComparisonScrollControls
        canScrollBack
        canScrollForward={false}
        firstVisible={2}
        lastVisible={4}
        total={4}
        onScroll={onScroll}
      />,
    );

    const indicator = screen.getByTestId('comparison-scroll-position');
    // The compressed forms are for the eye only — read out they would be "2 4 von 4".
    indicator.querySelectorAll('[aria-hidden]').forEach((form) => expect(form).toBeInTheDocument());
    expect(indicator.querySelectorAll('[aria-hidden]')).toHaveLength(2);
    const spoken = screen.getByText(/productRangeAnnouncement/);
    expect(spoken).toHaveClass('sr-only');
    expect(spoken).toHaveAttribute('aria-live', 'polite');
  });

  it('speaks a single visible product without a range', () => {
    render(
      <ComparisonScrollControls
        canScrollBack={false}
        canScrollForward
        firstVisible={1}
        lastVisible={1}
        total={4}
        onScroll={onScroll}
      />,
    );

    expect(screen.getByText(/productPositionAnnouncement/)).toHaveClass('sr-only');
  });

  it('names each arrow once rather than through title and aria-label at the same time', () => {
    render(
      <ComparisonScrollControls
        canScrollBack
        canScrollForward
        firstVisible={2}
        lastVisible={3}
        total={4}
        onScroll={onScroll}
      />,
    );

    const next = screen.getByTestId('comparison-scroll-next');
    expect(next).toHaveAttribute('aria-label', 'nextProducts');
    expect(next).not.toHaveAttribute('title');
  });

  it('steps forwards and backwards', () => {
    render(
      <ComparisonScrollControls
        canScrollBack
        canScrollForward
        firstVisible={2}
        lastVisible={3}
        total={4}
        onScroll={onScroll}
      />,
    );

    fireEvent.click(screen.getByTestId('comparison-scroll-next'));
    fireEvent.click(screen.getByTestId('comparison-scroll-prev'));

    expect(onScroll).toHaveBeenNthCalledWith(1, 1);
    expect(onScroll).toHaveBeenNthCalledWith(2, -1);
  });
});
