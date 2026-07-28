import { createOrderRequestKey } from './create-order-request-key';

describe('createOrderRequestKey', () => {
  it('creates stable keys including null placeholders for missing query/sort', () => {
    expect(createOrderRequestKey(5, 2)).toBe(JSON.stringify({ pageSize: 5, pageNumber: 2, sort: null, query: null }));
  });

  it('includes query and sort when provided', () => {
    expect(createOrderRequestKey(5, 2, 'customer.name:~(Ada)', 'created:DESC')).toBe(
      JSON.stringify({ pageSize: 5, pageNumber: 2, sort: 'created:DESC', query: 'customer.name:~(Ada)' }),
    );
  });
});
