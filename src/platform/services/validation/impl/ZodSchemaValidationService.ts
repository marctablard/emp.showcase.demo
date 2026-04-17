import { z } from 'zod';
import type { ValidationResult } from '..';
import type { ValidationService } from '../ValidationService';

class ZodSchemaValidationService implements ValidationService {
  private schema: z.ZodTypeAny;

  constructor(schema: z.ZodTypeAny) {
    this.schema = schema;
  }

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

export default ZodSchemaValidationService;
