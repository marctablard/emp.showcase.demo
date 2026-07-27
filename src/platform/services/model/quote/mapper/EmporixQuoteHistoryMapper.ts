import { injectable } from '@/platform/core/di/injectable';
import type { EmporixQuoteHistory, EmporixQuoteHistoryItem } from '@/platform/integrations/emporix/model/quote';
import type { QuoteHistory, QuoteHistoryItem } from '..';
import type { QuoteHistoryMapper } from './QuoteHistoryMapper';

/**
 * Implementation of QuoteHistoryMapper for Emporix quote history.
 * Maps Emporix QuoteHistory to internal QuoteHistory model
 */
@injectable('QuoteHistoryMapper', 'Singleton')
export class EmporixQuoteHistoryMapper implements QuoteHistoryMapper<EmporixQuoteHistory> {
  mapToService(emporixQuoteHistory: EmporixQuoteHistory): QuoteHistory {
    const allowedPaths = ['/comment', '/status'];

    const getUserFullName = (item: EmporixQuoteHistoryItem): string => {
      const fullName = [item.userFirstName, item.userLastName].filter(Boolean).join(' ').trim();

      if (item.userType) {
        return fullName !== '' ? `${fullName} (${item.userType})` : item.userType;
      }

      return fullName || '-';
    };

    const getComment = (item: EmporixQuoteHistoryItem): string => {
      if (item.path === '/comment') {
        return item.newValue?.employeeComment || '-';
      }

      if (item.path.startsWith('/mixins/')) {
        return item.newValue?.userComment || '-';
      }

      if (item.path === '/status') {
        return item.newValue?.comment || '-';
      }

      return '-';
    };

    const getQuoteReason = (item: EmporixQuoteHistoryItem): string | undefined => {
      const { quoteReason } = item.newValue ?? {};

      if (!quoteReason) {
        return undefined;
      }

      if (typeof quoteReason === 'string') {
        return quoteReason;
      }

      if (typeof quoteReason === 'object') {
        if (typeof quoteReason.code === 'string') {
          return quoteReason.code;
        }

        if (typeof quoteReason.id === 'string') {
          return quoteReason.id;
        }

        if (typeof quoteReason.value === 'string') {
          return quoteReason.value;
        }
      }

      return undefined;
    };

    return emporixQuoteHistory
      .filter((item: EmporixQuoteHistoryItem) => allowedPaths.includes(item.path) || item.path.startsWith('/mixins/'))
      .map(
        (item: EmporixQuoteHistoryItem): QuoteHistoryItem => ({
          id: item.id,
          userFullName: getUserFullName(item),
          userType: item.userType,
          comment: getComment(item),
          modifiedAt: item.modifiedAt || '-',
          rawModifiedAt: item.modifiedAt,
          fieldChanged: item.path,
          statusValue: typeof item.newValue?.value === 'string' ? item.newValue.value : undefined,
          quoteReason: getQuoteReason(item),
        }),
      )
      .sort((a: QuoteHistoryItem, b: QuoteHistoryItem) => {
        if (!a.rawModifiedAt || !b.rawModifiedAt) return 0;
        return new Date(a.rawModifiedAt).getTime() - new Date(b.rawModifiedAt).getTime();
      });
  }
}

export default EmporixQuoteHistoryMapper;
