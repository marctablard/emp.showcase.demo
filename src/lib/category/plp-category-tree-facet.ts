import type { Category } from '@/platform/services/model/category';
import {
  BATTERY_INCLUDED_BREADCRUMB_FILTER,
  getBatteryIncludedCategoryMetadata,
} from '@/platform/services/model/category/batteryincluded-category';
import type { BatteryIncludedFacet } from '@/platform/services/model/common';
import { walkCategoryTree } from './category-tree-utils';
import type { PlpBreadcrumbRow, PlpCategoryContext } from './plp-category-context';

type PlpCategoryTreeFacet = Extract<BatteryIncludedFacet, { kind: 'tree' }>;
type PlpCategorySelectFacet = Extract<BatteryIncludedFacet, { kind: 'select' }>;

interface TreeNode {
  key: string;
  id: string;
  label: string;
  directCount: number;
  totalCount: number;
  children: TreeNode[];
  parent?: TreeNode;
  staticCategory?: Category;
}

interface NormalizedFacetOption {
  idPath: string[];
  labelPath: string[];
  count?: number;
}

export interface ResolvedPlpCategoryTreeFacetContext {
  plpCategoryContext: PlpCategoryContext;
  categoryCountsById: Record<string, number>;
  selectedCategoryFound: boolean;
}

function buildStaticCategoryIndex(roots: readonly Category[] | undefined): Record<string, Category> {
  const index: Record<string, Category> = {};

  walkCategoryTree(roots, (node) => {
    index[node.id] = node;
  });

  return index;
}

function buildTreeNodes(options: readonly NormalizedFacetOption[], staticCategoryById: Record<string, Category>) {
  const rootNodes: TreeNode[] = [];
  const nodeIndex = new Map<string, TreeNode>();
  const nodeById = new Map<string, TreeNode>();

  options.forEach((option) => {
    let parentNode: TreeNode | undefined;

    option.idPath.forEach((pathId, index) => {
      const key = option.idPath.slice(0, index + 1).join('>');
      const existingNode = nodeIndex.get(key);

      if (existingNode) {
        if (existingNode.label === existingNode.id && option.labelPath[index]) {
          existingNode.label = option.labelPath[index];
        }
        parentNode = existingNode;
        return;
      }

      const nextNode: TreeNode = {
        key,
        id: pathId,
        label: option.labelPath[index] ?? pathId,
        directCount: 0,
        totalCount: 0,
        children: [],
        parent: parentNode,
        staticCategory: staticCategoryById[pathId],
      };

      nodeIndex.set(key, nextNode);
      nodeById.set(pathId, nextNode);

      if (parentNode) {
        parentNode.children.push(nextNode);
      } else {
        rootNodes.push(nextNode);
      }

      parentNode = nextNode;
    });

    const leafNode = nodeIndex.get(option.idPath.join('>'));
    if (leafNode && option.count !== undefined) {
      // Store the count strictly on this node
      leafNode.directCount = option.count;
    }
  });

  const countsById: Record<string, number> = {};

  // Use map to just collect the counts that exist for each node
  const finalizeCounts = (node: TreeNode) => {
    // Only populate `countsById` if this exact node was represented by an option
    // By only using `directCount`, we do NOT sum descendants
    if (node.directCount > 0) {
      countsById[node.id] = node.directCount;
    }
    // No recursive summation needed for count anymore, just traverse
    node.children.forEach((child) => finalizeCounts(child));
  };

  rootNodes.forEach(finalizeCounts);

  return { rootNodes, nodeById, countsById };
}

function toCategory(node: TreeNode, locale: string): Category {
  const localizedName = {
    ...(node.staticCategory?.name ?? {}),
    [locale]: node.label,
  };

  const children = node.children.map((child) => toCategory(child, locale));

  if (node.staticCategory) {
    return {
      ...node.staticCategory,
      name: localizedName,
      children,
    };
  }

  return {
    id: node.id,
    name: localizedName,
    children,
  };
}

function buildAncestorTrail(node: TreeNode, locale: string): PlpBreadcrumbRow[] {
  const ancestors: TreeNode[] = [];
  let current: TreeNode | undefined = node.parent;

  while (current) {
    ancestors.push(current);
    current = current.parent;
  }

  return [
    { kind: 'virtual-all-products' },
    ...ancestors.reverse().map((ancestor) => ({ kind: 'category' as const, category: toCategory(ancestor, locale) })),
  ];
}

export function resolvePlpCategoryTreeFacetContext(
  facets: readonly BatteryIncludedFacet[] | undefined,
  navigationRoots: readonly Category[] | undefined,
  selectedCategoryId: string | undefined,
  locale: string,
): ResolvedPlpCategoryTreeFacetContext | undefined {
  const breadcrumbFacet = facets?.find(
    (facet) => (facet.kind === 'tree' || facet.kind === 'select') && facet.id === BATTERY_INCLUDED_BREADCRUMB_FILTER,
  );

  if (!breadcrumbFacet || breadcrumbFacet.options.length === 0) {
    return undefined;
  }

  const staticCategoryById = buildStaticCategoryIndex(navigationRoots);

  let normalizedOptions: NormalizedFacetOption[] = [];

  if (breadcrumbFacet.kind === 'tree') {
    normalizedOptions = (breadcrumbFacet as PlpCategoryTreeFacet).options.map((opt) => ({
      idPath: opt.idPath,
      labelPath: opt.labelPath,
      count: opt.count,
    }));
  } else if (breadcrumbFacet.kind === 'select') {
    // Build index of static categories by displayPath/facetValue
    const categoryByDisplayPath = new Map<string, { idPath: string[]; labelPath: string }>();
    Object.values(staticCategoryById).forEach((cat) => {
      const meta = getBatteryIncludedCategoryMetadata(cat);
      if (meta && (meta.facetValue || meta.displayPath)) {
        categoryByDisplayPath.set(meta.facetValue || meta.displayPath || '', {
          idPath: meta.idPath,
          labelPath: meta.labelPath,
        });
      }
    });

    normalizedOptions = (breadcrumbFacet as PlpCategorySelectFacet).options
      .map((opt) => {
        const displayPathValue = opt.id; // or opt.label, they represent the same display path in this case
        const mapped = categoryByDisplayPath.get(displayPathValue);
        if (!mapped) return undefined;

        return {
          idPath: mapped.idPath,
          labelPath: mapped.labelPath.split(' > ').map((s) => s.trim()),
          count: opt.count,
        };
      })
      .filter((opt): opt is NormalizedFacetOption => opt !== undefined);

    if (normalizedOptions.length === 0) {
      return undefined;
    }
  }

  const { rootNodes, nodeById, countsById } = buildTreeNodes(normalizedOptions, staticCategoryById);
  const selectedNode = selectedCategoryId ? nodeById.get(selectedCategoryId) : undefined;

  const currentChildrenNodes = selectedNode ? selectedNode.children : rootNodes;
  const ribbonNodes = selectedNode
    ? selectedNode.children.length > 0
      ? selectedNode.children
      : (selectedNode.parent?.children ?? rootNodes)
    : rootNodes;

  const plpCategoryContext: PlpCategoryContext = {
    ancestorTrail: selectedNode ? buildAncestorTrail(selectedNode, locale) : [],
    currentCategory: selectedNode ? toCategory(selectedNode, locale) : undefined,
    currentChildren: currentChildrenNodes.map((node) => toCategory(node, locale)),
    ribbonCategories: ribbonNodes.map((node) => toCategory(node, locale)),
    sidebarCountCategoryIds: selectedNode
      ? [selectedNode.id, ...selectedNode.children.map((child) => child.id)]
      : rootNodes.map((node) => node.id),
  };

  return {
    plpCategoryContext,
    categoryCountsById: countsById,
    selectedCategoryFound: selectedCategoryId ? Boolean(selectedNode) : true,
  };
}
