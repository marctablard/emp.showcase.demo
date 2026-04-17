import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixPaymentGatewayApi } from '@/platform/integrations/emporix/payment/EmporixPaymentGatewayApi';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { PaymentMode } from '@/platform/services/model/payment';
import type { PaymentService } from '../PaymentService';

/**
 * Implementation of PaymentService for Emporix payment gateway
 */
@injectable('PaymentService', 'Singleton')
class EmporixPaymentService implements PaymentService {
  private paymentGatewayApi: EmporixPaymentGatewayApi;
  private logger: LoggerService;

  constructor(
    @inject('EmporixPaymentGatewayApi') paymentGatewayApi: EmporixPaymentGatewayApi,
    @inject('LoggerService') logger: LoggerService,
  ) {
    this.paymentGatewayApi = paymentGatewayApi;
    this.logger = logger;
  }

  /**
   * Get all payment modes configured for the tenant
   * @returns Promise with array of payment modes
   */
  async getPaymentModes(): Promise<PaymentMode[]> {
    try {
      const paymentModes = await this.paymentGatewayApi.getPaymentModesFrontend();
      return paymentModes;
    } catch (error) {
      this.logger.error({ err: error instanceof Error ? error : String(error) }, 'Error getting payment modes');
      return [];
    }
  }

  /**
   * Get a specific payment mode by ID
   * @param id Payment mode ID
   * @returns Promise with payment mode or null if not found
   */
  async getPaymentMode(id: string): Promise<PaymentMode | null> {
    try {
      const paymentMode = await this.paymentGatewayApi.getPaymentMode(id);
      return paymentMode;
    } catch (error) {
      this.logger.error(
        {
          err: error instanceof Error ? error : String(error),
          paymentModeId: id,
        },
        'Error getting payment mode',
      );
      return null;
    }
  }
}

export default EmporixPaymentService;
