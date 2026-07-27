import type { EmporixQuote } from '@/platform/integrations/emporix/model/quote';
import type { EmporixQuoteApi } from '@/platform/integrations/emporix/quote/EmporixQuoteApi';
import type { CustomerService } from '@/platform/services/customer/CustomerService';
import type { QuoteMapper } from '@/platform/services/model/quote/mapper/QuoteMapper';
import type { SchemaService } from '@/platform/services/schema/SchemaService';
import EmporixQuoteService from './EmporixQuoteService';

describe('EmporixQuoteService', () => {
  let quoteService: EmporixQuoteService;
  let mockQuoteApi: jest.Mocked<Pick<EmporixQuoteApi, 'getQuotes' | 'getQuote' | 'patchQuote'>>;
  let mockCustomerService: jest.Mocked<Pick<CustomerService, 'getCustomer'>>;
  let mockQuoteMapper: jest.Mocked<Pick<QuoteMapper<EmporixQuote>, 'mapToService'>>;
  let mockSchemaService: jest.Mocked<Pick<SchemaService, 'getSchema'>>;

  beforeEach(() => {
    mockQuoteApi = {
      getQuotes: jest.fn().mockResolvedValue({
        items: [],
        page: 1,
        size: 20,
        total: 0,
      }),
      getQuote: jest.fn().mockResolvedValue({
        mixins: {
          additionalInfo: {},
        },
      } as EmporixQuote),
      patchQuote: jest.fn().mockResolvedValue(undefined),
    };

    mockCustomerService = {
      getCustomer: jest.fn().mockResolvedValue({ id: 'customer-1' }),
    };

    mockQuoteMapper = {
      mapToService: jest.fn(),
    };

    mockSchemaService = {
      getSchema: jest.fn().mockResolvedValue({ metadata: { url: 'https://schemas/additionalInfo' } }),
    };

    quoteService = new EmporixQuoteService(
      mockQuoteApi as unknown as EmporixQuoteApi,
      mockCustomerService as unknown as CustomerService,
      mockQuoteMapper as unknown as QuoteMapper<EmporixQuote>,
      {} as never,
      mockSchemaService as unknown as SchemaService,
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

  it('updates quote user comment with customer session scope when additionalInfo mixin already exists', async () => {
    await quoteService.addQuoteUserComment('Q-1000', { comment: 'Please review', reference: 'PO-42' });

    expect(mockSchemaService.getSchema).not.toHaveBeenCalled();
    expect(mockQuoteApi.patchQuote).toHaveBeenCalledWith(
      'Q-1000',
      [
        {
          op: 'REPLACE',
          path: '/mixins/additionalInfo',
          value: { reference: 'PO-42', userComment: 'Please review' },
        },
      ],
      'session',
    );
  });

  it('adds quote additionalInfo mixin with customer session scope when mixin is missing', async () => {
    mockQuoteApi.getQuote.mockResolvedValueOnce({} as EmporixQuote);

    await quoteService.addQuoteUserComment('Q-1000', { comment: 'Please review', reference: 'PO-42' });

    expect(mockSchemaService.getSchema).toHaveBeenCalledWith('additionalInfo');
    expect(mockQuoteApi.patchQuote).toHaveBeenCalledWith(
      'Q-1000',
      [
        {
          op: 'ADD',
          path: '/mixins/additionalInfo',
          value: { reference: 'PO-42', userComment: 'Please review' },
        },
        {
          op: 'ADD',
          path: '/metadata/mixins/additionalInfo',
          value: 'https://schemas/additionalInfo',
        },
      ],
      'session',
    );
  });
});
