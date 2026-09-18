/**
 * @jest-environment jsdom
 *
 * The shared behaviour of every compare button: the toggle plus its toasts, and the
 * hydration-safe read the buttons render from.
 */
import '@testing-library/jest-dom';
import { renderHook } from '@testing-library/react';
import { notify } from '@/components/ui/toast-notification';
import { useIsHydrated } from '@/hooks/common/useIsHydrated';
import { useComparison } from '@/hooks/comparison/useComparison';
import { useComparisonToggle } from '@/hooks/comparison/useComparisonToggle';
import { MAX_COMPARISON_PRODUCTS } from '@/stores/comparison-store';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

jest.mock('@/components/ui/toast-notification', () => ({
  ToastType: { Success: 'success', Info: 'info', Warning: 'warning', Error: 'error' },
  notify: jest.fn(),
}));

jest.mock('@/hooks/common/useIsHydrated', () => ({ useIsHydrated: jest.fn() }));
jest.mock('@/hooks/comparison/useComparison', () => ({ useComparison: jest.fn() }));

const mockUseIsHydrated = useIsHydrated as jest.Mock;
const mockUseComparison = useComparison as jest.Mock;
const mockNotify = notify as jest.Mock;

let stored: Set<string>;
let toggleProduct: jest.Mock;

function arrange({ hydrated = true, isFull = false }: { hydrated?: boolean; isFull?: boolean } = {}) {
  mockUseIsHydrated.mockReturnValue(hydrated);
  mockUseComparison.mockReturnValue({
    isInComparison: (id: string) => stored.has(id),
    toggleProduct,
    isFull,
  });
  return renderHook(() => useComparisonToggle());
}

beforeEach(() => {
  stored = new Set<string>();
  toggleProduct = jest.fn();
  mockNotify.mockReset();
});

describe('useComparisonToggle', () => {
  describe('isInComparison', () => {
    it('reports the stored state once the client has hydrated', () => {
      stored.add('p1');

      const { result } = arrange({ hydrated: true });

      expect(result.current.isInComparison('p1')).toBe(true);
      expect(result.current.isInComparison('p2')).toBe(false);
    });

    it('reports false before hydration, so the button matches the server markup', () => {
      stored.add('p1');

      const { result } = arrange({ hydrated: false });

      // The server cannot know the localStorage-backed comparison and always renders the button
      // inactive. React keeps server attributes on a mismatch, so claiming "pressed" in the first
      // client pass lost the state for the rest of the page's life.
      expect(result.current.isInComparison('p1')).toBe(false);
    });
  });

  describe('toggle', () => {
    it('adds a product that is not in the comparison and says so', () => {
      const { result } = arrange();

      result.current.toggle('p1', 'Widget');

      expect(toggleProduct).toHaveBeenCalledWith('p1');
      expect(mockNotify).toHaveBeenCalledWith({
        title: 'addedToComparison:{"name":"Widget"}',
        type: 'success',
      });
    });

    it('removes a product that is already in the comparison and says so', () => {
      stored.add('p1');
      const { result } = arrange();

      result.current.toggle('p1', 'Widget');

      expect(toggleProduct).toHaveBeenCalledWith('p1');
      expect(mockNotify).toHaveBeenCalledWith({
        title: 'removedFromComparison:{"name":"Widget"}',
        type: 'info',
      });
    });

    it('refuses to add beyond the maximum and leaves the comparison untouched', () => {
      const { result } = arrange({ isFull: true });

      result.current.toggle('p5', 'Widget');

      expect(toggleProduct).not.toHaveBeenCalled();
      expect(mockNotify).toHaveBeenCalledWith({
        title: `comparisonFull:{"max":${MAX_COMPARISON_PRODUCTS}}`,
        type: 'warning',
      });
    });

    it('acts on the stored state even before hydration', () => {
      stored.add('p1');
      const { result } = arrange({ hydrated: false });

      result.current.toggle('p1', 'Widget');

      // The button renders as inactive at this point, but the product IS stored — a click has to
      // remove it, not add it a second time.
      expect(mockNotify).toHaveBeenCalledWith({
        title: 'removedFromComparison:{"name":"Widget"}',
        type: 'info',
      });
    });
  });
});
