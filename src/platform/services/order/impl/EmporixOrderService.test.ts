import type { EmporixOrder } from '@/platform/integrations/emporix/model/order';
import type { EmporixOrderApi } from '@/platform/integrations/emporix/order/EmporixOrderApi';
import type { OrderMapper } from '@/platform/services/model/order/OrderMapper';
import type { Order } from '@/platform/services/model/order/order';
import EmporixOrderService from './EmporixOrderService';

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

    const service = new EmporixOrderService(mockOrderApi as unknown as EmporixOrderApi, mapper, {
      getCurrent: jest.fn(),
    } as never);

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

    const service = new EmporixOrderService(mockOrderApi as unknown as EmporixOrderApi, mapper, {
      getCurrent: jest.fn(),
    } as never);

    const items = await service.getCustomerOrders(10, 1, 'created:desc', 'status:CONFIRMED');

    expect(items).toEqual([{ id: 'order-2', status: 'CONFIRMED', items: [] }]);
  });
});
