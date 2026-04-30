import type { ShoppingList, ShoppingListItem } from '../model/shopping-list/shopping-list';

export interface ShoppingListService {
  /**
   * Get all shopping lists for the current customer, optionally filtered by project
   */
  getShoppingLists(projectId?: string): Promise<ShoppingList[]>;

  /**
   * Get a single shopping list by ID
   */
  getShoppingList(listId: string): Promise<ShoppingList | null>;

  /**
   * Create a new shopping list, optionally linked to a project
   */
  createShoppingList(name: string, projectId?: string): Promise<ShoppingList>;

  /**
   * Delete a shopping list
   */
  deleteShoppingList(listId: string): Promise<void>;

  /**
   * Add a product item to a shopping list
   */
  addItem(listId: string, productId: string, quantity: number): Promise<ShoppingListItem>;

  /**
   * Remove an item from a shopping list
   */
  removeItem(listId: string, itemId: string): Promise<void>;
}
