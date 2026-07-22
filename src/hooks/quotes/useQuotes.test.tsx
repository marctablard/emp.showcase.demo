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
  } as Quote;
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
    } as Response);

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
});
