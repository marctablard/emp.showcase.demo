import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCustomEntity } from '@/platform/integrations/emporix/model/schema';
import type { EmporixSchemaApi } from '@/platform/integrations/emporix/schema/EmporixSchemaApi';
import type {
  QuoteAddItemNotification,
  QuoteAddItemResponseStatus,
} from '@/platform/services/model/quote-add-item-notification/quote-add-item-notification';
import type { QuoteAddItemNotificationService } from '../QuoteAddItemNotificationService';

const ENTITY_TYPE = 'QUOTE_ADDITEM_NOTIFICATIONS';
const MIXIN_KEY = 'quote_additem_notification_data';

interface QuoteAddItemNotificationMixin {
  customerid?: string;
  productid?: string;
  productquantity?: string;
  quoteid?: string;
  request?: { initialrequestid?: string };
  response?: { responsemessage?: string; responsestatus?: string };
}

@injectable('QuoteAddItemNotificationService', 'Singleton')
class EmporixQuoteAddItemNotificationService implements QuoteAddItemNotificationService {
  constructor(@inject('EmporixSchemaApi') private schemaApi: EmporixSchemaApi) {}

  async getNotification(notificationId: string): Promise<QuoteAddItemNotification | null> {
    const entity = await this.schemaApi.getCustomEntity(ENTITY_TYPE, notificationId);
    if (!entity) {
      return null;
    }
    return this.mapToNotification(entity);
  }

  private mapToNotification(entity: EmporixCustomEntity): QuoteAddItemNotification {
    if (!entity.id) {
      throw new Error('Quote add-item notification entity is missing id');
    }

    const mixin = entity.mixins?.[MIXIN_KEY] as QuoteAddItemNotificationMixin | undefined;

    // Mixin and response fields are populated asynchronously after the webhook accepts the request.
    if (!mixin) {
      return {
        id: entity.id,
        responseStatus: '',
        createdAt: entity.metadata?.createdAt,
        modifiedAt: entity.metadata?.modifiedAt,
      };
    }

    const rawStatus = mixin.response?.responsestatus?.trim().toUpperCase() ?? '';
    const responseStatus: QuoteAddItemResponseStatus =
      rawStatus === 'SUCCESS' || rawStatus === 'DENIED' ? rawStatus : '';

    return {
      id: entity.id,
      quoteId: mixin.quoteid,
      productId: mixin.productid,
      productQuantity: mixin.productquantity,
      customerId: mixin.customerid,
      initialRequestId: mixin.request?.initialrequestid,
      responseStatus,
      responseMessage: mixin.response?.responsemessage,
      createdAt: entity.metadata?.createdAt,
      modifiedAt: entity.metadata?.modifiedAt,
    };
  }
}

export default EmporixQuoteAddItemNotificationService;
