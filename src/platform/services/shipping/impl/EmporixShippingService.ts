import { inject } from 'inversify';
import { getApplicableShippingFee } from '@/lib/common/get-applicable-shipping-fee';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixMonetaryAmount } from '@/platform/integrations/emporix/model/common';
import type { EmporixShippingApi } from '@/platform/integrations/emporix/shipping/EmporixShippingApi';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { SessionService } from '@/platform/services/session/SessionService';
import type { DeliveryWindow, ShippingMethod } from '../../model/shipping';
import type { ShippingMapper } from '../../model/shipping/ShippingMapper';
import type { ShippingService } from '../ShippingService';

function resolveLocalizedShippingName(value: string | Record<string, string> | undefined): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }
  if (value && typeof value === 'object') {
    const preferred = value.en || value.de || Object.values(value).find((entry) => typeof entry === 'string');
    return typeof preferred === 'string' && preferred.trim() !== '' ? preferred.trim() : undefined;
  }
  return undefined;
}

/**
 * Implementation of ShippingService for Emporix shipping data
 */
@injectable('ShippingService', 'Singleton')
class EmporixShippingService implements ShippingService {
  private shippingApi: EmporixShippingApi;
  private shippingMapper: ShippingMapper;
  private sessionService: SessionService;
  private logger: LoggerService;

  constructor(
    @inject('EmporixShippingApi') shippingApi: EmporixShippingApi,
    @inject('EmporixShippingMapper') shippingMapper: ShippingMapper,
    @inject('SessionService') sessionService: SessionService,
    @inject('LoggerService') logger: LoggerService,
  ) {
    this.shippingApi = shippingApi;
    this.shippingMapper = shippingMapper;
    this.sessionService = sessionService;
    this.logger = logger;
  }

  async getShippingMethods(
    country: string,
    postalCode: string,
    orderValue?: { amount: number; currency: string },
  ): Promise<ShippingMethod[]> {
    const session = await this.sessionService.getCurrent();
    if (!session) {
      throw new Error('No session found');
    }
    const siteCode = session.siteCode || process.env.NEXT_PUBLIC_DEFAULT_SITE;
    try {
      if (!siteCode) {
        return [];
      }
      // Find site based on location
      const sites = await this.shippingApi.findSite({
        country,
        postalCode,
      });

      if (!sites || sites.length === 0) {
        return [];
      }

      // Get the first site
      const site = sites.find((site) => site.id === siteCode);
      const methods: ShippingMethod[] = [];

      if (!site) {
        return [];
      }
      // Collect all shipping methods from all zones
      // Only include methods that have a valid fee for the cart currency
      for (const zone of site.zones) {
        if (zone.methods && zone.methods.length > 0) {
          for (const method of zone.methods) {
            if (method.active !== true) {
              continue;
            }
            let cost: EmporixMonetaryAmount | undefined = undefined;
            if (orderValue) {
              const fee = getApplicableShippingFee(
                method.fees.filter(
                  (candidate) =>
                    candidate.minOrderValue.currency == orderValue.currency &&
                    candidate.cost.currency == orderValue.currency,
                ),
                orderValue.amount,
              );
              if (fee) {
                cost = fee.cost;
              }
            }
            // Only include methods with a valid cost for the cart currency
            // Methods without matching fees are excluded to prevent checkout failures
            if (cost !== undefined) {
              methods.push(this.shippingMapper.mapToService(method, zone.id, cost));
            }
          }
        }
      }
      return methods;
    } catch (error) {
      this.logger.error({ err: error }, 'Error getting shipping methods');
      return [];
    }
  }

  async getShippingMethod(methodId: string, zoneId: string): Promise<ShippingMethod | null> {
    const session = await this.sessionService.getCurrent();
    if (!session) {
      throw new Error('No session found');
    }
    const siteCode = session.siteCode || process.env.NEXT_PUBLIC_DEFAULT_SITE;
    try {
      if (!siteCode) {
        return null;
      }
      const emporixMethod = await this.shippingApi.getShippingMethod(siteCode, zoneId, methodId);

      if (!emporixMethod) {
        return null;
      }

      return this.shippingMapper.mapToService(emporixMethod, zoneId);
    } catch (error) {
      this.logger.error({ err: error }, 'Error getting shipping method');
      return null;
    }
  }

  async getDeliveryWindowsForCart(cartId: string, postalCode?: string): Promise<DeliveryWindow[]> {
    try {
      const windows = await this.shippingApi.getDeliveryWindowsByCart(cartId, postalCode);
      return windows.flatMap((window) => {
        const id = window.id?.trim();
        const deliveryDate = window.deliveryDate?.trim();
        if (!id || !deliveryDate) {
          return [];
        }
        return [
          {
            id,
            slotId: window.slotId,
            deliveryDate,
            zoneId: window.zoneId,
            deliveryMethod: resolveLocalizedShippingName(
              window.deliveryMethod ?? window.shippingMethod ?? window.methodId,
            ),
          },
        ];
      });
    } catch (error) {
      this.logger.error({ err: error, cartId }, 'Error getting delivery windows for cart');
      return [];
    }
  }
}

export default EmporixShippingService;
