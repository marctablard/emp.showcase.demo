import { z } from 'zod';
import { injectable } from '@/platform/core/di/injectable';
import ZodSchemaValidationService from './ZodSchemaValidationService';

// Order Search validation schema
export const OrderSearchSchema = z.object({
  searchQuery: z.string().optional(),
});

@injectable('OrderSearchValidationService', 'Singleton')
class EmporixOrderSearchValidationService extends ZodSchemaValidationService {
  constructor() {
    super(OrderSearchSchema);
  }
}

export default EmporixOrderSearchValidationService;
