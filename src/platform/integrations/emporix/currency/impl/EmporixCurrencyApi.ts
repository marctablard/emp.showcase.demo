import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import { createFetchMetricsParams } from '@/platform/integrations/emporix/metrics-utils';
import { DEFAULT_CACHE_REVALIDATE } from '../../common/cache-defaults';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../../config';
import type { EmporixCurrency, EmporixExchangeRate } from '../../model/currency';
import type { EmporixCurrencyApi as IEmporixCurrencyApi } from '../EmporixCurrencyApi';

const createCurrencyMetrics = (route: string) => createFetchMetricsParams('currency', route);

@injectable('EmporixCurrencyApi', 'Singleton')
class EmporixCurrencyApi implements IEmporixCurrencyApi {
  constructor(
    @inject('EmporixApiInvoker') protected apiClient: EmporixApiClient,
    @inject('EmporixConfig') protected config: EmporixConfig,
  ) {
    this.apiClient = apiClient;
    this.config = config;
  }

  async getCurrencies(): Promise<EmporixCurrency[]> {
    const response = await this.apiClient.authenticatedFetch(
      `/currency/${this.config.tenant}/currencies`,
      { method: 'GET' },
      'public',
      undefined,
      createCurrencyMetrics('/currency/{tenant}/currencies'),
      DEFAULT_CACHE_REVALIDATE,
    );

    if (!response.ok) {
      throw new Error(`Failed to get currencies: ${response.statusText}`);
    }

    return await response.json();
  }

  async getCurrency(currencyCode: string): Promise<EmporixCurrency | null> {
    const response = await this.apiClient.authenticatedFetch(
      `/currency/${this.config.tenant}/currencies/${currencyCode}`,
      { method: 'GET' },
      'public',
      undefined,
      createCurrencyMetrics('/currency/{tenant}/currencies/{id}'),
      DEFAULT_CACHE_REVALIDATE,
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      } else {
        throw new Error(`Failed to get currency: ${response.statusText}`);
      }
    }

    return await response.json();
  }

  async getExchangeRates(): Promise<EmporixExchangeRate[]> {
    const response = await this.apiClient.authenticatedFetch(
      `/currency/${this.config.tenant}/exchanges`,
      { method: 'GET' },
      'public',
      undefined,
      createCurrencyMetrics('/currency/{tenant}/exchanges'),
      DEFAULT_CACHE_REVALIDATE,
    );

    if (!response.ok) {
      throw new Error(`Failed to get exchange rates: ${response.statusText}`);
    }

    return await response.json();
  }

  async getExchangeRate(sourceCurrency: string, targetCurrency: string): Promise<EmporixExchangeRate | null> {
    const response = await this.apiClient.authenticatedFetch(
      `/currency/${this.config.tenant}/exchanges?sourceCurrency=${sourceCurrency}&targetCurrency=${targetCurrency}`,
      { method: 'GET' },
      'public',
      undefined,
      createCurrencyMetrics('/currency/{tenant}/exchanges'),
      DEFAULT_CACHE_REVALIDATE,
    );

    if (!response.ok) {
      throw new Error(`Failed to get exchange rate: ${response.statusText}`);
    }

    const rates = await response.json();

    // Find the specific exchange rate
    const rate = Array.isArray(rates)
      ? rates.find((r) => r.sourceCurrency === sourceCurrency && r.targetCurrency === targetCurrency)
      : null;

    return rate || null;
  }
}

export default EmporixCurrencyApi;
