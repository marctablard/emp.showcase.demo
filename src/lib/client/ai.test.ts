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

const session = {
  siteCode: 'main',
  currency: 'USD',
  language: 'en_US',
  customerId: 'cust-1',
} as Session;

describe('prepareAIContext', () => {
  it('sends the header locale instead of session.language or en_US', async () => {
    const fetchCart = jest.fn().mockResolvedValue(undefined);
    const cartStore = {
      fetchCart,
      getCurrentCart: () => ({ id: 'cart-1' }),
    } as unknown as CartStore;

    const context = await prepareAIContext(session, cartStore, 'de');

    expect(fetchCart).not.toHaveBeenCalled();
    expect(context).toEqual({
      siteId: 'main',
      currency: 'USD',
      language: 'de',
      sessionId: 'ai-session-1',
      cartId: 'cart-1',
    });
  });

  it('fetches the cart only when store state is still unknown', async () => {
    const fetchCart = jest.fn().mockResolvedValue(undefined);
    let currentCart: { id: string } | null | undefined = undefined;
    const cartStore = {
      fetchCart: fetchCart.mockImplementation(async () => {
        currentCart = { id: 'cart-2' };
      }),
      getCurrentCart: () => currentCart,
    } as unknown as CartStore;

    const context = await prepareAIContext(session, cartStore, 'en');

    expect(fetchCart).toHaveBeenCalledTimes(1);
    expect(context.cartId).toBe('cart-2');
  });

  it('does not fetch when the store already knows there is no cart', async () => {
    const fetchCart = jest.fn().mockResolvedValue(undefined);
    const cartStore = {
      fetchCart,
      getCurrentCart: () => null,
    } as unknown as CartStore;

    const context = await prepareAIContext(session, cartStore, 'en');

    expect(fetchCart).not.toHaveBeenCalled();
    expect(context.cartId).toBeUndefined();
  });
});
