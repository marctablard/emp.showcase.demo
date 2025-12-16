import { z } from 'zod';
import { injectable } from '@/platform/core/di/injectable';
import ZodSchemaValidationService from './ZodSchemaValidationService';

// Cart Delivery validation schema
export const CartDeliverySchema = z.object({
  deliveryMethod: z.enum(['delivery', 'pickup']),
});

// Export type for the cart delivery data
export type CartDeliveryData = z.infer<typeof CartDeliverySchema>;

@injectable('CartDeliveryValidationService', 'Singleton')
class EmporixCartDeliveryValidationService extends ZodSchemaValidationService {
  constructor() {
    super(CartDeliverySchema);
  }
}

export default EmporixCartDeliveryValidationService;
