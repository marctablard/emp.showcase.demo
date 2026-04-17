import { injectable } from '@/platform/core/di/injectable';
import type { EmporixMonetaryAmount } from '@/platform/integrations/emporix/model/common';
import type { EmporixShippingMethod } from '@/platform/integrations/emporix/model/shipping';
import type { ShippingMethod } from '..';
import type { ShippingMapper } from '../ShippingMapper';

/**
 * Implementation of ShippingMapper for Emporix shipping data
 */
@injectable('EmporixShippingMapper', 'Singleton')
class EmporixShippingMapper implements ShippingMapper {
  /**
   * Map from Emporix shipping method to service shipping method
   * @param emporixMethod The Emporix shipping method
   * @param zoneId The zone ID
   */
  mapToService(emporixMethod: EmporixShippingMethod, zoneId: string, cost?: EmporixMonetaryAmount): ShippingMethod {
    return {
      id: emporixMethod.id,
      name: emporixMethod.name.en || Object.values(emporixMethod.name)[0] || emporixMethod.id,
      description: '',
      cost: cost,
      zoneId: zoneId,
      taxCode: emporixMethod.shippingTaxCode,
    };
  }

  /**
   * Map from service shipping method to Emporix shipping method
   * @param serviceMethod The service shipping method
   */
  mapToEmporix(_serviceMethod: ShippingMethod): EmporixShippingMethod {
    throw new Error('Not implemented');
  }
}

export default EmporixShippingMapper;
