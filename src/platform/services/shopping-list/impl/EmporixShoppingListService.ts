import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixShoppingListApi } from '@/platform/integrations/emporix/shopping-list/EmporixShoppingListApi';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { ShoppingList, ShoppingListItem } from '../../model/shopping-list/shopping-list';
import type { ShoppingListService as IShoppingListService } from '../ShoppingListService';

const PROJECT_MIXIN_KEY = 'project';

@injectable('ShoppingListService', 'Singleton')
export class EmporixShoppingListService implements IShoppingListService {
  constructor(
    @inject('EmporixShoppingListApi') private shoppingListApi: EmporixShoppingListApi,
    @inject('LoggerService') private logger: LoggerService,
  ) {}

  async getShoppingLists(projectId?: string): Promise<ShoppingList[]> {
    try {
      // q-filter is a best-effort hint to Emporix; client-side filter is the reliable guard
      const { items } = await this.shoppingListApi.getLists(100, 1, projectId);
      const lists = items.map((e) => this.mapToShoppingList(e));
      if (projectId) {
        return lists.filter((l) => l.projectId === projectId);
      }
      return lists;
    } catch (error) {
      this.logger.error({ error }, 'Failed to get shopping lists');
      throw new Error(`Failed to get shopping lists: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getShoppingList(listId: string): Promise<ShoppingList | null> {
    try {
      const entity = await this.shoppingListApi.getList(listId);
      if (!entity) return null;
      return this.mapToShoppingList(entity);
    } catch (error) {
      this.logger.error({ error, listId }, 'Failed to get shopping list');
      throw new Error(`Failed to get shopping list: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async createShoppingList(name: string, projectId?: string): Promise<ShoppingList> {
    try {
      const entity = await this.shoppingListApi.createList(name, projectId);
      return this.mapToShoppingList(entity);
    } catch (error) {
      this.logger.error({ error }, 'Failed to create shopping list');
      throw new Error(`Failed to create shopping list: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async deleteShoppingList(listId: string): Promise<void> {
    try {
      await this.shoppingListApi.deleteList(listId);
    } catch (error) {
      this.logger.error({ error, listId }, 'Failed to delete shopping list');
      throw new Error(`Failed to delete shopping list: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async addItem(listId: string, productId: string, quantity: number): Promise<ShoppingListItem> {
    try {
      const item = await this.shoppingListApi.addItem(listId, productId, quantity);
      return {
        id: String(item.id ?? ''),
        productId: item.product?.id ?? productId,
        quantity: item.quantity ?? quantity,
      };
    } catch (error) {
      this.logger.error({ error, listId, productId }, 'Failed to add item to shopping list');
      throw new Error(`Failed to add item: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async removeItem(listId: string, itemId: string): Promise<void> {
    try {
      await this.shoppingListApi.removeItem(listId, itemId);
    } catch (error) {
      this.logger.error({ error, listId, itemId }, 'Failed to remove item from shopping list');
      throw new Error(`Failed to remove item: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private mapToShoppingList(entity: any): ShoppingList {
    return {
      id: entity.id ?? '',
      name: entity.name ?? entity.id ?? '',
      items: (entity.items ?? []).map((item: any) => ({
        id: String(item.id ?? ''),
        productId: item.productId ?? item.product?.id ?? item.itemYrn ?? '',
        quantity: item.quantity ?? 1,
        sku: item.productId ?? item.product?.sku,
        unitPrice: item.price?.value,
        currency: item.price?.currency,
      })),
      projectId: entity.mixins?.[PROJECT_MIXIN_KEY]?.projectid,
      customerId: entity.customerId,
      createdAt: entity.metadata?.createdAt,
      modifiedAt: entity.metadata?.modifiedAt,
    };
  }
}

export default EmporixShoppingListService;
