import type { EmporixQuoteHistory } from '@/platform/integrations/emporix/model/quote';
import { EmporixQuoteHistoryMapper } from './EmporixQuoteHistoryMapper';

describe('EmporixQuoteHistoryMapper', () => {
  it('preserves status transition details for history rendering', () => {
    const mapper = new EmporixQuoteHistoryMapper();

    const result = mapper.mapToService([
      {
        id: 'history-1',
        op: 'REPLACE',
        path: '/status',
        userFirstName: 'Pawel',
        userLastName: 'Buyer2',
        userType: 'CUSTOMER',
        newValue: {
          value: 'IN_PROGRESS',
          comment: 'want discount',
          quoteReason: {
            code: 'PROVIDED_PRICE_TO_HIGH',
          },
        },
        modifiedAt: '2026-06-03T07:06:06.904Z',
      },
    ] satisfies EmporixQuoteHistory);

    expect(result).toEqual([
      expect.objectContaining({
        id: 'history-1',
        userFullName: 'Pawel Buyer2 (CUSTOMER)',
        userType: 'CUSTOMER',
        comment: 'want discount',
        fieldChanged: '/status',
        statusValue: 'IN_PROGRESS',
        quoteReason: 'PROVIDED_PRICE_TO_HIGH',
        rawModifiedAt: '2026-06-03T07:06:06.904Z',
        modifiedAt: '2026-06-03T07:06:06.904Z',
      }),
    ]);
  });

  it('keeps mixin comments visible and filters unrelated history rows', () => {
    const mapper = new EmporixQuoteHistoryMapper();

    const result = mapper.mapToService([
      {
        id: 'history-ignored',
        op: 'REPLACE',
        path: '/shipping',
        modifiedAt: '2026-06-03T07:06:28.199Z',
      },
      {
        id: 'history-2',
        op: 'ADD',
        path: '/mixins/additionalInfo',
        userFirstName: 'Lukasz',
        userLastName: 'Stypka',
        userType: 'EMPLOYEE',
        newValue: {
          userComment: 'buyer account quote',
        },
        modifiedAt: '2026-06-03T07:04:12.126Z',
      },
    ] satisfies EmporixQuoteHistory);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 'history-2',
        userFullName: 'Lukasz Stypka (EMPLOYEE)',
        comment: 'buyer account quote',
        fieldChanged: '/mixins/additionalInfo',
      }),
    );
  });
});
