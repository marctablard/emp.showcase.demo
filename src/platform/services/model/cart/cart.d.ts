import { Price, Tax } from '../common';
import { Product } from '../product';

export interface CartAppliedDiscount {
  code: string;
  name?: string;
  discountIndex: number;
  amount: number;
  currency: string;
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
  goodsDiscountedNet?: number;
  goodsDiscountedVat?: number;
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
