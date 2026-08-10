import { Price } from '../common';

/** Emporix `priceModel.tierDefinition.tierType` values. */
export type PriceModelType = 'BASIC' | 'TIERED' | 'VOLUME';

export interface ProductPrice extends Price {
  id: string;
  productId: string;
  discountValue: number;
  discountPercentage: number;
  totalValue: number;
  quantity: {
    quantity: number;
    unitCode?: string;
  };
  includesTax: boolean;
  /**
   * Pricing strategy from the matched price model.
   * Mapped from Emporix `priceModel.tierDefinition.tierType`.
   */
  priceModelType?: PriceModelType;

  tierValues: {
    id: string;
    minQuantity: number;
    unit?: string;
    price: number;
  }[];
}
