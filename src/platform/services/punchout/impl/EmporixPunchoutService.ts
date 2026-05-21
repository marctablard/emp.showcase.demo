import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCustomEntity } from '@/platform/integrations/emporix/model/schema';
import type { EmporixSchemaApi } from '@/platform/integrations/emporix/schema/EmporixSchemaApi';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { PunchoutFormData, PunchoutSession } from '@/platform/services/model/punchout/punchout';
import type { PunchoutService } from '../PunchoutService';

interface PunchoutSessionsDetailsMixin {
  status?: string;
  token?: string;
  punchoutformdata?: PunchoutFormData;
}

@injectable('PunchoutService', 'Singleton')
class EmporixPunchoutService implements PunchoutService {
  private readonly PUNCHOUT_SESSION_TYPE = 'PUNCHOUT_SESSIONS';

  constructor(
    @inject('EmporixSchemaApi') private schemaApi: EmporixSchemaApi,
    @inject('LoggerService') private logger: LoggerService,
  ) {}

  async getPunchoutSession(sessionId?: string): Promise<PunchoutSession | null> {
    const id = sessionId?.trim() || process.env.NEXT_PUNCHOUT_SESSION_ID?.trim();
    if (!id) {
      this.logger.warn('Punchout session id is not configured (NEXT_PUNCHOUT_SESSION_ID)');
      return null;
    }

    const entity = await this.schemaApi.getCustomEntity(this.PUNCHOUT_SESSION_TYPE, id);
    if (!entity) {
      this.logger.warn({ sessionId: id }, 'Punchout session not found');
      return null;
    }

    return this.mapToService(entity);
  }

  private mapToService(entity: EmporixCustomEntity): PunchoutSession | null {
    const details = entity.mixins?.punchout_sessions_details as PunchoutSessionsDetailsMixin | undefined;
    const formData = details?.punchoutformdata;
    if (!formData?.formposturl || !formData.buyercookie) {
      this.logger.warn({ sessionId: entity.id }, 'Punchout session is missing required form data');
      return null;
    }

    const name = typeof entity.name === 'string' ? entity.name : entity.name?.en || Object.values(entity.name || {})[0];

    return {
      id: entity.id || '',
      name,
      status: details?.status,
      token: details?.token,
      formData,
    };
  }
}

export default EmporixPunchoutService;
