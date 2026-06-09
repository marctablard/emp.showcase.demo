import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixPaginatedResponse } from '@/platform/integrations/emporix/model';
import type { EmporixQuote, EmporixQuoteHistory } from '@/platform/integrations/emporix/model/quote';
import type { EmporixQuoteApi } from '@/platform/integrations/emporix/quote/EmporixQuoteApi';
import type { CustomerService } from '@/platform/services/customer/CustomerService';
import type {
  CreateQuoteInput,
  Quote,
  QuoteHistory,
  QuoteReason,
  QuoteScope,
  QuoteUpdateRequest,
} from '@/platform/services/model/quote';
import type { QuoteHistoryMapper } from '@/platform/services/model/quote/mapper/QuoteHistoryMapper';
import type { QuoteMapper } from '@/platform/services/model/quote/mapper/QuoteMapper';
import type { QuoteService } from '@/platform/services/quote/QuoteService';
import type { SchemaService } from '@/platform/services/schema/SchemaService';
import type { SearchParams, SearchResult } from '../../model/common';

const DEFAULT_QUOTE_SORT = 'metadata.createdAt:desc';

@injectable('QuoteService', 'Singleton')
class EmporixQuoteService implements QuoteService {
  constructor(
    @inject('EmporixQuoteApi') private quoteApi: EmporixQuoteApi,
    @inject('CustomerService') private customerService: CustomerService,
    @inject('QuoteMapper') private quoteMapper: QuoteMapper<EmporixQuote>,
    @inject('QuoteHistoryMapper') private quoteHistoryMapper: QuoteHistoryMapper<EmporixQuoteHistory>,
    @inject('SchemaService') private schemaService: SchemaService,
  ) {}

  async createQuote(input: CreateQuoteInput): Promise<{ quoteId: string }> {
    const res = await this.quoteApi.createQuote(input as any);
    return { quoteId: res.quoteId };
  }

  async getQuotes(params: SearchParams<Quote>): Promise<SearchResult<Quote>> {
    const customer = await this.customerService.getCustomer();
    if (!customer) {
      throw new Error('Customer not found');
    }
    const sort = params.sort ?? DEFAULT_QUOTE_SORT;

    const searchResult: EmporixPaginatedResponse<EmporixQuote> = await this.quoteApi.getQuotes({
      page: (params.page || 0) + 1,
      size: params.size,
      query: params.query,
      criteria: {
        'customer.customerId': customer.id,
      },
      sort,
    });

    // TODO fetch for quotes of subordinates

    // Wait for all quotes to be mapped - using Promise.all to process them in parallel
    const mappedQuotes = await Promise.all(
      searchResult.items.map((quote) => Promise.resolve(this.quoteMapper.mapToService(quote))),
    );

    return {
      items: mappedQuotes,
      page: searchResult.page - 1,
      pageSize: params.size || 10,
      total: searchResult.total,
      availableFilters: [],
    };
  }

  async getQuote(quoteId: string): Promise<Quote> {
    const quote = await this.quoteApi.getQuote(quoteId);
    return Promise.resolve(this.quoteMapper.mapToService(quote));
  }

  async updateQuote(quoteId: string, operations: QuoteUpdateRequest[], scope: QuoteScope = 'public'): Promise<void> {
    await this.quoteApi.patchQuote(quoteId, operations, scope);
  }

  async addQuoteUserComment(quoteId: string, input: { comment: string; reference?: string }): Promise<void> {
    const emporixQuote = await this.quoteApi.getQuote(quoteId);
    const mixinValue = { reference: input.reference, userComment: input.comment };
    const updateList: QuoteUpdateRequest[] = [];

    if (emporixQuote.mixins?.additionalInfo !== undefined) {
      updateList.push({
        op: 'REPLACE',
        path: '/mixins/additionalInfo',
        value: mixinValue,
      });
    } else {
      const quoteMixinSchema = await this.schemaService.getSchema('additionalInfo');
      updateList.push({
        op: 'ADD',
        path: '/mixins/additionalInfo',
        value: mixinValue,
      });
      if (quoteMixinSchema.metadata?.url) {
        updateList.push({
          op: 'ADD',
          path: '/metadata/mixins/additionalInfo',
          value: quoteMixinSchema.metadata.url,
        });
      }
    }

    await this.updateQuote(quoteId, updateList, 'service');
  }

  async getQuoteReason(quoteReasonId: string): Promise<QuoteReason> {
    const emporixQuoteReason = await this.quoteApi.getQuoteReason(quoteReasonId);
    return emporixQuoteReason as QuoteReason;
  }

  async resolveQuoteReasonId(reasonType: string, reasonCode: string): Promise<string> {
    const quoteReasons = await this.quoteApi.getQuoteReasons();
    const normalizedReasonType = reasonType.toUpperCase();
    const normalizedReasonCode = reasonCode.toUpperCase();
    const quoteReason = quoteReasons.find(
      ({ code, type }) => code === normalizedReasonCode && type === normalizedReasonType,
    );

    if (!quoteReason) {
      throw new Error(`Quote reason ${normalizedReasonType}:${normalizedReasonCode} not found`);
    }

    return quoteReason.id;
  }

  async getQuoteHistory(quoteId: string): Promise<QuoteHistory> {
    const emporixHistory = await this.quoteApi.getQuoteHistory(quoteId);
    const mappedHistory = this.quoteHistoryMapper.mapToService(emporixHistory);
    return Promise.resolve(mappedHistory);
  }
}

export default EmporixQuoteService;
