import { hasResolvedWidgetPayload } from '@/lib/common/ai-tool-widgets';

describe('hasResolvedWidgetPayload', () => {
  it('treats error message as resolved payload', () => {
    expect(hasResolvedWidgetPayload('error', { message: 'Something went wrong' })).toBe(true);
  });

  it('ignores intro message for non-error widgets', () => {
    expect(hasResolvedWidgetPayload('order_list', { message: 'Here are your orders' })).toBe(false);
    expect(hasResolvedWidgetPayload('order_list', { message: 'Here are your orders', orders: [] })).toBe(true);
  });

  it('treats empty nested objects as unresolved payload', () => {
    expect(hasResolvedWidgetPayload('account_details', { personalInfo: {} })).toBe(false);
  });
});
