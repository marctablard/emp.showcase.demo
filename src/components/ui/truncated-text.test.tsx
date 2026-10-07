/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TruncatedText } from './truncated-text';

let overflow = false;

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({
    open,
    onOpenChange,
    children,
  }: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: React.ReactNode;
  }) => (
    <div data-testid="truncated-tooltip" data-open={open ? 'true' : 'false'} onPointerMove={() => onOpenChange?.(true)}>
      {children}
    </div>
  ),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div role="tooltip">{children}</div>,
}));

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get() {
      return overflow ? 480 : 40;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return 120;
    },
  });

  class ResizeObserverMock {
    private readonly callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe(target: Element): void {
      this.callback([{ target } as ResizeObserverEntry], this);
    }

    unobserve(): void {}
    disconnect(): void {}
  }

  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    configurable: true,
    value: ResizeObserverMock,
  });
});

describe('TruncatedText', () => {
  const longCode = 'VKTEST-COUPON04-WITH-A-VERY-LONG-MERCHANT-CODE';

  beforeEach(() => {
    overflow = false;
  });

  it('keeps a short code on one line without a tooltip', async () => {
    render(<TruncatedText text="VKTEST-COUPON04" className="text-sm" />);

    const label = screen.getByText('VKTEST-COUPON04', { selector: 'p' });
    expect(label).toHaveClass('truncate');
    fireEvent.pointerMove(label, { pointerType: 'mouse' });

    await waitFor(() => {
      expect(screen.getByTestId('truncated-tooltip')).toHaveAttribute('data-open', 'false');
    });
  });

  it('shows the full string in a tooltip when the code does not fit', async () => {
    overflow = true;
    render(<TruncatedText text={longCode} />);

    const label = screen.getByText(longCode, { selector: 'p' });
    expect(label).toHaveClass('truncate');
    fireEvent.pointerMove(screen.getByTestId('truncated-tooltip'), { pointerType: 'mouse' });

    await waitFor(() => {
      expect(screen.getByTestId('truncated-tooltip')).toHaveAttribute('data-open', 'true');
    });
    expect(screen.getByRole('tooltip')).toHaveTextContent(longCode);
  });
});
