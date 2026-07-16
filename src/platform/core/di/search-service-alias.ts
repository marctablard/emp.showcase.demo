export interface DependencyAlias {
  alias: string;
  target: string;
}

export const SEARCH_SERVICE_ALIAS = 'SearchService';

export const SUPPORTED_SEARCH_SERVICE_TARGETS = ['EmporixSearchService', 'BatteryIncludedSearchService'] as const;

export type SupportedSearchServiceTarget = (typeof SUPPORTED_SEARCH_SERVICE_TARGETS)[number];

interface ResolveGeneratorAliasesInput {
  dependencyAliases: DependencyAlias[];
  extensionAliases?: Record<string, string>;
  searchServiceOverride?: string | null | undefined;
}

interface GenerateAliasBindingsInput extends ResolveGeneratorAliasesInput {
  comment?: string;
}

function isSupportedSearchServiceTarget(value: string): value is SupportedSearchServiceTarget {
  return SUPPORTED_SEARCH_SERVICE_TARGETS.includes(value as SupportedSearchServiceTarget);
}

export function resolveGeneratorAliases({
  dependencyAliases,
  extensionAliases = {},
  searchServiceOverride,
}: ResolveGeneratorAliasesInput): Record<string, string> {
  const resolvedAliases = dependencyAliases.reduce<Record<string, string>>((accumulator, { alias, target }) => {
    accumulator[alias] = target;
    return accumulator;
  }, {});

  Object.assign(resolvedAliases, extensionAliases);

  const normalizedOverride = searchServiceOverride?.trim();
  if (!normalizedOverride) {
    return resolvedAliases;
  }

  if (!isSupportedSearchServiceTarget(normalizedOverride)) {
    throw new Error(
      `Invalid DI_SEARCH_SERVICE value "${normalizedOverride}". Supported values: ${SUPPORTED_SEARCH_SERVICE_TARGETS.join(', ')}`,
    );
  }

  resolvedAliases[SEARCH_SERVICE_ALIAS] = normalizedOverride;

  return resolvedAliases;
}

export function generateAliasBindings(aliasMap: Record<string, string>, comment: string = 'Alias'): string {
  const entries = Object.entries(aliasMap);
  if (entries.length === 0) {
    return '';
  }

  const aliasLines = entries
    .map(([alias, target]) => {
      if (alias === target) {
        return null;
      }

      return [
        `  // ${comment}: ${alias} -> ${target}`,
        `  if (container.isBound('${target}')) {`,
        `    if (container.isBound('${alias}')) {`,
        `      container.unbind('${alias}');`,
        `    }`,
        `    container.bind('${alias}').toService('${target}');`,
        `  }`,
      ].join('\n');
    })
    .filter((line): line is string => line !== null);

  return aliasLines.length > 0 ? `\n${aliasLines.join('\n\n')}\n` : '';
}

export function generateGeneratorAliasBindings({
  dependencyAliases,
  extensionAliases = {},
  searchServiceOverride,
  comment = 'Alias',
}: GenerateAliasBindingsInput): string {
  const resolvedAliases = resolveGeneratorAliases({
    dependencyAliases,
    extensionAliases,
    searchServiceOverride,
  });

  return generateAliasBindings(resolvedAliases, comment);
}
