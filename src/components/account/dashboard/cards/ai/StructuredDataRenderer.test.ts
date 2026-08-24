import { hasResolvedWidgetPayload } from './StructuredDataRenderer';

describe('hasResolvedWidgetPayload', () => {
  it('treats error message as resolved payload', () => {
    expect(hasResolvedWidgetPayload('error', { message: 'Something went wrong' })).toBe(true);
  });

  it('ignores intro message for non-error widgets', () => {
    expect(hasResolvedWidgetPayload('order_list', { message: 'Here are your orders' })).toBe(false);
    expect(hasResolvedWidgetPayload('order_list', { message: 'Here are your orders', orders: [] })).toBe(true);
  });
});
