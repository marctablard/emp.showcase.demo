import {
  SEARCH_SERVICE_ALIAS,
  SUPPORTED_SEARCH_SERVICE_TARGETS,
  generateAliasBindings,
  generateGeneratorAliasBindings,
  resolveGeneratorAliases,
} from './search-service-alias';

describe('resolveGeneratorAliases', () => {
  it('uses dependency aliases when DI_SEARCH_SERVICE is absent', () => {
    const aliases = resolveGeneratorAliases({
      dependencyAliases: [
        { alias: SEARCH_SERVICE_ALIAS, target: 'EmporixSearchService' },
        { alias: 'ProductService', target: 'EmporixProductService' },
      ],
    });

    expect(aliases).toEqual({
      SearchService: 'EmporixSearchService',
      ProductService: 'EmporixProductService',
    });
  });

  it('applies an Emporix override after dependency and extension aliases', () => {
    const aliases = resolveGeneratorAliases({
      dependencyAliases: [{ alias: SEARCH_SERVICE_ALIAS, target: 'BatteryIncludedSearchService' }],
      extensionAliases: {
        SearchService: 'BatteryIncludedSearchService',
        CategoryService: 'ExtensionCategoryService',
      },
      searchServiceOverride: 'EmporixSearchService',
    });

    expect(aliases).toEqual({
      SearchService: 'EmporixSearchService',
      CategoryService: 'ExtensionCategoryService',
    });
  });

  it('applies a Battery Included override after dependency and extension aliases', () => {
    const aliases = resolveGeneratorAliases({
      dependencyAliases: [{ alias: SEARCH_SERVICE_ALIAS, target: 'EmporixSearchService' }],
      extensionAliases: {
        SearchService: 'EmporixSearchService',
        CategoryService: 'ExtensionCategoryService',
      },
      searchServiceOverride: 'BatteryIncludedSearchService',
    });

    expect(aliases).toEqual({
      SearchService: 'BatteryIncludedSearchService',
      CategoryService: 'ExtensionCategoryService',
    });
  });

  it('fails fast for unsupported DI_SEARCH_SERVICE values', () => {
    expect(() =>
      resolveGeneratorAliases({
        dependencyAliases: [{ alias: SEARCH_SERVICE_ALIAS, target: 'EmporixSearchService' }],
        searchServiceOverride: 'UnknownSearchService',
      }),
    ).toThrow(
      `Invalid DI_SEARCH_SERVICE value "UnknownSearchService". Supported values: ${SUPPORTED_SEARCH_SERVICE_TARGETS.join(', ')}`,
    );
  });
});

describe('generateAliasBindings', () => {
  it('skips no-op aliases that already match their targets', () => {
    const aliasBindings = generateAliasBindings({
      SearchService: 'SearchService',
      ProductService: 'EmporixProductService',
    });

    expect(aliasBindings).toBe(
      [
        '',
        '  // Alias: ProductService -> EmporixProductService',
        "  if (container.isBound('EmporixProductService')) {",
        "    if (container.isBound('ProductService')) {",
        "      container.unbind('ProductService');",
        '    }',
        "    container.bind('ProductService').toService('EmporixProductService');",
        '  }',
        '',
      ].join('\n'),
    );
  });
});

describe('generateGeneratorAliasBindings', () => {
  it('emits the default SearchService binding from dependency aliases', () => {
    const aliasBindings = generateGeneratorAliasBindings({
      dependencyAliases: [
        { alias: SEARCH_SERVICE_ALIAS, target: 'BatteryIncludedSearchService' },
        { alias: 'ProductService', target: 'EmporixProductService' },
      ],
    });

    expect(aliasBindings).toContain('  // Alias: SearchService -> BatteryIncludedSearchService');
    expect(aliasBindings).toContain("    container.bind('SearchService').toService('BatteryIncludedSearchService');");
    expect(aliasBindings).toContain("    container.bind('ProductService').toService('EmporixProductService');");
  });

  it('emits the Emporix override after dependency and extension aliases', () => {
    const aliasBindings = generateGeneratorAliasBindings({
      dependencyAliases: [{ alias: SEARCH_SERVICE_ALIAS, target: 'BatteryIncludedSearchService' }],
      extensionAliases: { SearchService: 'BatteryIncludedSearchService' },
      searchServiceOverride: 'EmporixSearchService',
    });

    expect(aliasBindings).toContain('  // Alias: SearchService -> EmporixSearchService');
    expect(aliasBindings).toContain("  if (container.isBound('EmporixSearchService')) {");
    expect(aliasBindings).toContain("    container.bind('SearchService').toService('EmporixSearchService');");
  });

  it('emits the Battery Included override after dependency and extension aliases', () => {
    const aliasBindings = generateGeneratorAliasBindings({
      dependencyAliases: [{ alias: SEARCH_SERVICE_ALIAS, target: 'EmporixSearchService' }],
      extensionAliases: { SearchService: 'EmporixSearchService' },
      searchServiceOverride: 'BatteryIncludedSearchService',
    });

    expect(aliasBindings).toContain('  // Alias: SearchService -> BatteryIncludedSearchService');
    expect(aliasBindings).toContain("  if (container.isBound('BatteryIncludedSearchService')) {");
    expect(aliasBindings).toContain("    container.bind('SearchService').toService('BatteryIncludedSearchService');");
  });

  it('fails fast for unsupported DI_SEARCH_SERVICE values before emitting bindings', () => {
    expect(() =>
      generateGeneratorAliasBindings({
        dependencyAliases: [{ alias: SEARCH_SERVICE_ALIAS, target: 'EmporixSearchService' }],
        searchServiceOverride: 'UnknownSearchService',
      }),
    ).toThrow(
      `Invalid DI_SEARCH_SERVICE value "UnknownSearchService". Supported values: ${SUPPORTED_SEARCH_SERVICE_TARGETS.join(', ')}`,
    );
  });
});
