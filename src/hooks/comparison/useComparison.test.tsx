import { act, renderHook } from '@testing-library/react';
import { MAX_COMPARISON_PRODUCTS } from '@/stores/comparison-store';
import { useComparison } from './useComparison';

const mockProductIds: string[] = [];
const mockAddProductId = jest.fn();
const mockRemoveProduct = jest.fn();
const mockIsInComparison = jest.fn();
const mockClearComparison = jest.fn();
const mockGetCount = jest.fn();

jest.mock('@/providers/StoreProvider', () => ({
  useComparisonStore: () => ({
    productIds: mockProductIds,
    addProductId: mockAddProductId,
    removeProduct: mockRemoveProduct,
    isInComparison: mockIsInComparison,
    clearComparison: mockClearComparison,
    getCount: mockGetCount,
  }),
}));

describe('useComparison', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProductIds.length = 0;
    mockGetCount.mockReturnValue(0);
    mockIsInComparison.mockReturnValue(false);
    mockAddProductId.mockReturnValue(true);
  });

  it('toggleProduct adds when product is not present', () => {
    mockIsInComparison.mockReturnValue(false);

    const { result } = renderHook(() => useComparison());
    act(() => {
      result.current.toggleProduct('p1');
    });

    expect(mockAddProductId).toHaveBeenCalledWith('p1');
    expect(mockRemoveProduct).not.toHaveBeenCalled();
  });

  it('toggleProduct removes when product is already present', () => {
    mockIsInComparison.mockReturnValue(true);

    const { result } = renderHook(() => useComparison());
    act(() => {
      result.current.toggleProduct('p1');
    });

    expect(mockRemoveProduct).toHaveBeenCalledWith('p1');
    expect(mockAddProductId).not.toHaveBeenCalled();
  });

  it('isFull returns true when store has MAX_COMPARISON_PRODUCTS', () => {
    for (let i = 1; i <= MAX_COMPARISON_PRODUCTS; i++) {
      mockProductIds.push(`p${i}`);
    }
    mockGetCount.mockReturnValue(MAX_COMPARISON_PRODUCTS);

    const { result } = renderHook(() => useComparison());
    expect(result.current.isFull).toBe(true);
  });

  it('isFull returns false when store has fewer than MAX products', () => {
    mockProductIds.push('p1');
    mockGetCount.mockReturnValue(1);

    const { result } = renderHook(() => useComparison());
    expect(result.current.isFull).toBe(false);
  });

  it('count reflects store getCount()', () => {
    mockGetCount.mockReturnValue(3);

    const { result } = renderHook(() => useComparison());
    expect(result.current.count).toBe(3);
  });
});
