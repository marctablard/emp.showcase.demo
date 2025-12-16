import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import { EmporixSchema } from '@/platform/integrations/emporix/model/schema';
import type { EmporixSchemaApi } from '@/platform/integrations/emporix/schema/EmporixSchemaApi';
import { SchemaService } from '../SchemaService';

/**
 * Implementation of SchemaService that loads schema from Emporix
 */
@injectable('SchemaService', 'Singleton')
class EmporixSchemaService implements SchemaService {
  constructor(@inject('EmporixSchemaApi') private schemaApi: EmporixSchemaApi) {}

  async getSchema(schemaId: string): Promise<EmporixSchema> {
    const schema = await this.schemaApi.getSchema(schemaId);
    return schema;
  }
}

export default EmporixSchemaService;
