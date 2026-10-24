import { l10nOrEmpty } from '@/lib/l10n';
import type { Category } from '@/platform/services/model/category';
import type {
  BatteryIncludedFacet,
  Filter,
  LocalizedString,
  SearchFilterValue,
  SearchFilters,
  SearchSortOption,
} from '@/platform/services/model/common';
import type { Product, ProductRecommendations, RelatedItem } from '@/platform/services/model/product';
import type { CategorySuggestion } from '@/platform/services/model/search';

/** Largest catalog slice priced in memory for price sort/filter and facet options. */
export const EMPORIX_CATALOG_WINDOW = 200;

const SUGGESTION_CATEGORY_LIMIT = 6;
const QUERY_COMPLETION_LIMIT = 5;
const ATTRIBUTE_FACET_VALUE_LIMIT = 24;
const SAFE_LIST_TOKEN = /^[A-Za-z0-9_.:@/+-]+$/;
const SAFE_ATTRIBUTE_KEY = /^[A-Za-z0-9_-]+$/;

export const EMPORIX_AVAILABLE_SORTS: SearchSortOption[] = [
  {
    id: 'name',
    labelKey: 'name',
    directions: ['asc', 'desc'],
    defaultDirection: 'asc',
  },
  {
    id: 'price',
    labelKey: 'price',
    directions: ['asc', 'desc'],
    defaultDirection: 'asc',
  },
];

export interface EmporixResolvedSort {
  /** Product Service `sort` token. Omitted for price, which is applied after price matching. */
  productSort?: string;
  priceDirection?: 'asc' | 'desc';
}

export interface EmporixSelectiveFilters {
  brandIds: string[];
  attributes: Record<string, string[]>;
  priceMin?: number;
  priceMax?: number;
}

export interface EmporixCatalogFacets {
  batteryIncludedFacets: BatteryIncludedFacet[];
  availableFilters: Filter[];
}

function isSortDirection(value: string | undefined): value is 'asc' | 'desc' {
  return value === 'asc' || value === 'desc';
}

function isNameSortField(fieldName: string): boolean {
  return fieldName === 'name' || (fieldName.includes('i18n') && fieldName.endsWith('.name'));
}

function isPriceSortField(fieldName: string): boolean {
  return fieldName === 'price' || fieldName.includes('effectiveAmount');
}

/**
 * Maps a storefront sort token onto Product Service sort, or onto in-memory price ordering.
 * BatteryIncluded name/price tokens are accepted so an existing `?sort=` URL keeps working.
 * Unknown fields are dropped so Product Service is not queried with an index field it does not have.
 */
export function resolveEmporixSort(sort?: string): EmporixResolvedSort {
  if (!sort) {
    return {};
  }

  const [fieldName, direction, ...rest] = sort.split(':');
  const normalizedField = fieldName?.trim();
  if (!normalizedField || !isSortDirection(direction) || rest.length > 0) {
    return {};
  }

  if (isNameSortField(normalizedField)) {
    return { productSort: `name:${direction}` };
  }

  if (isPriceSortField(normalizedField)) {
    return { priceDirection: direction };
  }

  if (normalizedField === 'code' || normalizedField === 'id') {
    return { productSort: `${normalizedField}:${direction}` };
  }

  return {};
}

function readStringList(value: SearchFilterValue | undefined): string[] {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  if (Array.isArray(value)) {
    return value.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  }

  return [];
}

function readBound(value: SearchFilterValue | undefined, key: 'from' | 'till'): number | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const raw = value[key];
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isPriceFilterKey(key: string): boolean {
  return key === 'price' || key.includes('effectiveAmount');
}

function attributeKeyFromFilterId(filterId: string): string | undefined {
  if (!filterId.startsWith('attr:')) {
    return undefined;
  }

  const key = filterId.slice('attr:'.length);
  return SAFE_ATTRIBUTE_KEY.test(key) ? key : undefined;
}

function safeListTokens(values: string[]): string[] {
  return values.filter((value) => SAFE_LIST_TOKEN.test(value));
}

/** Brand, template-attribute, and price constraints that Product Service `q` does not express as category scope. */
export function readSelectiveFilters(filters?: SearchFilters): EmporixSelectiveFilters {
  const selective: EmporixSelectiveFilters = { brandIds: [], attributes: {} };
  if (!filters) {
    return selective;
  }

  for (const [key, value] of Object.entries(filters)) {
    if (key === 'categoryIds' || key.startsWith('_')) {
      continue;
    }

    if (key === 'brandId' || key === 'brand') {
      selective.brandIds = safeListTokens(readStringList(value));
      continue;
    }

    if (isPriceFilterKey(key)) {
      const min = readBound(value, 'from');
      const max = readBound(value, 'till');
      if (min !== undefined) {
        selective.priceMin = min;
      }
      if (max !== undefined) {
        selective.priceMax = max;
      }
      continue;
    }

    const attributeKey = attributeKeyFromFilterId(key);
    if (!attributeKey) {
      continue;
    }

    const tokens = safeListTokens(readStringList(value));
    if (tokens.length > 0) {
      selective.attributes[attributeKey] = tokens;
    }
  }

  return selective;
}

export function hasSelectiveQueryFilters(selective: EmporixSelectiveFilters): boolean {
  return selective.brandIds.length > 0 || Object.keys(selective.attributes).length > 0;
}

export function hasPriceConstraint(selective: EmporixSelectiveFilters, sort: EmporixResolvedSort): boolean {
  return selective.priceMin !== undefined || selective.priceMax !== undefined || sort.priceDirection !== undefined;
}

/** Adds brand and template-attribute constraints to a Product Service criteria record. */
export function applySelectiveCriteria(
  criteria: Record<string, string>,
  selective: EmporixSelectiveFilters,
): Record<string, string> {
  const next: Record<string, string> = { ...criteria };

  if (selective.brandIds.length > 0) {
    next.brandId = `(${selective.brandIds.join(',')})`;
  }

  for (const [key, values] of Object.entries(selective.attributes)) {
    if (values.length === 0) {
      continue;
    }
    next[`mixins.productTemplateAttributes.${key}`] = `(${values.join(',')})`;
  }

  return next;
}

function activeValues(filters: SearchFilters | undefined, facetId: string): string[] {
  return readStringList(filters?.[facetId]);
}

function localizedLabel(value: string | LocalizedString | undefined, locale: string, fallback: string): string {
  const resolved = l10nOrEmpty(value, locale);
  return resolved || fallback;
}

function toLegacyFilter(facet: BatteryIncludedFacet): Filter {
  if (facet.kind === 'range') {
    return {
      id: facet.id,
      name: facet.id === 'price' ? 'price.effectiveAmount' : facet.label,
      labelIsPlainText: facet.id !== 'price',
      values: [
        ...(facet.min ? [{ id: facet.min, name: facet.min, active: false }] : []),
        ...(facet.max ? [{ id: facet.max, name: facet.max, active: false }] : []),
      ],
    };
  }

  return {
    id: facet.id,
    name: facet.label,
    labelIsPlainText: true,
    values: facet.options.map((option) => ({
      id: option.id,
      name: option.label,
      count: option.count,
      active: option.active,
    })),
  };
}

function brandLabel(product: Product, locale: string): string | undefined {
  const brand = product.brand;
  if (!brand?.id) {
    return undefined;
  }

  if (!brand.name) {
    return brand.id;
  }

  if (typeof brand.name === 'string') {
    return brand.name.trim() || brand.id;
  }

  return localizedLabel(brand.name, locale, brand.id);
}

/**
 * Brand, price, and template-attribute facets for the PLP panel.
 * Counts and price bounds are exact only when `countsAreComplete` (the sample is the full match set).
 */
export function buildEmporixCatalogFacets(
  products: Product[],
  filters: SearchFilters | undefined,
  locale: string,
  countsAreComplete: boolean,
): EmporixCatalogFacets {
  const facets: BatteryIncludedFacet[] = [];
  const brands = new Map<string, { label: string; count: number }>();
  const amounts: number[] = [];
  const attributes = new Map<string, Map<string, number>>();

  for (const product of products) {
    const brandId = product.brand?.id;
    if (brandId && SAFE_LIST_TOKEN.test(brandId)) {
      const current = brands.get(brandId) ?? { label: brandLabel(product, locale) ?? brandId, count: 0 };
      current.count += 1;
      brands.set(brandId, current);
    }

    if (typeof product.price?.amount === 'number' && Number.isFinite(product.price.amount)) {
      amounts.push(product.price.amount);
    }

    for (const [key, rawValue] of Object.entries(product.templateAttributes ?? {})) {
      if (!SAFE_ATTRIBUTE_KEY.test(key)) {
        continue;
      }
      const value = rawValue.trim();
      if (!value || !SAFE_LIST_TOKEN.test(value)) {
        continue;
      }
      const values = attributes.get(key) ?? new Map<string, number>();
      values.set(value, (values.get(value) ?? 0) + 1);
      attributes.set(key, values);
    }
  }

  if (brands.size > 0) {
    const selected = new Set(activeValues(filters, 'brandId'));
    facets.push({
      id: 'brandId',
      label: 'Brand',
      kind: 'select',
      options: [...brands.entries()]
        .sort((left, right) => left[1].label.localeCompare(right[1].label))
        .map(([id, brand]) => ({
          id,
          label: brand.label,
          ...(countsAreComplete ? { count: brand.count } : {}),
          active: selected.has(id),
        })),
    });
  }

  if (amounts.length > 1) {
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    if (min !== max) {
      facets.push({
        id: 'price',
        label: 'Price',
        kind: 'range',
        min: String(min),
        max: String(max),
      });
    }
  }

  for (const [key, values] of attributes) {
    if (values.size === 0 || values.size > ATTRIBUTE_FACET_VALUE_LIMIT) {
      continue;
    }

    const populatedProducts = products.filter((product) => product.templateAttributes?.[key]?.trim()).length;
    if (values.size === populatedProducts && values.size > 8) {
      continue;
    }

    const labelSource = products.find((product) => product.templateAttributeLabels?.[key])?.templateAttributeLabels?.[
      key
    ];
    const label = labelSource ? localizedLabel(labelSource, locale, key) : key.charAt(0).toUpperCase() + key.slice(1);
    const facetId = `attr:${key}`;
    const selected = new Set(activeValues(filters, facetId));
    const attributeType = products.find((product) => product.templateAttributeTypes?.[key])?.templateAttributeTypes?.[
      key
    ];
    if (attributeType === 'NUMBER') {
      continue;
    }

    const options = [...values.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([id, count]) => ({
        id,
        label: id,
        ...(countsAreComplete ? { count } : {}),
        active: selected.has(id),
      }));

    facets.push({
      id: facetId,
      label,
      kind: 'select',
      options,
    });
  }

  return {
    batteryIncludedFacets: facets,
    availableFilters: facets.map((facet) => toLegacyFilter(facet)),
  };
}

export function applyPriceWindow(
  products: Product[],
  selective: EmporixSelectiveFilters,
  priceDirection: 'asc' | 'desc' | undefined,
  page: number,
  pageSize: number,
): { items: Product[]; total: number } {
  const filtered = products.filter((product) => {
    if (selective.priceMin === undefined && selective.priceMax === undefined) {
      return true;
    }

    const amount = product.price?.amount;
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      return false;
    }

    if (selective.priceMin !== undefined && amount < selective.priceMin) {
      return false;
    }

    return selective.priceMax === undefined || amount <= selective.priceMax;
  });

  const ordered = priceDirection
    ? [...filtered].sort((left, right) => {
        const leftAmount = left.price?.amount ?? Number.POSITIVE_INFINITY;
        const rightAmount = right.price?.amount ?? Number.POSITIVE_INFINITY;
        return priceDirection === 'asc' ? leftAmount - rightAmount : rightAmount - leftAmount;
      })
    : filtered;

  const start = Math.max(page, 0) * pageSize;
  return {
    items: ordered.slice(start, start + pageSize),
    total: ordered.length,
  };
}

export function buildQueryCompletions(products: Product[], query: string | undefined, locale: string): string[] {
  const needle = query?.trim();
  if (!needle) {
    return [];
  }

  const needleLower = needle.toLowerCase();
  const names = products
    .map((product) => l10nOrEmpty(product.name, locale).trim())
    .filter((name) => name.length > 0 && name.toLowerCase().includes(needleLower));

  const unique = [...new Set(names)];
  unique.sort((left, right) => {
    const leftStarts = left.toLowerCase().startsWith(needleLower) ? 0 : 1;
    const rightStarts = right.toLowerCase().startsWith(needleLower) ? 0 : 1;
    return leftStarts - rightStarts || left.localeCompare(right);
  });

  return unique.slice(0, QUERY_COMPLETION_LIMIT);
}

function highlightMatch(name: string, query: string): string {
  const index = name.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) {
    return name;
  }

  return `${name.slice(0, index)}<mark>${name.slice(index, index + query.length)}</mark>${name.slice(index + query.length)}`;
}

function walkCategories(nodes: Category[] | undefined, visit: (category: Category) => void): void {
  if (!nodes) {
    return;
  }

  for (const node of nodes) {
    if (!node || typeof node === 'string') {
      continue;
    }
    visit(node);
    const children = node.children?.filter((child): child is Category => typeof child !== 'string');
    walkCategories(children, visit);
  }
}

export function buildCategorySuggestions(
  roots: Category[] | undefined,
  query: string | undefined,
  locale: string,
): CategorySuggestion[] {
  const needle = query?.trim();
  if (!needle || needle.length < 2 || !roots) {
    return [];
  }

  const needleLower = needle.toLowerCase();
  const matches: CategorySuggestion[] = [];

  walkCategories(roots, (category) => {
    if (matches.length >= SUGGESTION_CATEGORY_LIMIT || !category.id) {
      return;
    }

    const name = l10nOrEmpty(category.name, locale).trim();
    if (!name.toLowerCase().includes(needleLower)) {
      return;
    }

    matches.push({
      name,
      highlighted: highlightMatch(name, needle),
      count: 0,
      categoryId: category.id,
      idPath: category.id,
    });
  });

  return matches;
}

const UP_SELL_TYPES = new Set<RelatedItem['type']>(['Upsell']);

export function partitionRelatedItems(items: RelatedItem[] | undefined): {
  crossSellIds: string[];
  upSellIds: string[];
} {
  const crossSellIds: string[] = [];
  const upSellIds: string[] = [];

  for (const item of items ?? []) {
    const refId = item.refId?.trim();
    if (!refId) {
      continue;
    }

    if (UP_SELL_TYPES.has(item.type)) {
      upSellIds.push(refId);
    } else {
      crossSellIds.push(refId);
    }
  }

  return { crossSellIds, upSellIds };
}

export function toFallbackRecommendations(products: Product[]): ProductRecommendations {
  const crossSellCount = Math.max(1, Math.ceil(products.length / 2));
  return {
    products,
    crossSell: products.slice(0, crossSellCount),
    upSell: products.slice(crossSellCount),
  };
}
