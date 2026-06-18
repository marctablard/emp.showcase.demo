import type {
  BatteryIncludedFacetCount,
  BatteryIncludedFacetCountRow,
  BatteryIncludedSearchResponse,
} from '@/platform/integrations/batteryincluded/model';
import type { Category } from '@/platform/services/model/category';
import { withBatteryIncludedCategoryMetadata } from '@/platform/services/model/category/batteryincluded-category';

export const BATTERY_INCLUDED_CATEGORY_IDS_FILTER = '_product.categoryIds';
const ID_PATH_DELIMITER = ' > ';

export interface NavigationCategoryTreeRequestContext {
  siteCode: string;
  locale: string;
  country?: string;
  showUnpublished: boolean;
}

export interface BatteryIncludedCategoryLookupEntry {
  id: string;
  facetValue?: string;
  labelPath: string;
  leafLabel: string;
  publicationAnchorId: string;
  count: number;
  idPath: string[];
  position?: number;
}

export interface BatteryIncludedCategoryTreeSnapshot {
  roots: Category[];
  byId: Record<string, BatteryIncludedCategoryLookupEntry>;
  byFacetValue: Record<string, BatteryIncludedCategoryLookupEntry>;
  countsById: Record<string, number>;
}

export interface BuildBatteryIncludedCategoryTreeResult {
  snapshot: BatteryIncludedCategoryTreeSnapshot | null;
  discardedRows: string[];
  validationWarnings: string[];
}

type MutableCategory = Category & { children: MutableCategory[] };

function getFacet(
  response: BatteryIncludedSearchResponse<unknown>,
  fieldName: string,
): BatteryIncludedFacetCount | undefined {
  return response.facet_counts.find((facet) => facet.field_name === fieldName);
}

function splitPath(raw: string | undefined): string[] {
  return (
    raw
      ?.split(ID_PATH_DELIMITER)
      .map((segment) => segment.trim())
      .filter(Boolean) ?? []
  );
}

function toLocalizedName(locale: string, label: string): Record<string, string> {
  return { [locale]: label };
}

function createNode(id: string, locale: string, label: string): MutableCategory {
  return {
    id,
    name: toLocalizedName(locale, label),
    children: [],
  };
}

function compareCategoryPositions(a: Category, b: Category): number {
  const aPosition = typeof a.position === 'number' ? a.position : undefined;
  const bPosition = typeof b.position === 'number' ? b.position : undefined;

  if (aPosition === undefined && bPosition === undefined) {
    return 0;
  }
  if (aPosition === undefined) {
    return 1;
  }
  if (bPosition === undefined) {
    return -1;
  }
  return aPosition - bPosition;
}

export function buildBatteryIncludedCategoryTree(
  response: BatteryIncludedSearchResponse<unknown>,
  publishedRootIds: readonly string[],
  locale: string,
  breadcrumbFieldName: string,
): BuildBatteryIncludedCategoryTreeResult {
  const breadcrumbFacet = getFacet(response, breadcrumbFieldName);
  if (!breadcrumbFacet || !Array.isArray(breadcrumbFacet.counts) || breadcrumbFacet.counts.length === 0) {
    return {
      snapshot: null,
      discardedRows: ['missing breadcrumb facet'],
      validationWarnings: [],
    };
  }

  const publishedRootSet = new Set(publishedRootIds.map((id) => id.trim()).filter(Boolean));
  const categoryIdsFacet = getFacet(response, BATTERY_INCLUDED_CATEGORY_IDS_FILTER);
  const knownCategoryIds = new Set((categoryIdsFacet?.counts ?? []).map((row) => row.value?.trim()).filter(Boolean));

  const discardedRows: string[] = [];
  const validationWarnings: string[] = [];
  const nodesById = new Map<string, MutableCategory>();
  const publishedRootOrder = new Map(publishedRootIds.map((id, index) => [id, index]));
  const countsById: Record<string, number> = {};
  const explicitCountsById: Record<string, number> = {};
  const byId: Record<string, BatteryIncludedCategoryLookupEntry> = {};
  const byFacetValue: Record<string, BatteryIncludedCategoryLookupEntry> = {};

  const ensureNode = (id: string, label: string): MutableCategory => {
    const existing = nodesById.get(id);
    if (existing) {
      return existing;
    }
    const created = createNode(id, locale, label);
    nodesById.set(id, created);
    return created;
  };

  for (const row of breadcrumbFacet.counts as BatteryIncludedFacetCountRow[]) {
    const facetValue = row.value?.trim();
    const fullDisplayPath = row.data?.displayPath?.trim();
    const rawIdPath = row.data?.idPath?.trim();
    const position = typeof row.data?.position === 'number' ? row.data.position : undefined;
    const idPath = splitPath(rawIdPath);
    const labelPath = splitPath(fullDisplayPath);

    if (!facetValue || !rawIdPath || !fullDisplayPath || idPath.length === 0 || labelPath.length !== idPath.length) {
      discardedRows.push(facetValue || rawIdPath || fullDisplayPath || '<missing-breadcrumb-row>');
      continue;
    }

    const publicationAnchorIndex = idPath.findIndex((id) => publishedRootSet.has(id));
    if (publicationAnchorIndex < 0) {
      discardedRows.push(facetValue);
      continue;
    }

    const scopedIdPath = idPath.slice(publicationAnchorIndex);
    const scopedLabelPath = labelPath.slice(publicationAnchorIndex);
    const publicationAnchorId = scopedIdPath[0];

    let parent: MutableCategory | undefined;
    for (let index = 0; index < scopedIdPath.length; index += 1) {
      const id = scopedIdPath[index];
      const label = scopedLabelPath[index];

      const node = ensureNode(id, label);

      if (index === scopedIdPath.length - 1 && position !== undefined) {
        node.position = position;
      }

      if (parent && !parent.children.some((child) => child.id === node.id)) {
        parent.children.push(node);
      }

      if (knownCategoryIds.size > 0 && !knownCategoryIds.has(id)) {
        validationWarnings.push(`missing category id: ${id}`);
      }

      const entry: BatteryIncludedCategoryLookupEntry = {
        id,
        facetValue: index === scopedIdPath.length - 1 ? facetValue : byId[id]?.facetValue,
        labelPath: scopedLabelPath.slice(0, index + 1).join(ID_PATH_DELIMITER),
        leafLabel: label,
        publicationAnchorId,
        count: byId[id]?.count ?? 0,
        idPath: scopedIdPath.slice(0, index + 1),
        position: index === scopedIdPath.length - 1 ? position : byId[id]?.position,
      };

      if (index === scopedIdPath.length - 1) {
        explicitCountsById[id] = row.count;
        entry.count = row.count;
      }

      byId[id] = entry;
      if (entry.facetValue) {
        byFacetValue[entry.facetValue] = entry;
      }

      const withMetadata = withBatteryIncludedCategoryMetadata(node, {
        source: 'batteryincluded',
        facetValue: entry.facetValue,
        labelPath: entry.labelPath,
        leafLabel: entry.leafLabel,
        publicationAnchorId,
        count: entry.count,
        idPath: entry.idPath,
      }) as MutableCategory;
      nodesById.set(id, withMetadata);
      if (parent) {
        parent.children = parent.children.map((child) => (child.id === id ? withMetadata : child));
      }
      parent = withMetadata;
    }
  }

  const finalizeCounts = (node: MutableCategory): number => {
    const explicit = explicitCountsById[node.id];
    const childTotal = node.children.reduce((sum, child) => sum + finalizeCounts(child), 0);
    const count = explicit ?? childTotal;
    countsById[node.id] = count;
    const entry = byId[node.id];
    if (entry) {
      entry.count = count;
      const withMetadata = withBatteryIncludedCategoryMetadata(node, {
        source: 'batteryincluded',
        facetValue: entry.facetValue,
        labelPath: entry.labelPath,
        leafLabel: entry.leafLabel,
        publicationAnchorId: entry.publicationAnchorId,
        count,
        idPath: entry.idPath,
      }) as MutableCategory;
      nodesById.set(node.id, withMetadata);
      return count;
    }
    return count;
  };

  const sortChildrenByPosition = (node: MutableCategory): void => {
    node.children.sort(compareCategoryPositions);
    node.children.forEach(sortChildrenByPosition);
  };

  const compareRootOrder = (a: Category, b: Category): number => {
    const positionOrder = compareCategoryPositions(a, b);
    if (positionOrder !== 0) {
      return positionOrder;
    }

    return (
      (publishedRootOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (publishedRootOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER)
    );
  };

  const roots = publishedRootIds
    .map((id) => nodesById.get(id))
    .filter((root): root is MutableCategory => Boolean(root))
    .sort(compareRootOrder);
  if (roots.length === 0) {
    return { snapshot: null, discardedRows, validationWarnings };
  }

  roots.forEach((root) => {
    finalizeCounts(root);
    sortChildrenByPosition(root);
  });

  return {
    snapshot: {
      roots,
      byId,
      byFacetValue,
      countsById,
    },
    discardedRows,
    validationWarnings,
  };
}
