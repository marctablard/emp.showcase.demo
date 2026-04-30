'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  ChevronDown,
  ChevronRight,
  List,
  Package,
  Plus,
  ShoppingCart,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCart } from '@/hooks/cart/useCart';
import { useSiteCode } from '@/hooks/site/useSiteCode';
import { fetchProductPrice } from '@/lib/client/prices';
import { fetchProductById } from '@/lib/client/products';
import { cn, formatCurrency } from '@/lib/utils';
import type { ShoppingList, ShoppingListItem } from '@/platform/services/model/shopping-list/shopping-list';

/* ─── Enriched item type ─────────────────────────────────── */

interface EnrichedItem extends ShoppingListItem {
  productName?: string;
  imageUrl?: string;
  price?: number;
  currency?: string;
  loadingDetails?: boolean;
  hasVariants?: boolean;
}

/* ─── Tab props ──────────────────────────────────────────── */

interface ProjectShoppingListsTabProps {
  projectId: string;
  lists: ShoppingList[];
  onCreateList: (name: string) => Promise<ShoppingList>;
  onDeleteList: (listId: string) => Promise<void>;
  onAddItem: (listId: string, productId: string, quantity: number) => Promise<any>;
  onRemoveItem: (listId: string, itemId: string) => Promise<void>;
  onAddToCart: (listId: string, cartId: string, itemId?: string) => Promise<{ added: number; failed: number }>;
}

/* ─── Product search ─────────────────────────────────────── */

interface ProductSearchResult {
  id: string;
  name: string;
  sku?: string;
  imageUrl?: string;
  brand?: string;
}

function resolveLocalized(val: unknown, locale: string): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    const obj = val as Record<string, string>;
    return obj[locale] ?? obj['en'] ?? Object.values(obj)[0] ?? '';
  }
  return '';
}

async function searchProducts(query: string, locale: string, site: string): Promise<ProductSearchResult[]> {
  if (!query.trim()) return [];
  const res = await fetch(`/api/search?query=${encodeURIComponent(query)}&size=10&locale=${locale}&site=${site}`);
  if (!res.ok) throw new Error(`Search failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return (data.items ?? []).map((p: any) => ({
    id: p.id,
    name: resolveLocalized(p.name, locale) || p.id,
    sku: p.sku ?? p.code,
    imageUrl: p.primaryImage?.url ?? p.images?.[0]?.url,
    brand: resolveLocalized(p.brand?.name, locale) || undefined,
  }));
}

/* ─── Add Product Dialog ─────────────────────────────────── */

function AddProductDialog({
  listId,
  onAdd,
  onClose,
}: {
  listId: string;
  onAdd: (listId: string, productId: string, quantity: number) => Promise<any>;
  onClose: () => void;
}) {
  const t = useTranslations('account.projects.shoppingLists');
  const locale = useLocale();
  const siteCode = useSiteCode();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [priceMap, setPriceMap] = useState<Record<string, { amount: number; currency: string }>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [adding, setAdding] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [searchError, setSearchError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        return;
      }
      setSearching(true);
      setSearchError(null);
      try {
        const r = await searchProducts(q, locale, siteCode);
        setResults(r);
        r.forEach(async (p) => {
          try {
            const price = await fetchProductPrice(p.id);
            if (price)
              setPriceMap((prev) => ({
                ...prev,
                [p.id]: { amount: price.amount ?? price.originalAmount ?? 0, currency: price.currency ?? 'EUR' },
              }));
          } catch {
            /* ignore */
          }
        });
      } catch (err) {
        setSearchError(err instanceof Error ? err.message : 'Search failed');
        setResults([]);
      } finally {
        setSearching(false);
      }
    },
    [locale, siteCode],
  );

  const handleChange = (v: string) => {
    setQuery(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(v), 350);
  };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const handleAdd = async (p: ProductSearchResult) => {
    const qty = quantities[p.id] ?? 1;
    setAdding(p.id);
    try {
      await onAdd(listId, p.id, qty);
      setAddedIds((prev) => new Set([...prev, p.id]));
    } finally {
      setAdding(null);
    }
  };

  const statusSlot = searching ? (
    <div className="flex justify-center py-3">
      <Spinner color="primary" variant="md" />
    </div>
  ) : searchError ? (
    <p className="text-sm text-text-error text-center">{searchError}</p>
  ) : !query.trim() ? (
    <p className="text-sm text-text-secondary text-center">{t('searchProducts')}</p>
  ) : results.length === 0 ? (
    <p className="text-sm text-text-secondary text-center">{t('noResults')}</p>
  ) : null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t('addProduct')}</DialogTitle>
        </DialogHeader>
        <Input
          placeholder={t('searchProducts')}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          autoFocus
        />
        {statusSlot}
        {results.length > 0 && (
          <div className="border border-border-primary rounded-md divide-y divide-border-primary max-h-[360px] overflow-y-auto">
            {results.map((p) => {
              const price = priceMap[p.id];
              const added = addedIds.has(p.id);
              return (
                <div key={p.id} className="flex items-center gap-3 p-3">
                  <div className="w-12 h-12 shrink-0 rounded overflow-hidden bg-surface-image-background flex items-center justify-center">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="h-5 w-5 text-text-on-disabled" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {p.brand && <p className="text-xs text-text-secondary truncate">{p.brand}</p>}
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    {p.sku && <p className="text-xs text-text-secondary">SKU: {p.sku}</p>}
                    {price ? (
                      <p className="text-sm font-semibold text-text-action">
                        {formatCurrency(price.amount, price.currency)}
                      </p>
                    ) : (
                      <div className="h-3.5 w-16 mt-0.5 bg-surface-disabled rounded animate-pulse" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Input
                      type="number"
                      min={1}
                      value={quantities[p.id] ?? 1}
                      onChange={(e) =>
                        setQuantities((prev) => ({ ...prev, [p.id]: Math.max(1, parseInt(e.target.value) || 1) }))
                      }
                      className="w-16 text-center h-9"
                      disabled={added}
                    />
                    <Button
                      size="small"
                      variant={added ? 'secondary' : 'primary'}
                      disabled={adding === p.id}
                      onClick={() => !added && handleAdd(p)}
                      className="h-9 w-16"
                    >
                      {adding === p.id ? <Spinner /> : added ? '✓' : t('add')}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <Button variant="secondary" onClick={onClose} className="w-full">
          {t('close')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Expanded items panel ───────────────────────────────── */

function ListItemsPanel({
  items,
  list,
  onRemoveItem,
}: {
  items: ShoppingListItem[];
  list: ShoppingList;
  onRemoveItem: (listId: string, itemId: string) => Promise<void>;
}) {
  const t = useTranslations('account.projects.shoppingLists');
  const { addItem, cartId } = useCart();
  const [enriched, setEnriched] = useState<EnrichedItem[]>([]);
  const [cartState, setCartState] = useState<Record<string, 'idle' | 'loading' | 'success' | 'error'>>({});

  // Silently assign the shopping list's project to the cart after adding items
  const assignProjectToCart = useCallback(async () => {
    if (!cartId || !list.projectId) return;
    try {
      await fetch(`/api/cart/${cartId}/project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: list.projectId }),
      });
    } catch {
      // best-effort — does not affect add-to-cart outcome
    }
  }, [cartId, list.projectId]);

  const loadDetails = useCallback(async (source: ShoppingListItem[]) => {
    if (source.length === 0) {
      setEnriched([]);
      return;
    }
    setEnriched(source.map((i) => ({ ...i, loadingDetails: true })));
    await Promise.all(
      source.map(async (item, idx) => {
        try {
          const [product, priceData] = await Promise.all([
            fetchProductById(item.productId, { variants: true }),
            fetchProductPrice(item.productId),
          ]);
          setEnriched((prev) =>
            prev.map((e, i) =>
              i !== idx
                ? e
                : {
                    ...e,
                    loadingDetails: false,
                    productName: product
                      ? typeof product.name === 'object'
                        ? resolveLocalized(product.name, 'en')
                        : String(product.name)
                      : item.productId,
                    imageUrl: (product?.primaryImage as any)?.url ?? (product?.images?.[0] as any)?.url,
                    sku: item.sku ?? (product as any)?.sku,
                    price: priceData?.amount ?? priceData?.originalAmount,
                    currency: priceData?.currency ?? 'EUR',
                    hasVariants: Array.isArray(product?.variants) && product.variants.length > 0,
                  },
            ),
          );
        } catch {
          setEnriched((prev) => prev.map((e, i) => (i !== idx ? e : { ...e, loadingDetails: false })));
        }
      }),
    );
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDetails(items);
  }, [items, loadDetails]);

  const handleAddOneToCart = async (item: EnrichedItem, key: string) => {
    if (!item.productId || item.hasVariants) return;
    setCartState((s) => ({ ...s, [key]: 'loading' }));
    try {
      await addItem(item.productId, item.quantity ?? 1);
      void assignProjectToCart();
      setCartState((s) => ({ ...s, [key]: 'success' }));
      setTimeout(() => setCartState((s) => ({ ...s, [key]: 'idle' })), 2000);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[ShoppingList] addToCart failed', err);
      setCartState((s) => ({ ...s, [key]: 'error' }));
      setTimeout(() => setCartState((s) => ({ ...s, [key]: 'idle' })), 3000);
    }
  };

  const allCartState = cartState['__all__'] ?? 'idle';

  const handleAddAllToCart = async () => {
    setCartState((s) => ({ ...s, __all__: 'loading' }));
    const validItems = enriched.filter((i) => !!i.productId && !i.hasVariants);
    if (validItems.length === 0) {
      setCartState((s) => ({ ...s, __all__: 'error' }));
      setTimeout(() => setCartState((s) => ({ ...s, __all__: 'idle' })), 3000);
      return;
    }
    // Add items sequentially: the cart store sets loading=true during each addToCart call,
    // so concurrent calls would collide on the loading guard and fail.
    let anySucceeded = false;
    let anyFailed = false;
    for (const item of validItems) {
      try {
        await addItem(item.productId, item.quantity ?? 1);
        anySucceeded = true;
      } catch (err) {
        anyFailed = true;
        // eslint-disable-next-line no-console
        console.error('[ShoppingList] addAllToCart item failed', { productId: item.productId, err });
      }
    }
    if (anySucceeded) void assignProjectToCart();
    setCartState((s) => ({
      ...s,
      __all__: anyFailed && !anySucceeded ? 'error' : 'success',
    }));
    setTimeout(() => setCartState((s) => ({ ...s, __all__: 'idle' })), 2000);
  };

  if (items.length === 0) {
    return <p className="text-base text-text-secondary text-center py-6">{t('emptyList')}</p>;
  }

  return (
    <div>
      <Table>
        <TableBody>
          {enriched.map((item, idx) => {
            const itemKey = item.id || String(idx);
            const cs = cartState[itemKey] ?? 'idle';
            return (
              <TableRow
                key={itemKey}
                className={cn('text-base', idx % 2 === 0 ? 'bg-surface-page' : 'bg-surface-image-background')}
              >
                {/* Thumbnail */}
                <TableCell className="pl-4 py-3">
                  <div className="w-12 h-12 rounded overflow-hidden bg-surface-image-background flex items-center justify-center shrink-0">
                    {item.loadingDetails ? (
                      <div className="w-full h-full animate-pulse bg-surface-disabled" />
                    ) : item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Package className="h-5 w-5 text-text-on-disabled" />
                    )}
                  </div>
                </TableCell>
                {/* Name + SKU */}
                <TableCell className="px-2 py-4">
                  {item.loadingDetails ? (
                    <>
                      <div className="h-4 w-40 bg-surface-disabled rounded animate-pulse mb-1" />
                      <div className="h-3 w-24 bg-surface-disabled rounded animate-pulse" />
                    </>
                  ) : (
                    <>
                      <div className="font-medium">{item.productName ?? item.productId}</div>
                      {item.sku && <div className="text-sm text-text-placeholders">SKU: {item.sku}</div>}
                    </>
                  )}
                </TableCell>
                {/* Qty */}
                <TableCell className="px-2 py-4 text-center">{item.quantity}</TableCell>
                {/* Price */}
                <TableCell className="px-2 py-4 text-right font-medium">
                  {item.loadingDetails ? (
                    <div className="h-4 w-16 bg-surface-disabled rounded animate-pulse ml-auto" />
                  ) : item.price != null ? (
                    formatCurrency(item.price, item.currency ?? 'EUR')
                  ) : (
                    '–'
                  )}
                </TableCell>
                {/* Actions */}
                <TableCell className="px-2 py-4 pr-4 text-right">
                  <div className="flex justify-end gap-2 items-center">
                    {item.hasVariants ? (
                      <>
                        <Button
                          size="icon"
                          variant="neutral"
                          className="text-text-secondary"
                          title={t('requiresVariant')}
                          asChild
                        >
                          <Link href={`/product/${item.productId}`}>
                            <SlidersHorizontal className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          size="icon"
                          variant="neutral"
                          className="text-text-disabled cursor-not-allowed"
                          disabled
                          title={t('requiresVariant')}
                        >
                          <ShoppingCart className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="icon"
                        variant="neutral"
                        className="text-text-secondary"
                        disabled={cs === 'loading'}
                        onClick={() => handleAddOneToCart(item, itemKey)}
                      >
                        {cs === 'loading' ? <Spinner /> : cs === 'success' ? '✓' : <ShoppingCart className="h-4 w-4" />}
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="neutral"
                      className="text-text-secondary hover:text-text-error"
                      onClick={() => onRemoveItem(list.id, item.productId)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <div className="flex justify-end px-4 py-3 border-t border-border-primary">
        <Button disabled={allCartState === 'loading'} onClick={handleAddAllToCart}>
          {allCartState === 'success'
            ? t('addedToCart')
            : allCartState === 'error'
              ? t('addToCartError')
              : t('addToCart')}
          {allCartState === 'loading' ? <Spinner /> : <ShoppingCart />}
        </Button>
      </div>
    </div>
  );
}

/* ─── Main tab ───────────────────────────────────────────── */

export function ProjectShoppingListsTab({
  projectId: _projectId,
  lists,
  onCreateList,
  onDeleteList,
  onAddItem,
  onRemoveItem,
  onAddToCart: _onAddToCart,
}: ProjectShoppingListsTabProps) {
  const t = useTranslations('account.projects.shoppingLists');

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addProductListId, setAddProductListId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newListName.trim()) return;
    setCreating(true);
    try {
      await onCreateList(newListName.trim());
      setNewListName('');
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (listId: string) => {
    if (deleteConfirmId !== listId) {
      setDeleteConfirmId(listId);
      return;
    }
    setDeleting(listId);
    try {
      await onDeleteList(listId);
    } finally {
      setDeleting(null);
      setDeleteConfirmId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex justify-end">
        <Button size="small" className="gap-2" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          {t('newList')}
        </Button>
      </div>

      {/* Inline create form */}
      {showCreate && (
        <div className="border border-border-primary rounded-md p-4 bg-surface-image-background flex gap-3 items-end">
          <div className="flex-1 grid gap-1.5">
            <Label>{t('listName')}</Label>
            <Input
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder={t('listNamePlaceholder')}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>
          <Button onClick={handleCreate} disabled={creating || !newListName.trim()}>
            {creating ? t('creating') : t('createList')}
          </Button>
          <Button variant="neutral" size="icon" onClick={() => setShowCreate(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {lists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border-primary rounded-md gap-3">
          <List className="h-10 w-10 text-text-on-disabled" />
          <p className="font-medium">{t('noLists')}</p>
          <p className="text-sm text-text-secondary">{t('noListsDescription')}</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="text-base">
              <TableHead className="!h-14 font-bold">{t('listName')}</TableHead>
              <TableHead className="!h-14 font-bold w-32">{t('quantity')}</TableHead>
              <TableHead className="!h-14 font-bold w-56 text-right">{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lists.map((list, index) => {
              const isExpanded = expandedId === list.id;
              const isDeletingThis = deleting === list.id;

              return (
                <>
                  {/* List header row — same style as order rows */}
                  <TableRow
                    key={list.id}
                    className={cn(
                      'cursor-pointer hover:bg-surface-image-background text-base',
                      index % 2 === 0 ? 'bg-surface-page' : 'bg-surface-image-background',
                    )}
                    onClick={() => setExpandedId(isExpanded ? null : list.id)}
                  >
                    <TableCell className="px-2 py-4 font-medium">
                      <span className="inline-flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-text-secondary" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-text-secondary" />
                        )}
                        {list.name || list.id}
                      </span>
                    </TableCell>
                    <TableCell className="px-2 py-4 text-text-secondary">
                      {t('items', { count: list.items.length })}
                    </TableCell>
                    <TableCell className="px-2 py-4 text-right">
                      <div className="flex justify-end gap-2 items-center" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="small"
                          variant="secondary"
                          className="gap-1.5"
                          onClick={() => setAddProductListId(list.id)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          {t('addProduct')}
                        </Button>
                        {deleteConfirmId === list.id && (
                          <span className="text-xs text-text-error whitespace-nowrap">{t('confirmDeleteList')}</span>
                        )}
                        <Button
                          size="icon"
                          variant="neutral"
                          className="h-8 w-8 text-text-secondary hover:text-text-error"
                          disabled={isDeletingThis}
                          onClick={() => handleDelete(list.id)}
                        >
                          {isDeletingThis ? <Spinner /> : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Expanded items — inline, no extra border/card */}
                  {isExpanded && (
                    <TableRow key={`${list.id}-items`} className="hover:bg-transparent">
                      <TableCell colSpan={3} className="p-0 pb-4 border-t border-border-primary">
                        <ListItemsPanel items={list.items} list={list} onRemoveItem={onRemoveItem} />
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      )}

      {addProductListId && (
        <AddProductDialog listId={addProductListId} onAdd={onAddItem} onClose={() => setAddProductListId(null)} />
      )}
    </div>
  );
}
