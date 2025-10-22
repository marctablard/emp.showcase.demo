import { format } from 'date-fns';
import { injectable } from '@/platform/core/di/injectable';
import { EmporixQuoteHistory, EmporixQuoteHistoryItem } from '@/platform/integrations/emporix/model/quote';
import { QuoteHistory } from '..';
import type { QuoteHistoryMapper } from './QuoteHistoryMapper';

/**
 * Implementation of QuoteHistoryMapper for Emporix quote history.
 * Maps Emporix QuoteHistory to internal QuoteHistory model
 */
@injectable('QuoteHistoryMapper', 'Singleton')
export class EmporixQuoteHistoryMapper implements QuoteHistoryMapper<EmporixQuoteHistory> {
  mapToService(emporixQuoteHistory: EmporixQuoteHistory): QuoteHistory {
    const formatDate = (dateString?: string) => {
      if (!dateString) return '-';
      return format(new Date(dateString), 'dd.MM.yyyy');
    };
    const allowedPaths = ['/comment', '/status'];
    return emporixQuoteHistory
      .filter((item: EmporixQuoteHistoryItem) => allowedPaths.includes(item.path) || item.path.startsWith('/mixins/'))
      .map((item: EmporixQuoteHistoryItem) => ({
        id: item.id,
        userFullName: `${item.userFirstName || ''} ${item.userLastName || ''}`.trim(),
        comment:
          item.path === '/comment'
            ? item.newValue?.employeeComment
            : item.path.startsWith('/mixins/')
              ? item.newValue?.userComment
              : '-',
        modifiedAt: formatDate(item.modifiedAt),
        rawModifiedAt: item.modifiedAt,
        fieldChanged: item.path,
      }))
      .sort((a: any, b: any) => {
        if (!a.rawModifiedAt || !b.rawModifiedAt) return 0;
        return new Date(a.rawModifiedAt).getTime() - new Date(b.rawModifiedAt).getTime();
      });
  }
}

export default EmporixQuoteHistoryMapper;
