'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ProjectMediaAsset, ProjectUpdateDto } from '@/platform/services/model/project/project';
import type { Project } from '@/platform/services/model/project/project';
import type { ShoppingList, ShoppingListItem } from '@/platform/services/model/shopping-list/shopping-list';

export function useProject(projectId: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>([]);
  const [media, setMedia] = useState<ProjectMediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProject = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projectRes, listsRes, mediaRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/projects/${projectId}/shopping-lists`),
        fetch(`/api/projects/${projectId}/media`),
      ]);

      if (!projectRes.ok) throw new Error(`Project not found`);
      const [projectData, listsData, mediaData] = await Promise.all([
        projectRes.json(),
        listsRes.ok ? listsRes.json() : [],
        mediaRes.ok ? mediaRes.json() : [],
      ]);

      setProject(projectData);
      setShoppingLists(listsData);
      setMedia(mediaData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const updateProject = useCallback(
    async (data: ProjectUpdateDto): Promise<Project> => {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(`Failed to update project: ${response.statusText}`);
      const updated = await response.json();
      setProject(updated);
      return updated;
    },
    [projectId],
  );

  const createShoppingList = useCallback(
    async (name: string): Promise<ShoppingList> => {
      const response = await fetch(`/api/projects/${projectId}/shopping-lists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error(`Failed to create shopping list: ${response.statusText}`);
      const list = await response.json();
      setShoppingLists((prev) => [...prev, list]);
      return list;
    },
    [projectId],
  );

  const deleteShoppingList = useCallback(
    async (listId: string): Promise<void> => {
      const list = shoppingLists.find((l) => l.id === listId);
      const response = await fetch(`/api/projects/${projectId}/shopping-lists/${listId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listName: list?.name ?? '' }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error ?? `Failed to delete shopping list: ${response.statusText}`);
      }
      setShoppingLists((prev) => prev.filter((l) => l.id !== listId));
    },
    [projectId, shoppingLists],
  );

  const addItemToList = useCallback(
    async (listId: string, productId: string, quantity: number): Promise<ShoppingListItem> => {
      // Include current list state so the server can do a single PUT without a GET roundtrip
      const currentList = shoppingLists.find((l) => l.id === listId);
      const response = await fetch(`/api/projects/${projectId}/shopping-lists/${listId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          quantity,
          listName: currentList?.name ?? '',
          currentItems: (currentList?.items ?? []).map((i) => ({ productId: i.productId, quantity: i.quantity })),
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error ?? `Failed to add item: ${response.statusText}`);
      }
      const item = await response.json();
      setShoppingLists((prev) =>
        prev.map((l) => (l.id === listId ? { ...l, items: [...l.items, { ...item, productId }] } : l)),
      );
      return item;
    },
    [projectId, shoppingLists],
  );

  const removeItemFromList = useCallback(
    async (listId: string, productId: string): Promise<void> => {
      const currentList = shoppingLists.find((l) => l.id === listId);
      // Use a fixed placeholder in the URL; the actual productId to remove is passed in the body
      // to avoid URL-encoding issues with product IDs containing slashes, colons, etc.
      const response = await fetch(`/api/projects/${projectId}/shopping-lists/${listId}/items/_`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listName: currentList?.name ?? '',
          currentItems: currentList?.items ?? [],
          productIdToRemove: productId,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error ?? `Failed to remove item: ${response.statusText}`);
      }
      setShoppingLists((prev) =>
        prev.map((l) => (l.id === listId ? { ...l, items: l.items.filter((i) => i.productId !== productId) } : l)),
      );
    },
    [projectId, shoppingLists],
  );

  const addListToCart = useCallback(
    async (listId: string, cartId: string, itemId?: string): Promise<{ added: number; failed: number }> => {
      const response = await fetch(`/api/projects/${projectId}/shopping-lists/${listId}/add-to-cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartId, itemId }),
      });
      if (!response.ok) throw new Error(`Failed to add to cart: ${response.statusText}`);
      return response.json();
    },
    [projectId],
  );

  const uploadMedia = useCallback(
    async (file: File): Promise<ProjectMediaAsset> => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`/api/projects/${projectId}/media`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error(`Failed to upload media: ${response.statusText}`);
      const asset = await response.json();
      setMedia((prev) => [...prev, asset]);
      return asset;
    },
    [projectId],
  );

  const deleteMedia = useCallback(
    async (mediaId: string): Promise<void> => {
      const response = await fetch(`/api/projects/${projectId}/media/${mediaId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error(`Failed to delete media: ${response.statusText}`);
      setMedia((prev) => prev.filter((m) => m.id !== mediaId));
    },
    [projectId],
  );

  const refreshShoppingLists = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/shopping-lists`);
    if (response.ok) {
      setShoppingLists(await response.json());
    }
  }, [projectId]);

  return {
    project,
    shoppingLists,
    media,
    loading,
    error,
    fetchProject,
    updateProject,
    createShoppingList,
    deleteShoppingList,
    addItemToList,
    removeItemFromList,
    addListToCart,
    uploadMedia,
    deleteMedia,
    refreshShoppingLists,
  };
}
