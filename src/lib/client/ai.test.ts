/**
 * @jest-environment jsdom
 */
import type { Session } from '@/platform/services/model/session/session';
import type { CartStore } from '@/stores/cart-store';
import { prepareAIContext } from './ai';

jest.mock('./ai-helper-storage', () => ({
  isAIHelperStorageOwnerId: () => true,
  getOrCreateAISessionId: () => 'ai-session-1',
}));

describe('prepareAIContext', () => {
  it('sends the header locale instead of session.language or en_US', async () => {
    const session = {
      siteCode: 'main',
      currency: 'USD',
      language: 'en_US',
      customerId: 'cust-1',
    } as Session;
    const cartStore = {
      fetchCart: jest.fn().mockResolvedValue(undefined),
      getCurrentCart: () => ({ id: 'cart-1' }),
    } as unknown as CartStore;

    const context = await prepareAIContext(session, cartStore, 'de');

    expect(context).toEqual({
      siteId: 'main',
      currency: 'USD',
      language: 'de',
      sessionId: 'ai-session-1',
      cartId: 'cart-1',
    });
  });
});
