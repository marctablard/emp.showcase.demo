import { EmporixSchema } from '@/platform/integrations/emporix/model/schema';

export interface SchemaService {
  /**
   * Get schema by ID
   * @param schemaId Schema ID
   * @returns Promise with the schema details
   */
  getSchema(schemaId: string): Promise<EmporixSchema>;
}
