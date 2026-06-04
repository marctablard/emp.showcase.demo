import type { EmporixSchemaApi } from '@/platform/integrations/emporix/schema/EmporixSchemaApi';
import EmporixQuoteAddItemNotificationService from './EmporixQuoteAddItemNotificationService';

describe('EmporixQuoteAddItemNotificationService', () => {
  let schemaApi: jest.Mocked<Pick<EmporixSchemaApi, 'getCustomEntity'>>;
  let service: EmporixQuoteAddItemNotificationService;

  beforeEach(() => {
    schemaApi = {
      getCustomEntity: jest.fn(),
    };
    service = new EmporixQuoteAddItemNotificationService(schemaApi as EmporixSchemaApi);
  });

  it('returns null when entity is not found', async () => {
    schemaApi.getCustomEntity.mockResolvedValue(null);
    await expect(service.getNotification('missing')).resolves.toBeNull();
    expect(schemaApi.getCustomEntity).toHaveBeenCalledWith('QUOTE_ADDITEM_NOTIFICATIONS', 'missing');
  });

  it('maps quote_additem_notification_data mixin to domain model', async () => {
    schemaApi.getCustomEntity.mockResolvedValue({
      id: '6a211cc333746603889c0d72',
      mixins: {
        quote_additem_notification_data: {
          customerid: 'cust-1',
          productid: 'solarpanel',
          productquantity: '2',
          quoteid: 'Q1000010',
          request: { initialrequestid: 'req-1' },
          response: {
            responsemessage: 'Product Not Authorized',
            responsestatus: 'DENIED',
          },
        },
      },
      metadata: {
        createdAt: '2026-06-04T06:35:47.907Z',
        modifiedAt: '2026-06-04T06:35:58.129Z',
      },
    });

    const result = await service.getNotification('6a211cc333746603889c0d72');

    expect(result).toEqual({
      id: '6a211cc333746603889c0d72',
      quoteId: 'Q1000010',
      productId: 'solarpanel',
      productQuantity: '2',
      customerId: 'cust-1',
      initialRequestId: 'req-1',
      responseStatus: 'DENIED',
      responseMessage: 'Product Not Authorized',
      createdAt: '2026-06-04T06:35:47.907Z',
      modifiedAt: '2026-06-04T06:35:58.129Z',
    });
  });

  it('returns pending notification when mixin is not yet present on the entity', async () => {
    schemaApi.getCustomEntity.mockResolvedValue({
      id: '6a21222e33746603889c0d77',
      mixins: {},
      metadata: {
        createdAt: '2026-06-04T06:35:47.907Z',
        modifiedAt: '2026-06-04T06:35:47.907Z',
      },
    });

    const result = await service.getNotification('6a21222e33746603889c0d77');

    expect(result).toEqual({
      id: '6a21222e33746603889c0d77',
      responseStatus: '',
      createdAt: '2026-06-04T06:35:47.907Z',
      modifiedAt: '2026-06-04T06:35:47.907Z',
    });
  });

  it('returns empty response status while background processing is pending', async () => {
    schemaApi.getCustomEntity.mockResolvedValue({
      id: 'pending-1',
      mixins: {
        quote_additem_notification_data: {
          quoteid: 'Q1000010',
          response: { responsemessage: '', responsestatus: '' },
        },
      },
      metadata: {},
    });

    const result = await service.getNotification('pending-1');
    expect(result?.responseStatus).toBe('');
  });
});
