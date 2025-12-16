import { z } from 'zod';
import { injectable } from '@/platform/core/di/injectable';
import ZodSchemaValidationService from './ZodSchemaValidationService';

// AI Helper validation schema
export const AiHelperSchema = z.object({
  question: z.string().min(1, 'aiHelper.question.required'),
});

@injectable('AiHelperValidationService', 'Singleton')
class EmporixAiHelperValidationService extends ZodSchemaValidationService {
  constructor() {
    super(AiHelperSchema);
  }
}

export default EmporixAiHelperValidationService;
