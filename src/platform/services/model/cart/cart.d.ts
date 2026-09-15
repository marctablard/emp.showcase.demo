import { Price, Tax } from '../common';
import { Product } from '../product';

export type TotalDiscountCalculationType = 'ApplyDiscountBeforeTax' | 'ApplyDiscountAfterTax';

export type CartAppliedDiscountType = 'PERCENT' | 'ABSOLUTE' | 'FREE_SHIPPING';

export interface CartAppliedDiscount {
  code: string;
  name?: string;
  discountIndex: number;
  amount: number;
  currency: string;
  /** Coupon type from the calculated price; `FREE_SHIPPING` chips carry no goods amount. */
  type?: CartAppliedDiscountType;
}

export interface Cart {
  id: string;
  currency: string;
  site: string;
  legalEntity?: string;
  channel?: string;
  customerId?: string;
  sessionId?: string;
  items: CartItem[];
  shippingCosts?: Price;
  fees?: Price;
  totalPrice: Price;
  subTotalPrice: Price;
  tax: Tax;
  discounts?: CartAppliedDiscount[];
  savingsTotal?: number;
  totalDiscountCalculationType?: TotalDiscountCalculationType;
  includesTax?: boolean;
  goodsDiscountedNet?: number;
  goodsDiscountedVat?: number;
  goodsDiscountedGross?: number;
  /**
   * An applied coupon waives shipping (`FREE_SHIPPING` applied discount, or
   * `totalShipping` zeroed against a non-zero pre-discount `shipping`). `shippingCosts`
   * is then the discounted (zero) shipping — see COP-5589 QA follow-up.
   */
  freeShipping?: boolean;
}

export interface CartItem {
  id: string;
  quantity: number;
  price: Price;
  product?: Partial<Product>;
  tax?: Tax;
}

export interface CartItemPriceChange {
  itemId: string;
  productId: string;
  oldPrice: number;
  newPrice: number;
  updatedAt: Date;
}

export interface CartItemSubstitution {
  productId: string;
  substitutions: { productId: string; name: string; availableQuantity: number }[];
}
