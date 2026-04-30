import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../../config';
import type {
  EmporixShoppingList,
  EmporixShoppingListItem,
  EmporixShoppingListApi as IEmporixShoppingListApi,
} from '../EmporixShoppingListApi';

const PROJECT_MIXIN_KEY = 'project';
const PROJECT_MIXIN_SCHEMA = 'https://res.cloudinary.com/saas-ag/raw/upload/schemata2/showcasedemo/project_v1.json';

@injectable('EmporixShoppingListApi', 'Singleton')
class EmporixShoppingListApi implements IEmporixShoppingListApi {
  constructor(
    @inject('EmporixApiInvoker') private apiClient: EmporixApiClient,
    @inject('EmporixConfig') private config: EmporixConfig,
  ) {}

  private baseUrl(): string {
    return `shoppinglist/${this.config.tenant}/shopping-lists`;
  }

  async getLists(
    pageSize = 100,
    pageNumber = 1,
    projectId?: string,
  ): Promise<{ items: EmporixShoppingList[]; total: number }> {
    let url = `${this.baseUrl()}?pageSize=${pageSize}&pageNumber=${pageNumber}`;
    if (projectId) {
      url += `&q=${encodeURIComponent(`mixins.project.projectid:${projectId}`)}`;
    }
    const response = await this.apiClient.authenticatedFetch(url, { method: 'GET', cache: 'no-store' }, 'session', {
      scopes: ['shoppinglist.shoppinglist_manage'],
    });

    if (!response.ok) {
      if (response.status === 404) return { items: [], total: 0 };
      const errorDetails = await response.text();
      throw new Error(`Failed to get shopping lists: ${response.statusText} ${errorDetails}`);
    }

    const data = await response.json();
    const raw: any[] = Array.isArray(data) ? data : (data.items ?? []);

    // The Emporix Shopping List API returns one customer object where each shopping
    // list is stored as a named key:
    //   [{ customerId: "C-xxx", "List A": { items, mixins, ... }, "List B": { ... } }]
    // We need to unpack all list keys from each customer object.
    const RESERVED = new Set(['customerId', 'metadata', 'id']);
    const items: EmporixShoppingList[] = [];

    for (const entry of raw) {
      const listKeys = Object.keys(entry).filter(
        (k) => !RESERVED.has(k) && typeof entry[k] === 'object' && entry[k] !== null,
      );
      if (listKeys.length === 0) {
        // Already a flat list object (future-proof)
        items.push(entry);
      } else {
        for (const key of listKeys) {
          const listData = entry[key] as Record<string, any>;
          items.push({
            id: key, // list name is the stable identifier
            name: key,
            items: listData.items ?? [],
            mixins: listData.mixins ?? {},
            metadata: listData.metadata ?? {},
          });
        }
      }
    }

    return { items, total: items.length };
  }

  async getList(listId: string): Promise<EmporixShoppingList | null> {
    const response = await this.apiClient.authenticatedFetch(
      `${this.baseUrl()}/${listId}`,
      { method: 'GET', cache: 'no-store' },
      'session',
      { scopes: ['shoppinglist.shoppinglist_manage'] },
    );

    if (!response.ok) {
      if (response.status === 404) return null;
      const errorDetails = await response.text();
      throw new Error(`Failed to get shopping list: ${response.statusText} ${errorDetails}`);
    }

    return response.json();
  }

  async createList(name: string, projectId?: string): Promise<EmporixShoppingList> {
    const body: Record<string, any> = { name };

    if (projectId) {
      body.mixins = {
        [PROJECT_MIXIN_KEY]: { projectid: projectId },
      };
      body.metadata = {
        mixins: { [PROJECT_MIXIN_KEY]: PROJECT_MIXIN_SCHEMA },
      };
    }

    const response = await this.apiClient.authenticatedFetch(
      this.baseUrl(),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      'session',
      { scopes: ['shoppinglist.shoppinglist_manage'] },
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to create shopping list: ${response.statusText} ${errorDetails}`);
    }

    // API returns { id } — return a minimal object; full data loads on next getLists call
    const created = await response.json();
    return {
      id: created.id ?? created,
      name,
      items: [],
      mixins: body.mixins,
      metadata: body.metadata,
    } as EmporixShoppingList;
  }

  async deleteList(listId: string): Promise<void> {
    const response = await this.apiClient.authenticatedFetch(
      `${this.baseUrl()}/${listId}`,
      { method: 'DELETE' },
      'session',
      { scopes: ['shoppinglist.shoppinglist_manage'] },
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to delete shopping list: ${response.statusText} ${errorDetails}`);
    }
  }

  async addItem(listId: string, productId: string, quantity: number): Promise<EmporixShoppingListItem> {
    const existing = await this.findListById(listId);
    if (!existing) throw new Error(`Shopping list ${listId} not found`);

    const newItem: EmporixShoppingListItem = { productId, quantity };
    const updatedItems = [...(existing.items ?? []), newItem];

    await this.putList(listId, existing, updatedItems);
    return newItem;
  }

  async removeItem(listId: string, itemId: string): Promise<void> {
    const existing = await this.findListById(listId);
    if (!existing) throw new Error(`Shopping list ${listId} not found`);

    const updatedItems = (existing.items ?? []).filter((item) => String(item.id) !== String(itemId));

    await this.putList(listId, existing, updatedItems);
  }

  private async findListById(listId: string): Promise<EmporixShoppingList | null> {
    // No individual-list GET endpoint — fetch all and find by ID
    const { items } = await this.getLists(100, 1);
    return items.find((l) => String(l.id) === String(listId)) ?? null;
  }

  private async putList(
    listId: string,
    existing: EmporixShoppingList,
    items: EmporixShoppingListItem[],
  ): Promise<void> {
    const body: Record<string, any> = {
      name: existing.name ?? '',
      items,
    };
    if (existing.mixins) body.mixins = existing.mixins;
    if (existing.metadata) body.metadata = existing.metadata;

    const response = await this.apiClient.authenticatedFetch(
      `${this.baseUrl()}/${listId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      'session',
      { scopes: ['shoppinglist.shoppinglist_manage'] },
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to update shopping list: ${response.statusText} ${errorDetails}`);
    }
  }

  async setProjectMixin(listId: string, projectId: string): Promise<void> {
    const existing = await this.getList(listId);
    if (!existing) throw new Error(`Shopping list ${listId} not found`);

    const updated = {
      ...existing,
      mixins: {
        ...(existing.mixins ?? {}),
        [PROJECT_MIXIN_KEY]: { projectid: projectId },
      },
      metadata: {
        ...(existing.metadata ?? {}),
        mixins: {
          ...(existing.metadata?.mixins ?? {}),
          [PROJECT_MIXIN_KEY]: PROJECT_MIXIN_SCHEMA,
        },
      },
    };

    const response = await this.apiClient.authenticatedFetch(
      `${this.baseUrl()}/${listId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      },
      'session',
      { scopes: ['shoppinglist.shoppinglist_manage'] },
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to update shopping list mixin: ${response.statusText} ${errorDetails}`);
    }
  }
}

export default EmporixShoppingListApi;
