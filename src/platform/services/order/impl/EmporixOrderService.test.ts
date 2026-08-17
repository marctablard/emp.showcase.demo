import type { EmporixOrder } from '@/platform/integrations/emporix/model/order';
import type { EmporixOrderApi } from '@/platform/integrations/emporix/order/EmporixOrderApi';
import type { OrderMapper } from '@/platform/services/model/order/OrderMapper';
import type { Order } from '@/platform/services/model/order/order';
import type { SessionService } from '@/platform/services/session/SessionService';
import EmporixOrderService from './EmporixOrderService';

function createService(
  mockOrderApi: Pick<EmporixOrderApi, 'getCustomerOrdersPage'>,
  mapper: OrderMapper<EmporixOrder>,
  legalEntityId?: string,
) {
  const sessionService = {
    getCurrent: jest.fn().mockResolvedValue(legalEntityId === undefined ? undefined : { legalEntityId }),
  } as unknown as SessionService;

  return new EmporixOrderService(mockOrderApi as unknown as EmporixOrderApi, mapper, sessionService);
}

describe('EmporixOrderService', () => {
  it('maps paged customer orders and preserves total count', async () => {
    const mockOrderApi: jest.Mocked<Pick<EmporixOrderApi, 'getCustomerOrdersPage'>> = {
      getCustomerOrdersPage: jest.fn().mockResolvedValue({
        items: [{ id: 'order-1', status: 'CREATED', entries: [], customer: { id: 'customer-1' } } as EmporixOrder],
        totalCount: 31,
      }),
    };

    const mapToService = jest.fn().mockReturnValue({ id: 'order-1', status: 'CREATED', items: [] } as Order);
    const mapper = { mapToService } as unknown as OrderMapper<EmporixOrder>;

    const service = createService(mockOrderApi, mapper);

    const page = await service.getCustomerOrdersPage(10, 2, 'created:desc', 'status:CREATED');

    expect(mockOrderApi.getCustomerOrdersPage).toHaveBeenCalledWith(10, 2, 'created:desc', 'status:CREATED');
    expect(mapToService).toHaveBeenCalledTimes(1);
    expect(page).toEqual({
      items: [{ id: 'order-1', status: 'CREATED', items: [] }],
      totalCount: 31,
    });
  });

  it('keeps getCustomerOrders compatibility by returning only items', async () => {
    const mockOrderApi: jest.Mocked<Pick<EmporixOrderApi, 'getCustomerOrdersPage'>> = {
      getCustomerOrdersPage: jest.fn().mockResolvedValue({
        items: [{ id: 'order-2', status: 'CONFIRMED', entries: [], customer: { id: 'customer-2' } } as EmporixOrder],
        totalCount: 1,
      }),
    };

    const mapper = {
      mapToService: jest.fn().mockReturnValue({ id: 'order-2', status: 'CONFIRMED', items: [] } as Order),
    } as unknown as OrderMapper<EmporixOrder>;

    const service = createService(mockOrderApi, mapper);

    const items = await service.getCustomerOrders(10, 1, 'created:desc', 'status:CONFIRMED');

    expect(items).toEqual([{ id: 'order-2', status: 'CONFIRMED', items: [] }]);
  });

  it('ANDs session legalEntityId onto the customer order list q', async () => {
    const mockOrderApi: jest.Mocked<Pick<EmporixOrderApi, 'getCustomerOrdersPage'>> = {
      getCustomerOrdersPage: jest.fn().mockResolvedValue({ items: [], totalCount: 0 }),
    };
    const mapper = { mapToService: jest.fn() } as unknown as OrderMapper<EmporixOrder>;
    const service = createService(mockOrderApi, mapper, 'le-a');

    await service.getCustomerOrdersPage(5, 1, 'created:DESC', 'id:~(ORD-10)');

    expect(mockOrderApi.getCustomerOrdersPage).toHaveBeenCalledWith(
      5,
      1,
      'created:DESC',
      'id:~(ORD-10) legalEntityId:le-a',
    );
  });

  it('filters the customer order list by session legalEntityId when there is no search q', async () => {
    const mockOrderApi: jest.Mocked<Pick<EmporixOrderApi, 'getCustomerOrdersPage'>> = {
      getCustomerOrdersPage: jest.fn().mockResolvedValue({ items: [], totalCount: 0 }),
    };
    const mapper = { mapToService: jest.fn() } as unknown as OrderMapper<EmporixOrder>;
    const service = createService(mockOrderApi, mapper, 'le-a');

    await service.getCustomerOrdersPage(5, 1, 'created:DESC');

    expect(mockOrderApi.getCustomerOrdersPage).toHaveBeenCalledWith(5, 1, 'created:DESC', 'legalEntityId:le-a');
  });
});
