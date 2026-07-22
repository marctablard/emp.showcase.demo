/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { Quote } from '@/platform/services/model/quote';
import QuotesPageContent from './quotes-page';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) => {
    if (values) {
      return `${key}:${JSON.stringify(values)}`;
    }
    return key;
  },
  useLocale: () => 'en-US',
}));

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn() }),
}));

const mockUseQuotes = jest.fn();

jest.mock('@/hooks/quotes/useQuotes', () => ({
  useQuotes: (...args: unknown[]) => mockUseQuotes(...args),
}));

function buildQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: 'Q-1',
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
    ...overrides,
  };
}

function mockQuotesResult(overrides: {
  quotes: Quote[];
  loading?: boolean;
  error?: Error | null;
  pagination?: { pageNumber: number; pageSize: number; totalPages: number; totalItems: number };
}) {
  mockUseQuotes.mockReturnValue({
    quotes: overrides.quotes,
    loading: overrides.loading ?? false,
    error: overrides.error ?? null,
    pagination: overrides.pagination,
    availableFilters: [],
    refetchQuotes: jest.fn(),
  });
}

describe('QuotesPageContent', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('passes the canonical initial page-one default-sort request metadata to useQuotes for SSR hydration reuse', () => {
    mockQuotesResult({
      quotes: [buildQuote()],
      pagination: { pageNumber: 0, pageSize: 5, totalPages: 1, totalItems: 1 },
    });

    render(<QuotesPageContent initialQuotes={[buildQuote()]} initialTotalCount={1} />);

    expect(mockUseQuotes).toHaveBeenCalled();
    const [, options] = mockUseQuotes.mock.calls[mockUseQuotes.mock.calls.length - 1];
    expect(options).toMatchObject({
      page: 0,
      size: 5,
      sort: 'metadata.createdAt:DESC',
      initialTotalCount: 1,
      initialRequest: {
        page: 0,
        size: 5,
        sort: 'metadata.createdAt:DESC',
        query: undefined,
      },
    });
  });

  it('wraps the search, table, and pagination in the shared table-card surface', () => {
    mockQuotesResult({
      quotes: [buildQuote()],
      pagination: { pageNumber: 0, pageSize: 5, totalPages: 3, totalItems: 15 },
    });
    const { container } = render(<QuotesPageContent initialQuotes={[buildQuote()]} />);

    const tableCard = container.querySelector('[data-slot="table-card"]');
    expect(tableCard).not.toBeNull();
    expect(tableCard).toHaveClass(
      'bg-surface-primary',
      'border',
      'border-border-primary',
      'rounded-md',
      'shadow-[var(--theme-shadow-sm)]',
    );
    expect(tableCard).not.toHaveClass('shadow-sm');
    expect(tableCard?.querySelector('table')).not.toBeNull();
    expect(tableCard?.querySelector('input')).not.toBeNull();
  });

  it('scopes quick search to raw id and customerReference fields only, never the mapper-derived reference field', () => {
    mockQuotesResult({ quotes: [], pagination: { pageNumber: 0, pageSize: 5, totalPages: 1, totalItems: 0 } });
    render(<QuotesPageContent initialQuotes={[]} />);

    const input = screen.getByPlaceholderText('searchPlaceholder');
    fireEvent.change(input, { target: { value: 'abc' } });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    const [, options] = mockUseQuotes.mock.calls[mockUseQuotes.mock.calls.length - 1];
    expect(options.query).toBe('compoundLogicalQuery:((id:~(abc)) OR (customerReference:~(abc)))');
    expect(options.query).not.toContain('mixins');
    expect(options.query).not.toContain('customer.firstName');
  });

  it('resets to page 1 when a new search term is entered', () => {
    mockQuotesResult({
      quotes: [buildQuote()],
      pagination: { pageNumber: 1, pageSize: 5, totalPages: 3, totalItems: 15 },
    });
    render(<QuotesPageContent initialQuotes={[buildQuote()]} />);

    const input = screen.getByPlaceholderText('searchPlaceholder');
    fireEvent.change(input, { target: { value: 'q' } });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    const [, options] = mockUseQuotes.mock.calls[mockUseQuotes.mock.calls.length - 1];
    expect(options.page).toBe(0);
  });

  it('renders the error state distinctly instead of the table when the fetch fails', () => {
    mockQuotesResult({ quotes: [], error: new Error('boom') });
    render(<QuotesPageContent initialQuotes={[]} />);

    expect(screen.getByText('boom')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
