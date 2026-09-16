import { NextRequest } from 'next/server';
import server from '@/platform/server';
import type { Order } from '@/platform/services/model/order/order';
import type { Return } from '@/platform/services/model/return';
import { GET, POST } from './route';

jest.mock('@/platform/server', () => {
  const logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() };
  const get = jest.fn();
  // The route resolves LoggerService through the same container as its domain services. This
  // wrapper answers that id itself and passes every other one through to the dispatch installed
  // below, so the service mocks stay in charge of their own ids.
  const install = get.mockImplementation.bind(get);
  get.mockImplementation = (fn?: (id: string, ...rest: unknown[]) => unknown) =>
    install((id: string, ...rest: unknown[]) => (id === 'LoggerService' ? logger : fn?.(id, ...rest)));
  get.mockImplementation(() => undefined);

  return { __esModule: true, default: { get }, mockLogger: logger };
});

const mockGet = (server as unknown as { get: jest.Mock }).get;
const { mockLogger } = jest.requireMock('@/platform/server') as {
  mockLogger: { error: jest.Mock; warn: jest.Mock };
};

type MockReturnService = {
  listReturns: jest.Mock;
  getReturns: jest.Mock;
  getReturn: jest.Mock;
  createReturn: jest.Mock;
};
type MockOrderService = { getCustomerOrderById: jest.Mock };

let returnService: MockReturnService;
let orderService: MockOrderService;

const getReq = (query = '') => new NextRequest(`http://localhost/api/returns${query}`, { method: 'GET' });
const postReq = (body: unknown) =>
  new NextRequest('http://localhost/api/returns', { method: 'POST', body: JSON.stringify(body) });

const validItems = [{ id: 'item-1', quantity: 1 }];

beforeEach(() => {
  returnService = {
    listReturns: jest.fn(),
    getReturns: jest.fn(),
    getReturn: jest.fn(),
    createReturn: jest.fn(),
  };
  orderService = { getCustomerOrderById: jest.fn() };
  mockGet.mockImplementation((id: string) =>
    id === 'ReturnService' ? returnService : id === 'OrderService' ? orderService : undefined,
  );
  mockLogger.error.mockClear();
  mockLogger.warn.mockClear();
});

describe('GET /api/returns', () => {
  it('applies default pagination and omits x-total-count when the service does not report a total', async () => {
    const returns = [{ id: 'return-1' }] as unknown as Return[];
    returnService.listReturns.mockResolvedValue({ items: returns, totalCount: undefined });

    const res = await GET(getReq());

    expect(returnService.listReturns).toHaveBeenCalledWith(1, 60, undefined, undefined);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-total-count')).toBeNull();
    await expect(res.json()).resolves.toEqual(returns);
  });

  it('parses pageNumber, pageSize, sort and query from the query string and sets x-total-count', async () => {
    const returns = [{ id: 'return-1' }, { id: 'return-2' }] as unknown as Return[];
    returnService.listReturns.mockResolvedValue({ items: returns, totalCount: 5 });

    const res = await GET(getReq('?pageNumber=2&pageSize=10&sort=createdAt,desc&query=status:PENDING'));

    expect(returnService.listReturns).toHaveBeenCalledWith(2, 10, 'createdAt,desc', 'status:PENDING');
    expect(res.status).toBe(200);
    expect(res.headers.get('x-total-count')).toBe('5');
    await expect(res.json()).resolves.toEqual(returns);
  });

  it('returns 500 and logs the error message and stack when the service throws an Error', async () => {
    returnService.listReturns.mockRejectedValue(new Error('upstream down'));

    const res = await GET(getReq());

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Failed to fetch returns', code: 'RETURNS_FETCH_FAILED' });
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'upstream down',
        stack: expect.any(String),
        path: '/api/returns',
        method: 'GET',
      }),
      'Error fetching returns',
    );
  });

  it('returns 500 and logs a stringified message without a stack when a non-Error is thrown', async () => {
    returnService.listReturns.mockRejectedValue('kaboom');

    const res = await GET(getReq());

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Failed to fetch returns', code: 'RETURNS_FETCH_FAILED' });
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'kaboom', stack: undefined }),
      'Error fetching returns',
    );
  });
});

describe('POST /api/returns - request validation', () => {
  it('rejects a missing orderId before touching any service', async () => {
    const res = await POST(postReq({ items: validItems, reasonCode: 'DEFECTIVE' }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'orderId is required and must be a string',
      code: 'ORDER_ID_REQUIRED',
    });
    expect(orderService.getCustomerOrderById).not.toHaveBeenCalled();
    expect(returnService.createReturn).not.toHaveBeenCalled();
  });

  it('rejects a non-string orderId', async () => {
    const res = await POST(postReq({ orderId: 123, items: validItems, reasonCode: 'DEFECTIVE' }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'orderId is required and must be a string',
      code: 'ORDER_ID_REQUIRED',
    });
  });

  it('rejects an empty items array', async () => {
    const res = await POST(postReq({ orderId: 'order-1', items: [], reasonCode: 'DEFECTIVE' }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'items array is required and cannot be empty',
      code: 'ITEMS_REQUIRED',
    });
  });

  it('rejects a missing items array', async () => {
    const res = await POST(postReq({ orderId: 'order-1', reasonCode: 'DEFECTIVE' }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'items array is required and cannot be empty',
      code: 'ITEMS_REQUIRED',
    });
  });

  it('rejects a missing reasonCode', async () => {
    const res = await POST(postReq({ orderId: 'order-1', items: validItems }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'reasonCode is required and must be a string',
      code: 'REASON_CODE_REQUIRED',
    });
  });

  it('rejects an unknown reasonCode', async () => {
    const res = await POST(postReq({ orderId: 'order-1', items: validItems, reasonCode: 'NOT_A_REASON' }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'reasonCode is invalid', code: 'REASON_CODE_INVALID' });
  });

  it('rejects a non-string top-level reasonDetails', async () => {
    const res = await POST(
      postReq({ orderId: 'order-1', items: validItems, reasonCode: 'DEFECTIVE', reasonDetails: 42 }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'reasonDetails must be a string if provided',
      code: 'REASON_DETAILS_INVALID',
    });
  });

  it('rejects an item missing a valid id', async () => {
    const res = await POST(postReq({ orderId: 'order-1', items: [{ quantity: 1 }], reasonCode: 'DEFECTIVE' }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Each item must have a valid id', code: 'ITEM_ID_INVALID' });
  });

  it('rejects an item with a non-positive quantity', async () => {
    const res = await POST(
      postReq({ orderId: 'order-1', items: [{ id: 'item-1', quantity: 0 }], reasonCode: 'DEFECTIVE' }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'Each item must have a positive integer quantity',
      code: 'ITEM_QUANTITY_INVALID',
    });
  });

  it('rejects an item with a non-integer quantity', async () => {
    const res = await POST(
      postReq({ orderId: 'order-1', items: [{ id: 'item-1', quantity: 1.5 }], reasonCode: 'DEFECTIVE' }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'Each item must have a positive integer quantity',
      code: 'ITEM_QUANTITY_INVALID',
    });
  });

  it('rejects an item reasonCode with the wrong type', async () => {
    const res = await POST(
      postReq({
        orderId: 'order-1',
        items: [{ id: 'item-1', quantity: 1, reasonCode: 42 }],
        reasonCode: 'DEFECTIVE',
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'item.reasonCode must be a string if provided',
      code: 'ITEM_REASON_CODE_TYPE_INVALID',
    });
  });

  it('rejects an invalid item reasonCode and keeps the internal item id out of the response', async () => {
    const res = await POST(
      postReq({
        orderId: 'order-1',
        items: [{ id: 'item-42', quantity: 1, reasonCode: 'NOT_A_REASON' }],
        reasonCode: 'DEFECTIVE',
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'item.reasonCode is invalid for item item-42',
      code: 'ITEM_REASON_CODE_INVALID',
    });
  });

  it('rejects an item reasonDetails with the wrong type', async () => {
    const res = await POST(
      postReq({
        orderId: 'order-1',
        items: [{ id: 'item-1', quantity: 1, reasonDetails: 42 }],
        reasonCode: 'DEFECTIVE',
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'item.reasonDetails must be a string if provided',
      code: 'ITEM_REASON_DETAILS_INVALID',
    });
  });
});

describe('POST /api/returns - returnability and creation', () => {
  it('creates the return without a returnability check when the order cannot be found', async () => {
    orderService.getCustomerOrderById.mockResolvedValue(null);
    returnService.getReturns.mockResolvedValue([]);
    returnService.createReturn.mockResolvedValue('return-99');

    const res = await POST(
      postReq({
        orderId: 'order-1',
        items: [{ id: 'item-1', quantity: 2, reasonCode: 'defective', reasonDetails: ' cracked ' }],
        reasonCode: 'changed_mind',
      }),
    );

    expect(returnService.createReturn).toHaveBeenCalledWith(
      'order-1',
      [{ id: 'item-1', quantity: 2, reason: { code: 'DEFECTIVE', details: 'cracked' } }],
      'CHANGED_MIND',
      undefined,
    );
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ id: 'return-99' });
  });

  it('omits the per-item reason when no item-level reasonCode was supplied', async () => {
    orderService.getCustomerOrderById.mockResolvedValue(null);
    returnService.getReturns.mockResolvedValue([]);
    returnService.createReturn.mockResolvedValue('return-100');

    await POST(postReq({ orderId: 'order-1', items: [{ id: 'item-1', quantity: 1 }], reasonCode: 'OTHER' }));

    expect(returnService.createReturn).toHaveBeenCalledWith(
      'order-1',
      [{ id: 'item-1', quantity: 1, reason: undefined }],
      'OTHER',
      undefined,
    );
  });

  it('creates the return when the requested quantity fits within the remaining returnable quantity', async () => {
    const order = {
      id: 'order-1',
      status: 'DELIVERED',
      items: [{ id: 'item-1', productId: 'p1', quantity: 3 }],
    } as Order;
    orderService.getCustomerOrderById.mockResolvedValue(order);
    returnService.getReturns.mockResolvedValue([]);
    returnService.createReturn.mockResolvedValue('return-1');

    const res = await POST(
      postReq({ orderId: 'order-1', items: [{ id: 'item-1', quantity: 2 }], reasonCode: 'SIZE_FIT' }),
    );

    expect(returnService.getReturns).toHaveBeenCalledWith(undefined, undefined, undefined, 'orders._id:order-1');
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ id: 'return-1' });
  });

  it('returns 422 when a requested item does not belong to the order', async () => {
    const order = {
      id: 'order-1',
      status: 'DELIVERED',
      items: [{ id: 'item-other', productId: 'p1', quantity: 3 }],
    } as Order;
    orderService.getCustomerOrderById.mockResolvedValue(order);
    returnService.getReturns.mockResolvedValue([]);

    const res = await POST(
      postReq({ orderId: 'order-1', items: [{ id: 'item-1', quantity: 1 }], reasonCode: 'OTHER' }),
    );

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toEqual({
      error: 'Item item-1 does not belong to order order-1',
      code: 'ITEM_NOT_IN_ORDER',
    });
    expect(returnService.createReturn).not.toHaveBeenCalled();
  });

  it('returns 422 and logs a warning when the requested quantity exceeds the remaining returnable quantity', async () => {
    const order = {
      id: 'order-1',
      status: 'DELIVERED',
      items: [{ id: 'item-1', productId: 'p1', sku: 'ART-4711', quantity: 2 }],
    } as Order;
    orderService.getCustomerOrderById.mockResolvedValue(order);
    // A prior PENDING return already claimed 1 of the 2 ordered units, leaving 1 remaining.
    returnService.getReturns.mockResolvedValue([
      { status: 'PENDING', orders: [{ id: 'order-1', items: [{ id: 'item-1', quantity: 1 }] }] },
    ]);

    const res = await POST(
      postReq({ orderId: 'order-1', items: [{ id: 'item-1', quantity: 2 }], reasonCode: 'OTHER' }),
    );

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toEqual({
      error: 'Item item-1 exceeds returnable quantity (requested: 2, remaining: 1)',
      code: 'ITEM_EXCEEDS_RETURNABLE_QUANTITY',
      params: { sku: 'ART-4711', requested: 2, remaining: 1 },
    });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      { orderId: 'order-1', itemId: 'item-1', requested: 2, remaining: 1 },
      'Over-return attempt blocked',
    );
    expect(returnService.createReturn).not.toHaveBeenCalled();
  });

  it('maps a returnability lookup failure (plain Error) via mapReturnValidationError', async () => {
    orderService.getCustomerOrderById.mockRejectedValue(new Error('order lookup failed'));

    const res = await POST(postReq({ orderId: 'order-1', items: validItems, reasonCode: 'OTHER' }));

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      error: 'Failed to validate return request',
      code: 'VALIDATION_UNAVAILABLE',
      reason: 'validation_unavailable',
    });
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'order lookup failed',
        orderId: 'order-1',
        reason: 'validation_unavailable',
      }),
      'Returnability validation failed',
    );
    expect(returnService.createReturn).not.toHaveBeenCalled();
  });

  it('maps a returnability lookup failure (non-Error) via mapReturnValidationError', async () => {
    orderService.getCustomerOrderById.mockRejectedValue('offline');

    const res = await POST(postReq({ orderId: 'order-1', items: validItems, reasonCode: 'OTHER' }));

    expect(res.status).toBe(503);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'offline', orderId: 'order-1' }),
      'Returnability validation failed',
    );
  });

  it('maps a return-creation failure (plain Error) via mapReturnCreateError', async () => {
    orderService.getCustomerOrderById.mockResolvedValue(null);
    returnService.getReturns.mockResolvedValue([]);
    returnService.createReturn.mockRejectedValue(new Error('create failed'));

    const res = await POST(postReq({ orderId: 'order-1', items: validItems, reasonCode: 'OTHER' }));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: 'Failed to create return',
      code: 'UPSTREAM_UNAVAILABLE',
      reason: 'upstream_unavailable',
    });
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'create failed',
        path: '/api/returns',
        method: 'POST',
        reason: 'upstream_unavailable',
      }),
      'Error creating return',
    );
  });

  it('maps a return-creation failure (non-Error) via mapReturnCreateError', async () => {
    orderService.getCustomerOrderById.mockResolvedValue(null);
    returnService.getReturns.mockResolvedValue([]);
    returnService.createReturn.mockRejectedValue('service unavailable');

    const res = await POST(postReq({ orderId: 'order-1', items: validItems, reasonCode: 'OTHER' }));

    expect(res.status).toBe(500);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'service unavailable', stack: undefined }),
      'Error creating return',
    );
  });
});
