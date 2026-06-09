import { EmporixApprovalMapper } from './EmporixApprovalMapper';

describe('EmporixApprovalMapper', () => {
  it('maps approval resource itemId to productId when itemYrn is missing', () => {
    const mapper = new EmporixApprovalMapper({} as never, {} as never, {} as never);

    const approval = mapper.mapToService({
      id: 'approval-1',
      resourceType: 'QUOTE',
      action: 'CHECKOUT',
      status: 'PENDING',
      resource: {
        id: 'Q-1000',
        items: [
          {
            quantity: 2,
            itemId: 'product-1',
            itemPrice: {
              currency: 'USD',
              amount: 191.4,
            },
          },
        ],
      },
      requestor: {
        userId: 'requestor-1',
        firstName: 'Req',
        lastName: 'User',
        email: 'req@example.com',
      },
      approver: {
        userId: 'approver-1',
        firstName: 'App',
        lastName: 'User',
      },
      metadata: {
        version: 1,
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
    } as never);

    expect(approval.resource.items).toEqual([
      expect.objectContaining({
        itemId: 'product-1',
        productId: 'product-1',
      }),
    ]);
    expect(approval.modifiedAt).toBe('2026-06-01T00:00:00.000Z');
    expect(approval.updatedAt).toBe('2026-06-01T00:00:00.000Z');
  });

  it('maps approval modifiedAt and optional resource orderId', () => {
    const mapper = new EmporixApprovalMapper({} as never, {} as never, {} as never);

    const approval = mapper.mapToService({
      id: 'approval-2',
      resourceType: 'QUOTE',
      action: 'CHECKOUT',
      status: 'APPROVED',
      resource: {
        id: 'Q-2000',
        orderId: 'O-2000',
      },
      requestor: {
        userId: 'requestor-2',
        firstName: 'Req',
        lastName: 'User',
        email: 'req2@example.com',
      },
      approver: {
        userId: 'approver-2',
        firstName: 'App',
        lastName: 'User',
      },
      metadata: {
        version: 2,
        createdAt: '2026-06-01T00:00:00.000Z',
        modifiedAt: '2026-06-02T12:00:00.000Z',
      },
    } as never);

    expect(approval.modifiedAt).toBe('2026-06-02T12:00:00.000Z');
    expect(approval.updatedAt).toBe('2026-06-02T12:00:00.000Z');
    expect(approval.resource.orderId).toBe('O-2000');
  });

  it('preserves updatedAt when both updatedAt and modifiedAt are present', () => {
    const mapper = new EmporixApprovalMapper({} as never, {} as never, {} as never);

    const approval = mapper.mapToService({
      id: 'approval-3',
      resourceType: 'QUOTE',
      action: 'CHECKOUT',
      status: 'APPROVED',
      resource: {
        id: 'Q-3000',
      },
      requestor: {
        userId: 'requestor-3',
        firstName: 'Req',
        lastName: 'User',
        email: 'req3@example.com',
      },
      approver: {
        userId: 'approver-3',
        firstName: 'App',
        lastName: 'User',
      },
      metadata: {
        version: 3,
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-02T08:00:00.000Z',
        modifiedAt: '2026-06-03T12:00:00.000Z',
      },
    } as never);

    expect(approval.modifiedAt).toBe('2026-06-03T12:00:00.000Z');
    expect(approval.updatedAt).toBe('2026-06-02T08:00:00.000Z');
  });
});
