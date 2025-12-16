import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCartApi } from '@/platform/integrations/emporix/cart/EmporixCartApi';
import type { CartMigrationService } from '@/platform/services/cart/CartMigrationService';

/**
 * Implementation of CartService for Emporix cart data.
 * Maps between Emporix API cart format and internal Cart model.
 */
@injectable('CartMigrationService', 'Singleton')
class EmporixCartMigrationService implements CartMigrationService {
  constructor(@inject('EmporixCartApi') private cartApi: EmporixCartApi) {}

  async migrateCartToCustomer(cartId: string, customerId: string): Promise<void> {
    try {
      const cart = await this.cartApi.getCart(cartId);
      if (!cart) {
        // TODO what if someone came in with an outdated cart cookie?
        return;
      }
      // TODO handle a situation where the Customer already has a Cart (separate Ticket)
      await this.cartApi.updateCart(cartId, {
        customerId: customerId,
      });
    } catch (_error) {
      return;
    }
  }

  async mergeCarts(anonymousCartId: string, customerCartId: string): Promise<void> {
    await this.cartApi.mergeCarts(anonymousCartId, customerCartId);
  }
}

export default EmporixCartMigrationService;
