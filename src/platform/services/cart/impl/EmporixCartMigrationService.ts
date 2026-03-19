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

  async mergeCarts(anonymousCartId: string, customerCartId: string): Promise<void> {
    await this.cartApi.mergeCarts(anonymousCartId, customerCartId);
  }
}

export default EmporixCartMigrationService;
