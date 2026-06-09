import type { EmporixQuote } from '@/platform/integrations/emporix/model/quote';
import type { EmporixQuoteApi } from '@/platform/integrations/emporix/quote/EmporixQuoteApi';
import type { CustomerService } from '@/platform/services/customer/CustomerService';
import type { QuoteMapper } from '@/platform/services/model/quote/mapper/QuoteMapper';
import type { SchemaService } from '@/platform/services/schema/SchemaService';
import EmporixQuoteService from './EmporixQuoteService';

describe('EmporixQuoteService', () => {
  let quoteService: EmporixQuoteService;
  let mockQuoteApi: jest.Mocked<Pick<EmporixQuoteApi, 'getQuotes'>>;
  let mockCustomerService: jest.Mocked<Pick<CustomerService, 'getCustomer'>>;
  let mockQuoteMapper: jest.Mocked<Pick<QuoteMapper<EmporixQuote>, 'mapToService'>>;

  beforeEach(() => {
    mockQuoteApi = {
      getQuotes: jest.fn().mockResolvedValue({
        items: [],
        page: 1,
        size: 20,
        total: 0,
      }),
    };

    mockCustomerService = {
      getCustomer: jest.fn().mockResolvedValue({ id: 'customer-1' }),
    };

    mockQuoteMapper = {
      mapToService: jest.fn(),
    };

    quoteService = new EmporixQuoteService(
      mockQuoteApi as unknown as EmporixQuoteApi,
      mockCustomerService as unknown as CustomerService,
      mockQuoteMapper as unknown as QuoteMapper<EmporixQuote>,
      {} as never,
      {} as SchemaService,
    );
  });

  it('defaults quote search to newest-first ordering when no sort is provided', async () => {
    await quoteService.getQuotes({});

    expect(mockQuoteApi.getQuotes).toHaveBeenCalledWith(
      expect.objectContaining({
        sort: 'metadata.createdAt:desc',
        criteria: {
          'customer.customerId': 'customer-1',
        },
      }),
    );
  });

  it('preserves an explicit quote sort when one is provided', async () => {
    await quoteService.getQuotes({ sort: 'submittedDate:asc' });

    expect(mockQuoteApi.getQuotes).toHaveBeenCalledWith(
      expect.objectContaining({
        sort: 'submittedDate:asc',
      }),
    );
  });
});
