export interface EmporixShoppingListItem {
  id?: string | number;
  productId?: string;
  itemYrn?: string;
  product?: {
    id: string;
    yrn?: string;
    sku?: string;
  };
  quantity?: number;
  price?: {
    value?: number;
    currency?: string;
  };
  mixins?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface EmporixShoppingList {
  id?: string;
  name?: string;
  items?: EmporixShoppingListItem[];
  mixins?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface EmporixShoppingListApi {
  getLists(
    pageSize?: number,
    pageNumber?: number,
    projectId?: string,
  ): Promise<{ items: EmporixShoppingList[]; total: number }>;
  getList(listId: string): Promise<EmporixShoppingList | null>;
  createList(name: string, projectId?: string): Promise<EmporixShoppingList>;
  deleteList(listId: string): Promise<void>;
  addItem(listId: string, productId: string, quantity: number): Promise<EmporixShoppingListItem>;
  removeItem(listId: string, itemId: string): Promise<void>;
  setProjectMixin(listId: string, projectId: string): Promise<void>;
}
