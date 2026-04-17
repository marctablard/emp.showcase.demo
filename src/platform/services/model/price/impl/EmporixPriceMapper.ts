import { injectable } from '@/platform/core/di/injectable';
import type { EmporixMatchedPrice, EmporixQuantity } from '@/platform/integrations/emporix/model/price';
import type { PriceMapper } from '../PriceMapper';
import type { ProductPrice } from '../price';

/**
 * Maps between Emporix Price model and Service Price model
 */
@injectable('EmporixPriceMapper', 'Singleton')
export class EmporixPriceMapper implements PriceMapper {
  mapToService(source: EmporixMatchedPrice): ProductPrice {
    const tierDefinitions: Record<string, { id: string; minQuantity: EmporixQuantity }> = {};
    source.priceModel.tierDefinition.tiers.forEach((tierDef) => {
      tierDefinitions[tierDef.id] = { id: tierDef.id, minQuantity: tierDef.minQuantity };
    });
    const discountValue = source.originalValue - source.effectiveValue;
    const discountPercentage = (discountValue / source.originalValue) * 100;
    return {
      id: source.priceId,
      productId: source.itemId.id,
      currency: source.currency,
      originalAmount: source.originalValue,
      amount: source.effectiveValue,
      discountValue,
      discountPercentage,
      totalValue: source.totalValue,
      quantity: {
        quantity: source.quantity.quantity,
        unitCode: source.quantity.unitCode,
      },
      includesTax: source.includesTax,
      tax: source.tax
        ? {
            taxCode: source.tax.taxClass,
            taxRate: source.tax.taxRate,
            netValue: source.tax.prices.effectiveValue.netValue,
            grossValue: source.tax.prices.effectiveValue.grossValue,
            amount: source.tax.prices.effectiveValue.taxValue,
            currency: source.currency,
          }
        : undefined,
      tierValues: source.tierValues.map((tier) => ({
        id: tier.id,
        minQuantity: tierDefinitions[tier.id].minQuantity.quantity,
        unit: tierDefinitions[tier.id].minQuantity.unitCode,
        price: tier.priceValue,
      })),
    };
  }

  mapToSource(_service: ProductPrice): EmporixMatchedPrice {
    throw new Error('Not implemented');
  }
}

export default EmporixPriceMapper;
