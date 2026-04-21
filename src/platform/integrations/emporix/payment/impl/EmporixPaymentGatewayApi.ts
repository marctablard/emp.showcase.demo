import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import { createFetchMetricsParams } from '@/platform/integrations/emporix/metrics-utils';
import { DEFAULT_CACHE_REVALIDATE } from '../../common/cache-defaults';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../../config';
import type { EmporixPaymentMode, EmporixPaymentModeFrontend } from '../../model/payment';
import type { EmporixPaymentGatewayApi as IEmporixPaymentGatewayApi } from '../EmporixPaymentGatewayApi';

const createPaymentMetrics = (route: string) => createFetchMetricsParams('payment', route);

@injectable('EmporixPaymentGatewayApi', 'Singleton')
class EmporixPaymentGatewayApi implements IEmporixPaymentGatewayApi {
  constructor(
    @inject('EmporixApiInvoker') protected apiClient: EmporixApiClient,
    @inject('EmporixConfig') protected config: EmporixConfig,
  ) {}

  async getPaymentModesFrontend(): Promise<EmporixPaymentModeFrontend[]> {
    const response = await this.apiClient.authenticatedFetch(
      `/payment-gateway/${this.config.tenant}/paymentmodes/frontend`,
      { method: 'GET' },
      'public',
      undefined,
      createPaymentMetrics('/payment-gateway/{tenant}/paymentmodes/frontend'),
      DEFAULT_CACHE_REVALIDATE,
    );

    if (!response.ok) {
      throw new Error(`Failed to get payment modes: ${response.statusText}`);
    }

    return await response.json();
  }

  async getPaymentMode(id: string): Promise<EmporixPaymentMode | null> {
    const response = await this.apiClient.authenticatedFetch(
      `/payment-gateway/${this.config.tenant}/paymentmodes/config/${id}`,
      { method: 'GET' },
      'service',
      undefined,
      createPaymentMetrics('/payment-gateway/{tenant}/paymentmodes/config/{id}'),
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      } else {
        throw new Error(`Failed to get payment mode: ${response.statusText}`);
      }
    }

    return await response.json();
  }
}

export default EmporixPaymentGatewayApi;
