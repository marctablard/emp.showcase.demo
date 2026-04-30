import type { LocalizedString } from '../common/index.d';

export interface ShoppingListItem {
  id: string;
  productId: string;
  quantity: number;
  name?: LocalizedString | string;
  sku?: string;
  unitPrice?: number;
  currency?: string;
  imageUrl?: string;
}

export interface ShoppingList {
  id: string;
  name: string;
  items: ShoppingListItem[];
  projectId?: string;
  customerId?: string;
  createdAt?: string;
  modifiedAt?: string;
}
