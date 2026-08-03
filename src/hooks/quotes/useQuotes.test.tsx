/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { renderHook, waitFor } from '@testing-library/react';
import type { Quote } from '@/platform/services/model/quote';
import { useQuotes } from './useQuotes';

const fetchMock = jest.fn();

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  }),
}));

function buildQuote(id: string): Quote {
  return {
    id,
    status: 'ACCEPTED',
    reference: 'PO-1',
    submittedDate: '2026-05-31T10:00:00.000Z',
    customerId: 'customer-1',
    customerName: 'Ada Lovelace',
    currency: 'EUR',
    totalGross: 120,
    totalNet: 100,
    totalVat: 20,
    items: [],
    shippingAddress: {
      contactName: 'Ada Lovelace',
      street: 'Test Street',
      zipCode: '10115',
      city: 'Berlin',
      country: 'DE',
      type: 'SHIPPING',
    },
    shippingCost: 0,
    shippingMethod: 'STANDARD',
  };
}

describe('useQuotes', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it('reuses SSR initial data when filters are value-equivalent despite different object identity', async () => {
    renderHook(() =>
      useQuotes([buildQuote('Q-1')], {
        page: 0,
        size: 10,
        sort: 'metadata.createdAt:DESC',
        query: 'id:~(Q-)',
        filters: {
          status: ['OPEN', 'ACCEPTED'],
          price: { currency: ['EUR'], min: '100' },
        },
        initialRequest: {
          page: 0,
          size: 10,
          sort: 'metadata.createdAt:DESC',
          query: 'id:~(Q-)',
          filters: {
            price: { min: '100', currency: ['EUR'] },
            status: ['ACCEPTED', 'OPEN'],
          },
        },
      }),
    );

    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('fetches when initialRequest filters differ in values', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [buildQuote('Q-2')], total: 1, page: 0, pageSize: 10, availableFilters: [] }),
      statusText: 'OK',
    } as unknown as Response);

    renderHook(() =>
      useQuotes([buildQuote('Q-1')], {
        page: 0,
        size: 10,
        sort: 'metadata.createdAt:DESC',
        filters: {
          status: ['OPEN'],
        },
        initialRequest: {
          page: 0,
          size: 10,
          sort: 'metadata.createdAt:DESC',
          filters: {
            status: ['ACCEPTED'],
          },
        },
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  it('refetches page 0 after visiting page 1 when initial page 0 was SSR-reused', async () => {
    const ssrPageZero = [buildQuote('SSR-0')];
    const fetchedPageOne = [buildQuote('P1-1')];
    const fetchedPageZero = [buildQuote('P0-FRESH-1')];

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: fetchedPageOne,
          total: 22,
          page: 1,
          pageSize: 10,
          availableFilters: [],
        }),
        statusText: 'OK',
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: fetchedPageZero,
          total: 11,
          page: 0,
          pageSize: 10,
          availableFilters: [],
        }),
        statusText: 'OK',
      } as unknown as Response);

    const { result, rerender } = renderHook(
      ({ page }) =>
        useQuotes(ssrPageZero, {
          page,
          size: 10,
          initialTotalCount: 11,
          initialRequest: {
            page: 0,
            size: 10,
            sort: undefined,
            query: undefined,
            filters: undefined,
          },
        }),
      { initialProps: { page: 0 } },
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.quotes).toEqual(ssrPageZero);

    rerender({ page: 1 });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/quotes?page=1&size=10');
    });
    await waitFor(() => expect(result.current.quotes).toEqual(fetchedPageOne));

    rerender({ page: 0 });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/quotes?page=0&size=10');
    });
    await waitFor(() => expect(result.current.quotes).toEqual(fetchedPageZero));
    expect(result.current.quotes).not.toEqual(fetchedPageOne);
  });
});
