import { Price } from '../common';

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

  tierValues: {
    id: string;
    minQuantity: number;
    unit?: string;
    price: number;
  }[];
}
