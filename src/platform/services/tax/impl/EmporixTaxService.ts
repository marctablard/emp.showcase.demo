import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixTaxApi } from '@/platform/integrations/emporix/tax/EmporixTaxApi';
import type { TaxClassRate, TaxService } from '../TaxService';

/**
 * Implementation of TaxService using Emporix Tax Service configuration.
 */
@injectable('TaxService', 'Singleton')
class EmporixTaxService implements TaxService {
  constructor(@inject('EmporixTaxApi') private readonly taxApi: EmporixTaxApi) {}

  async getTaxRate(countryCode: string, taxCode: string): Promise<number | undefined> {
    const configuration = await this.taxApi.getTaxConfiguration(countryCode);
    if (!configuration) {
      return undefined;
    }
    const taxClass = configuration.taxClasses?.find((item) => item.code === taxCode);
    return taxClass?.rate;
  }

  async getTaxClasses(countryCode: string): Promise<TaxClassRate[]> {
    if (!countryCode?.trim()) {
      return [];
    }

    const configuration = await this.taxApi.getTaxConfiguration(countryCode);
    if (!configuration?.taxClasses) {
      return [];
    }

    return configuration.taxClasses.map((taxClass) => ({
      code: taxClass.code,
      rate: taxClass.rate,
    }));
  }
}

export default EmporixTaxService;
