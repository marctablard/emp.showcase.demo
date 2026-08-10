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
    shippingAddress: {
      type: 'SHIPPING',
      contactName: 'Ada Lovelace',
      street: 'Main Street 1',
      zipCode: '10115',
      city: 'Berlin',
      country: 'Germany',
    },
    shippingCost: 0,
    shippingMethod: 'standard',
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

  it('wraps the search, table, and pagination in exactly one shared table-card surface', () => {
    mockQuotesResult({
      quotes: [buildQuote()],
      pagination: { pageNumber: 0, pageSize: 5, totalPages: 3, totalItems: 15 },
    });
    const { container } = render(<QuotesPageContent initialQuotes={[buildQuote()]} />);

    const tableCards = container.querySelectorAll('[data-slot="table-card"]');
    expect(tableCards).toHaveLength(1);

    const tableCard = tableCards[0];
    expect(tableCard).toHaveClass(
      'bg-surface-primary',
      'border',
      'border-border-primary',
      'rounded-md',
      'shadow-[var(--theme-shadow-sm)]',
    );
    expect(tableCard).not.toHaveClass('shadow-sm');
    expect(tableCard.querySelector('table')).not.toBeNull();
    expect(tableCard.querySelector('input')).not.toBeNull();
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
    expect(options.query).toBe(
      'compoundLogicalQuery:((id:~(abc)) OR (customerReference:~(abc)) OR (mixins.additionalInfo.reference:~(abc)))',
    );
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

  it('waits for the debounced trimmed search to reset page 1 and clears the query once the field is emptied', () => {
    mockQuotesResult({
      quotes: [buildQuote()],
      pagination: { pageNumber: 1, pageSize: 5, totalPages: 3, totalItems: 15 },
    });
    render(<QuotesPageContent initialQuotes={[buildQuote()]} />);

    const input = screen.getByPlaceholderText('searchPlaceholder');
    fireEvent.change(input, { target: { value: '  abc  ' } });

    const [, optionsBeforeDebounce] = mockUseQuotes.mock.calls[mockUseQuotes.mock.calls.length - 1];
    expect(optionsBeforeDebounce.page).toBe(0);
    expect(optionsBeforeDebounce.query).toBeUndefined();

    act(() => {
      jest.advanceTimersByTime(500);
    });

    const [, optionsAfterDebounce] = mockUseQuotes.mock.calls[mockUseQuotes.mock.calls.length - 1];
    expect(optionsAfterDebounce.query).toBe(
      'compoundLogicalQuery:((id:~(abc)) OR (customerReference:~(abc)) OR (mixins.additionalInfo.reference:~(abc)))',
    );
    expect(optionsAfterDebounce.page).toBe(0);

    fireEvent.change(input, { target: { value: '' } });

    const [, optionsAfterClearBeforeDebounce] = mockUseQuotes.mock.calls[mockUseQuotes.mock.calls.length - 1];
    expect(optionsAfterClearBeforeDebounce.page).toBe(0);
    expect(optionsAfterClearBeforeDebounce.query).toBe(
      'compoundLogicalQuery:((id:~(abc)) OR (customerReference:~(abc)) OR (mixins.additionalInfo.reference:~(abc)))',
    );

    act(() => {
      jest.advanceTimersByTime(500);
    });

    const [, optionsAfterDebouncedClear] = mockUseQuotes.mock.calls[mockUseQuotes.mock.calls.length - 1];
    expect(optionsAfterDebouncedClear.query).toBeUndefined();
    expect(optionsAfterDebouncedClear.page).toBe(0);
  });

  it('never calls useQuotes with {new query, old page} when the debounced search settles after paging forward', () => {
    mockQuotesResult({
      quotes: [buildQuote()],
      pagination: { pageNumber: 0, pageSize: 5, totalPages: 5, totalItems: 25 },
    });
    render(<QuotesPageContent initialQuotes={[buildQuote()]} initialTotalCount={25} />);

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: 'next' }));

    const [, pageThreeOptions] = mockUseQuotes.mock.calls[mockUseQuotes.mock.calls.length - 1];
    expect(pageThreeOptions.page).toBe(2);

    const input = screen.getByPlaceholderText('searchPlaceholder');
    fireEvent.change(input, { target: { value: 'abc' } });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    const staleCombo = mockUseQuotes.mock.calls.find(
      ([, options]) =>
        options.query ===
          'compoundLogicalQuery:((id:~(abc)) OR (customerReference:~(abc)) OR (mixins.additionalInfo.reference:~(abc)))' &&
        options.page === 2,
    );
    expect(staleCombo).toBeUndefined();

    const [, settledOptions] = mockUseQuotes.mock.calls[mockUseQuotes.mock.calls.length - 1];
    expect(settledOptions.query).toBe(
      'compoundLogicalQuery:((id:~(abc)) OR (customerReference:~(abc)) OR (mixins.additionalInfo.reference:~(abc)))',
    );
    expect(settledOptions.page).toBe(0);
  });

  it('renders the error state distinctly instead of the table when the fetch fails', () => {
    mockQuotesResult({ quotes: [], error: new Error('boom') });
    render(<QuotesPageContent initialQuotes={[]} />);

    expect(screen.getByText('boom')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
