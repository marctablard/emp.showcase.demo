import { z } from 'zod';
import { injectable } from '@/platform/core/di/injectable';
import ZodSchemaValidationService from './ZodSchemaValidationService';

// Ticket Search validation schema
export const TicketSearchSchema = z.object({
  searchQuery: z.string().optional(),
});

@injectable('TicketSearchValidationService', 'Singleton')
class EmporixTicketSearchValidationService extends ZodSchemaValidationService {
  constructor() {
    super(TicketSearchSchema);
  }
}

export default EmporixTicketSearchValidationService;
