import { z } from 'zod';
import type { ValidationResult, ValidationService } from '@/platform/services/validation';

/**
 * Browser-safe Zod-backed validation (no DI). Mirrors platform ZodSchemaValidationService behavior.
 */
export class ClientZodSchemaValidationService implements ValidationService {
  constructor(private readonly schema: z.ZodTypeAny) {}

  validate<T>(data: T): ValidationResult<T> {
    try {
      const validatedData = this.schema.parse(data);
      return { success: true, data: validatedData as T };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          errors: error.errors.reduce(
            (acc, issue) => {
              acc[issue.path.join('.')] = issue.message;
              return acc;
            },
            {} as Record<string, string>,
          ),
        };
      }
      throw error;
    }
  }

  getSchema(): z.ZodTypeAny {
    return this.schema;
  }
}
