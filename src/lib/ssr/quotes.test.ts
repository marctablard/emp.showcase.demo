import { getQuoteById, getQuotes } from './quotes';

jest.mock('@/platform/ssr', () => {
  const services = new Map<string, unknown>();
  return {
    __esModule: true,
    default: {
      get: jest.fn((id: string) => services.get(id)),
      __services: services,
    },
  };
});

const mockedSsr = jest.requireMock('@/platform/ssr') as {
  default: { get: jest.Mock; __services: Map<string, unknown> };
};

describe('quotes SSR helpers', () => {
  const quoteService = {
    getQuote: jest.fn(),
    getQuotes: jest.fn(),
  };

  const logger = {
    error: jest.fn(),
  };

  beforeEach(() => {
    quoteService.getQuote.mockReset();
    quoteService.getQuotes.mockReset();
    logger.error.mockReset();
    mockedSsr.default.__services.clear();
    mockedSsr.default.__services.set('QuoteService', quoteService);
    mockedSsr.default.__services.set('LoggerService', logger);
    mockedSsr.default.get.mockImplementation((id: string) => mockedSsr.default.__services.get(id));
  });

  it('forwards query to QuoteService.getQuotes', async () => {
    quoteService.getQuotes.mockResolvedValueOnce({ items: [{ id: 'Q-1' }], total: 1 });

    const result = await getQuotes(10, 2, 'metadata.createdAt:DESC', 'id:~(Q-)');

    expect(result).toEqual({ items: [{ id: 'Q-1' }], totalCount: 1 });
    expect(quoteService.getQuotes).toHaveBeenCalledWith({
      size: 10,
      page: 2,
      sort: 'metadata.createdAt:DESC',
      query: 'id:~(Q-)',
    });
  });

  it('includes query in logger context when getQuotes fails', async () => {
    quoteService.getQuotes.mockRejectedValueOnce(new Error('boom'));

    const result = await getQuotes(5, 0, 'metadata.createdAt:DESC', 'customerReference:~(PO-)');

    expect(result).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      {
        error: 'boom',
        pageSize: 5,
        pageNumber: 0,
        sort: 'metadata.createdAt:DESC',
        query: 'customerReference:~(PO-)',
      },
      'SSR getQuotes failed',
    );
  });

  it('returns undefined and logs when getQuoteById fails', async () => {
    quoteService.getQuote.mockRejectedValueOnce(new Error('nope'));

    const result = await getQuoteById('Q-404');

    expect(result).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith({ error: 'nope', quoteId: 'Q-404' }, 'SSR getQuoteById failed');
  });
});
