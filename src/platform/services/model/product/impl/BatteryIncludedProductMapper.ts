import { inject } from 'inversify';
import { getPublicDefaultCurrency } from '@/lib/common/public-default-env';
import { injectable } from '@/platform/core/di/injectable';
import type { BatteryIncludedProduct } from '@/platform/integrations/batteryincluded/model/product';
import type { EmporixProduct } from '@/platform/integrations/emporix/model';
import { BATTERY_INCLUDED_BREADCRUMB_FILTER } from '@/platform/services/model/category/batteryincluded-category';
import type { Product as ServiceProduct } from '@/platform/services/model/product';
import type { LocalizedString, Price } from '../../common';
import type { CategorySuggestion, SearchSuggestions } from '../../search/SearchSuggestions';
import type { SuggestionsMapper } from '../../search/SuggestionsMapper';
import type { ProductMapper } from '../ProductMapper';
import type { Product } from '../index';
import type { EmporixProductMapper } from './EmporixProductMapper';
import { normalizeLocalizedHighlights } from './normalizeLocalizedHighlights';
import { normalizeProductAttributeStringMap } from './normalizeProductAttributeStringMap';

const BATTERY_INCLUDED_SELECTION_CONTEXT_KEY = '__batteryIncludedSelection';

/**
 * Maps BatteryIncluded API product format to internal Product model.
 * Since BatteryIncluded uses Emporix as its data source, we can delegate
 * the mapping to the EmporixProductMapper.
 */
@injectable('BatteryIncludedProductMapper', 'Singleton')
class BatteryIncludedProductMapper implements ProductMapper<BatteryIncludedProduct>, SuggestionsMapper {
  constructor(@inject('EmporixProductMapper') private emporixMapper: EmporixProductMapper) {}

  private isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0;
  }

  private mapLocalizedString(value: unknown): LocalizedString | undefined {
    if (Array.isArray(value)) {
      const localizedValue = value.reduce<LocalizedString>((accumulator, item) => {
        if (item && typeof item === 'object' && typeof item.language === 'string' && typeof item.value === 'string') {
          accumulator[item.language] = item.value;
        }
        return accumulator;
      }, {});

      return Object.keys(localizedValue).length > 0 ? localizedValue : undefined;
    }

    if (value && typeof value === 'object') {
      const localizedValue = Object.entries(value as Record<string, unknown>).reduce<LocalizedString>(
        (accumulator, [key, item]) => {
          if (typeof item === 'string') {
            accumulator[key] = item;
          }
          return accumulator;
        },
        {},
      );

      return Object.keys(localizedValue).length > 0 ? localizedValue : undefined;
    }

    return undefined;
  }

  private mapLocalizedLeaf(value: unknown): string | LocalizedString | undefined {
    if (this.isNonEmptyString(value)) {
      return value;
    }

    return this.mapLocalizedString(value);
  }

  private isBcp47LocaleKey(key: string): boolean {
    return /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(key);
  }

  /**
   * Catalog display name from `_product_i18n` only.
   * Flattened hits keep `mapLocalizedLeaf` on the leaf `name`.
   * Locale-map hits (`Map<lang, { name }>`) collect those names into a LocalizedString.
   */
  private mapCatalogI18nName(product: BatteryIncludedProduct): string | LocalizedString | undefined {
    const localizedProduct = this.getLocalizedProduct(product);
    const flattenedName = this.mapLocalizedLeaf(localizedProduct.name);
    if (flattenedName !== undefined) {
      return flattenedName;
    }

    const localeMapNames = Object.entries(localizedProduct).reduce<LocalizedString>((accumulator, [key, item]) => {
      if (!this.isBcp47LocaleKey(key) || !item || typeof item !== 'object' || Array.isArray(item)) {
        return accumulator;
      }

      const localeName = this.mapLocalizedLeaf((item as Record<string, unknown>).name);
      if (this.isNonEmptyString(localeName)) {
        accumulator[key] = localeName;
      }
      return accumulator;
    }, {});

    return Object.keys(localeMapNames).length > 0 ? localeMapNames : undefined;
  }

  private mapSelectedString(value: unknown): string | undefined {
    return this.isNonEmptyString(value) ? value : undefined;
  }

  private mapLocalizedHighlights(value: unknown): Product['highlights'] {
    return normalizeLocalizedHighlights(value);
  }

  private mergeSiteAwareBranch(documentValue: unknown, highlightedValue: unknown): unknown {
    if (!documentValue || typeof documentValue !== 'object' || Array.isArray(documentValue)) {
      return highlightedValue ?? documentValue;
    }

    if (!highlightedValue || typeof highlightedValue !== 'object' || Array.isArray(highlightedValue)) {
      return highlightedValue ?? documentValue;
    }

    const mergedBranch: Record<string, unknown> = {
      ...(documentValue as Record<string, unknown>),
      ...(highlightedValue as Record<string, unknown>),
    };

    for (const [key, documentChild] of Object.entries(documentValue as Record<string, unknown>)) {
      const highlightedChild = (highlightedValue as Record<string, unknown>)[key];
      mergedBranch[key] = this.mergeSiteAwareBranch(documentChild, highlightedChild);
    }

    return mergedBranch;
  }

  private toLocalizedString(value: unknown): LocalizedString {
    if (Array.isArray(value)) {
      return value.reduce<LocalizedString>((accumulator, item) => {
        if (item && typeof item.language === 'string' && typeof item.value === 'string') {
          accumulator[item.language] = item.value;
        }
        return accumulator;
      }, {});
    }

    if (value && typeof value === 'object') {
      return Object.entries(value as Record<string, unknown>).reduce<LocalizedString>((accumulator, [key, item]) => {
        if (typeof item === 'string') {
          accumulator[key] = item;
        }
        return accumulator;
      }, {});
    }

    if (typeof value === 'string' && value.length > 0) {
      return { en: value };
    }

    return {};
  }

  private getRootProduct(product: BatteryIncludedProduct): Record<string, any> {
    return (product._product as Record<string, any> | undefined) ?? product;
  }

  private getLocalizedProduct(product: BatteryIncludedProduct): Record<string, any> {
    return (product._product_i18n as Record<string, any> | undefined) ?? {};
  }

  private isSiteAwareContainer(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const branch = value as Record<string, unknown>;

    return 'availability' in branch || 'currencyAware' in branch || 'countryAware' in branch;
  }

  private getSiteAwareProduct(product: BatteryIncludedProduct): Record<string, any> {
    const siteAwareProduct = (product._product_siteAware as Record<string, any> | undefined) ?? {};

    if (this.isSiteAwareContainer(siteAwareProduct)) {
      return siteAwareProduct;
    }

    const siteBranches = Object.values(siteAwareProduct).filter((branchValue): branchValue is Record<string, unknown> =>
      this.isSiteAwareContainer(branchValue),
    );

    return siteBranches.length === 1 ? siteBranches[0] : siteAwareProduct;
  }

  private getMedia(product: BatteryIncludedProduct): any[] {
    const rootProduct = this.getRootProduct(product);
    const media = rootProduct.media ?? product.media ?? product.medias;
    return Array.isArray(media) ? media : [];
  }

  private getBranchPrices(value: unknown): Record<string, any>[] {
    if (!value) {
      return [];
    }

    if (Array.isArray(value)) {
      return value.filter((price): price is Record<string, any> => Boolean(price && typeof price === 'object'));
    }

    if (typeof value === 'object') {
      return [value as Record<string, any>];
    }

    return [];
  }

  private getBestBranchPrice(value: unknown): Record<string, any> | undefined {
    const prices = this.getBranchPrices(value);

    if (prices.length === 0) {
      return undefined;
    }

    return prices.reduce((bestPrice, price) => {
      if (
        price.effectiveAmount !== undefined &&
        (bestPrice.effectiveAmount === undefined || price.effectiveAmount < bestPrice.effectiveAmount)
      ) {
        return price;
      }

      return bestPrice;
    }, prices[0]);
  }

  private getPriceFromPriceArray(value: unknown, currency?: string): Record<string, any> | undefined {
    if (currency) {
      return this.getBranchPrices(value).find((price) => price.currency === currency);
    }

    return this.getBestBranchPrice(value);
  }

  private getDirectBranchPrice(value: unknown): Record<string, any> | undefined {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      return undefined;
    }

    return value as Record<string, any>;
  }

  private getPriceFromCountryAwareBranch(value: unknown, currency?: string): Record<string, any> | undefined {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const branch = value as Record<string, unknown>;
    const directPrice = this.getDirectBranchPrice(branch.price) ?? this.getPriceFromPriceArray(branch.prices, currency);
    if (directPrice) {
      return directPrice;
    }

    for (const nestedBranch of Object.values(branch)) {
      if (!nestedBranch || typeof nestedBranch !== 'object') {
        continue;
      }

      const nestedBranchObj = nestedBranch as Record<string, unknown>;
      const nestedPrice =
        this.getDirectBranchPrice(nestedBranchObj.price) ??
        this.getPriceFromPriceArray(nestedBranchObj.prices, currency);
      if (nestedPrice) {
        return nestedPrice;
      }
    }

    return undefined;
  }

  private getDirectPriceFromCountryAwareBranch(value: unknown): Record<string, any> | undefined {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const branch = value as Record<string, unknown>;
    const directPrice = this.getDirectBranchPrice(branch.price) ?? this.getDirectBranchPrice(branch.prices);
    if (directPrice) {
      return directPrice;
    }

    for (const nestedBranch of Object.values(branch)) {
      if (!nestedBranch || typeof nestedBranch !== 'object') {
        continue;
      }

      const nestedBranchObj = nestedBranch as Record<string, unknown>;
      const nestedPrice =
        this.getDirectBranchPrice(nestedBranchObj.price) ?? this.getDirectBranchPrice(nestedBranchObj.prices);
      if (nestedPrice) {
        return nestedPrice;
      }
    }

    return undefined;
  }

  private getPriceMatchingCurrencyFromCountryAwareBranch(
    value: unknown,
    currency: string,
  ): Record<string, any> | undefined {
    return this.getPriceFromCountryAwareBranch(value, currency);
  }

  private getSelectionContext(product: BatteryIncludedProduct): { siteAware?: string; currencyAware?: string } {
    const selectionContext = product[BATTERY_INCLUDED_SELECTION_CONTEXT_KEY];

    if (!selectionContext || typeof selectionContext !== 'object') {
      return {};
    }

    const branch = selectionContext as Record<string, unknown>;

    return {
      siteAware: this.mapSelectedString(branch.siteAware),
      currencyAware: this.mapSelectedString(branch.currencyAware),
    };
  }

  private matchesSelectedCurrency(priceData: Record<string, any>, product: BatteryIncludedProduct): boolean {
    const { currencyAware } = this.getSelectionContext(product);

    return !currencyAware || priceData.currency === currencyAware;
  }

  private getSelectedSiteAwareProduct(
    product: BatteryIncludedProduct,
    selectedSite?: string,
  ): Record<string, unknown> | undefined {
    const siteAwareProduct = (product._product_siteAware as Record<string, unknown> | undefined) ?? {};

    if (selectedSite) {
      const explicitSiteBranch = siteAwareProduct[selectedSite];
      if (explicitSiteBranch && typeof explicitSiteBranch === 'object') {
        return explicitSiteBranch as Record<string, unknown>;
      }
    }

    return this.isSiteAwareContainer(siteAwareProduct) ? siteAwareProduct : this.getSiteAwareProduct(product);
  }

  private getContextualExplicitCurrencyBranchPrice(product: BatteryIncludedProduct): Record<string, any> | undefined {
    const { siteAware, currencyAware } = this.getSelectionContext(product);

    if (!currencyAware) {
      return undefined;
    }

    const selectedSiteAwareProduct = this.getSelectedSiteAwareProduct(product, siteAware);
    if (!selectedSiteAwareProduct) {
      return undefined;
    }

    const explicitCurrencyAware = selectedSiteAwareProduct.currencyAware as Record<string, unknown> | undefined;
    const explicitCurrencyBranch = explicitCurrencyAware?.[currencyAware];
    if (!explicitCurrencyBranch || typeof explicitCurrencyBranch !== 'object') {
      return undefined;
    }

    return this.getPriceMatchingCurrencyFromCountryAwareBranch(
      (explicitCurrencyBranch as Record<string, unknown>).countryAware ?? explicitCurrencyBranch,
      currencyAware,
    );
  }

  private getSingleLegacyAwareBranch(siteAwareProduct: Record<string, unknown>): Record<string, unknown> | undefined {
    const candidateBranches = Object.entries(siteAwareProduct)
      .filter(
        ([branchKey]) => branchKey !== 'availability' && branchKey !== 'currencyAware' && branchKey !== 'countryAware',
      )
      .map(([, branchValue]) => branchValue)
      .filter((branchValue): branchValue is Record<string, unknown> =>
        Boolean(branchValue && typeof branchValue === 'object'),
      );

    if (candidateBranches.length !== 1) {
      return undefined;
    }

    return candidateBranches[0];
  }

  private getSingleExplicitCurrencyAwareBranch(
    siteAwareProduct: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    const currencyAware = siteAwareProduct.currencyAware;
    if (!currencyAware || typeof currencyAware !== 'object') {
      return undefined;
    }

    const candidateBranches = Object.entries(currencyAware as Record<string, unknown>)
      .filter(([branchKey]) => branchKey !== 'countryAware')
      .map(([, branchValue]) => branchValue)
      .filter((branchValue): branchValue is Record<string, unknown> =>
        Boolean(branchValue && typeof branchValue === 'object'),
      );

    if (candidateBranches.length !== 1) {
      return undefined;
    }

    return candidateBranches[0];
  }

  private hasFlattenedCurrencyAwareCountryBranch(siteAwareProduct: Record<string, unknown>): boolean {
    const currencyAware = siteAwareProduct.currencyAware;

    return Boolean(currencyAware && typeof currencyAware === 'object' && 'countryAware' in currencyAware);
  }

  private getPriceData(product: BatteryIncludedProduct): Record<string, any> | undefined {
    const rootProduct = this.getRootProduct(product);
    const siteAwareProduct = this.getSiteAwareProduct(product);
    const { currencyAware } = this.getSelectionContext(product);

    const contextualExplicitCurrencyBranch = this.getContextualExplicitCurrencyBranchPrice(product);
    if (contextualExplicitCurrencyBranch) {
      return contextualExplicitCurrencyBranch;
    }

    const flattenedDirectCurrencyBranch = currencyAware
      ? this.getPriceMatchingCurrencyFromCountryAwareBranch(siteAwareProduct.currencyAware?.countryAware, currencyAware)
      : this.getPriceFromCountryAwareBranch(siteAwareProduct.currencyAware?.countryAware);
    if (flattenedDirectCurrencyBranch) {
      return flattenedDirectCurrencyBranch;
    }

    const selectedCountryBranch = currencyAware
      ? this.getPriceMatchingCurrencyFromCountryAwareBranch(siteAwareProduct.countryAware, currencyAware)
      : this.getDirectPriceFromCountryAwareBranch(siteAwareProduct.countryAware);
    if (selectedCountryBranch) {
      return selectedCountryBranch;
    }

    const selectedExplicitCurrencyBranch = this.hasFlattenedCurrencyAwareCountryBranch(siteAwareProduct)
      ? undefined
      : this.getSingleExplicitCurrencyAwareBranch(siteAwareProduct);
    if (selectedExplicitCurrencyBranch) {
      const explicitCurrencyBranchPrice = this.getPriceFromCountryAwareBranch(
        selectedExplicitCurrencyBranch.countryAware ?? selectedExplicitCurrencyBranch,
        currencyAware,
      );
      if (explicitCurrencyBranchPrice) {
        return explicitCurrencyBranchPrice;
      }
    }

    const singleLegacyAwareBranch = this.getSingleLegacyAwareBranch(siteAwareProduct);
    if (singleLegacyAwareBranch) {
      const legacyBranchPrice = this.getPriceFromCountryAwareBranch(
        singleLegacyAwareBranch.countryAware ?? singleLegacyAwareBranch,
        currencyAware,
      );
      if (legacyBranchPrice) {
        return legacyBranchPrice;
      }
    }

    if (rootProduct.price) {
      return rootProduct.price;
    }

    if (Array.isArray(rootProduct.prices) && rootProduct.prices.length > 0) {
      return this.getPriceFromPriceArray(rootProduct.prices, currencyAware);
    }

    return undefined;
  }

  private mapAvailability(product: BatteryIncludedProduct, productId: string): Product['availability'] {
    const availability = this.getSiteAwareProduct(product).availability as Record<string, any> | undefined;
    if (!availability) {
      return undefined;
    }

    const stockLevel = Number(availability.stockLevel);
    const availableQuantity = Number.isFinite(stockLevel) ? stockLevel : 0;

    return {
      productId,
      availableQuantity,
      availableInDays: null,
      isAvailable: typeof availability.available === 'boolean' ? availability.available : availableQuantity > 0,
    };
  }

  private mapBrand(product: BatteryIncludedProduct): Product['brand'] {
    const rootProduct = this.getRootProduct(product);
    const localizedBrand = this.getLocalizedProduct(product).brand as Record<string, any> | undefined;
    const brandName = this.mapLocalizedLeaf(localizedBrand?.name);

    const brandId = localizedBrand?.id ?? rootProduct.brandId;
    if (!brandId) {
      return undefined;
    }

    return {
      id: String(brandId),
      ...(brandName ? { name: brandName } : {}),
      ...(localizedBrand?.mediaUrl
        ? {
            logo: {
              url: localizedBrand.mediaUrl,
              ...(brandName ? { altText: brandName } : {}),
            },
          }
        : {}),
    };
  }

  private mapLabels(product: BatteryIncludedProduct): Product['labels'] {
    const localizedLabels = this.getLocalizedProduct(product).labels;
    if (Array.isArray(localizedLabels) && localizedLabels.length > 0) {
      return localizedLabels
        .filter((label): label is Record<string, any> => Boolean(label?.id))
        .map((label) => ({
          id: String(label.id),
          ...(this.mapSelectedString(label.name) ? { name: this.mapSelectedString(label.name) } : {}),
          ...(label.mediaUrl ? { image: label.mediaUrl } : {}),
          ...(this.mapLocalizedLeaf(label.description)
            ? { description: this.mapLocalizedLeaf(label.description) }
            : {}),
        }));
    }

    return undefined;
  }

  private mapHighlights(product: BatteryIncludedProduct): Product['highlights'] {
    const localizedProduct = this.getLocalizedProduct(product);
    const localizedHighlightsData = localizedProduct.mixins?.highlights?.highlights ?? localizedProduct.highlights;

    return this.mapLocalizedHighlights(localizedHighlightsData);
  }

  private mergeI18nSpecifications(
    mergedMixins: Record<string, unknown>,
    i18nMixins: Record<string, unknown> | undefined,
  ): void {
    if (!i18nMixins?.specifications) {
      return;
    }

    const i18nSpecs = (i18nMixins.specifications as Record<string, unknown>).specifications;
    const rootSpecsObj = mergedMixins.specifications as Record<string, unknown> | undefined;
    const rootSpecs = rootSpecsObj?.specifications;

    if (!Array.isArray(i18nSpecs)) {
      // If i18n isn't array, gently assign if base didn't exist or just let it pass
      if (!mergedMixins.specifications) {
        mergedMixins.specifications = i18nMixins.specifications;
      }
      return;
    }

    const mergedSpecsTemp = Array.isArray(rootSpecs) ? [...rootSpecs] : [];

    i18nSpecs.forEach((i18nSpec) => {
      if (!i18nSpec || typeof i18nSpec !== 'object') {
        mergedSpecsTemp.push(i18nSpec);
        return;
      }

      const specObj = i18nSpec as Record<string, unknown>;
      // Drop pure grouping shells (only groupLabel, no key/value/label) so they do not
      // become phantom blank specs. Keep key-less value-only specs (e.g. suggest documents).
      if (!specObj.key && specObj.value === undefined && specObj.label === undefined) {
        return;
      }

      const existingSpecIndex = mergedSpecsTemp.findIndex(
        (s) => s && typeof s === 'object' && s.key && s.key === specObj.key,
      );

      // Normalize the i18n value as it can be a plain string
      const normalizedSpec = { ...specObj };
      if (typeof specObj.value === 'string') {
        normalizedSpec.value = [{ language: 'en', value: specObj.value }];
      }

      if (existingSpecIndex !== -1) {
        mergedSpecsTemp[existingSpecIndex] = {
          ...mergedSpecsTemp[existingSpecIndex],
          ...normalizedSpec,
        };
      } else {
        mergedSpecsTemp.push(normalizedSpec);
      }
    });

    mergedMixins.specifications = { specifications: mergedSpecsTemp };
  }

  private synthesizeVariantAttributesFromMixins(
    rootProduct: Record<string, any>,
  ): EmporixProduct['variantAttributes'] | undefined {
    // W1: Synthesize minimal variant-attribute structures from _product.mixins.productVariantAttributes
    // Chips are intentionally single-value per attribute for BI in this iteration;
    // PARENT_VARIANT hits without mixins.productVariantAttributes produce empty variantAttributes by design.
    // DYNAMIC_VARIANT uses own/inherited tree attributes — do not invent classic array-of-keys axes.
    if (rootProduct.productType === 'DYNAMIC_VARIANT') {
      return undefined;
    }
    if (rootProduct.variantAttributes) {
      return rootProduct.variantAttributes as EmporixProduct['variantAttributes'];
    }

    const pva = rootProduct.mixins?.productVariantAttributes as Record<string, unknown> | undefined;
    if (!pva) {
      return undefined;
    }

    const synthesized: NonNullable<EmporixProduct['variantAttributes']> = {};
    for (const [key, value] of Object.entries(pva)) {
      const isScalarVariantValue =
        (typeof value === 'string' && value.trim() !== '') ||
        (typeof value === 'number' && Number.isFinite(value)) ||
        typeof value === 'boolean';
      if (isScalarVariantValue) {
        synthesized[key] = [{ key: value }];
      }
    }
    return synthesized;
  }

  private normalizeEmporixSource(product: BatteryIncludedProduct): EmporixProduct {
    const rootProduct = this.getRootProduct(product);
    const localizedProduct = this.getLocalizedProduct(product);
    const localizedName = this.mapCatalogI18nName(product);
    const localizedDescription = this.mapLocalizedLeaf(localizedProduct.description);

    const mergedMixins = { ...(rootProduct.mixins as Record<string, unknown> | undefined) };
    this.mergeI18nSpecifications(mergedMixins, localizedProduct.mixins as Record<string, unknown> | undefined);

    const normalizedSource: EmporixProduct = {
      ...(rootProduct as EmporixProduct),
      mixins: mergedMixins as EmporixProduct['mixins'],
      id: product.id ?? rootProduct.id ?? rootProduct.code,
      code: rootProduct.code ?? product.code ?? product.id,
      name: localizedName ?? rootProduct.name ?? '',
      description: localizedDescription ?? rootProduct.description ?? '',
      media: this.getMedia(product),
      brandId: localizedProduct.brand?.id ?? rootProduct.brandId,
      labelIds:
        Array.isArray(localizedProduct.labels) && localizedProduct.labels.length > 0
          ? localizedProduct.labels.map((label: Record<string, any>) => label.id).filter(Boolean)
          : rootProduct.labelIds,
    };

    const synthesizedVariantAttributes = this.synthesizeVariantAttributesFromMixins(rootProduct);
    if (synthesizedVariantAttributes) {
      if (normalizedSource.productType === 'VARIANT') {
        normalizedSource.parentVariant = {
          ...(normalizedSource.parentVariant || ({} as EmporixProduct)),
          variantAttributes: synthesizedVariantAttributes,
        };
      } else {
        normalizedSource.variantAttributes = synthesizedVariantAttributes;
      }
    }

    return normalizedSource;
  }

  /**
   * Maps a BatteryIncluded product to the internal Product model by delegating to EmporixProductMapper
   * @param product - The BatteryIncluded product data
   * @returns The internal Product model
   */
  mapToService(product: BatteryIncludedProduct): ServiceProduct {
    const rootProduct = this.getRootProduct(product);
    const localizedProduct = this.getLocalizedProduct(product);
    const localizedName = this.mapCatalogI18nName(product);
    const localizedDescription = this.mapLocalizedLeaf(localizedProduct.description);
    const normalizedSource = this.normalizeEmporixSource(product);
    const productData = this.emporixMapper.mapToService(normalizedSource);

    const mappedProduct: Product = {
      ...productData,
      id: String(product.id ?? rootProduct.id ?? rootProduct.code ?? productData.id),
      name: localizedName ?? productData.name,
      description: localizedDescription ?? productData.description,
      brand: this.mapBrand(product) ?? productData.brand,
      labels: this.mapLabels(product) ?? productData.labels,
      highlights: this.mapHighlights(product) ?? productData.highlights,
      availability: this.mapAvailability(
        product,
        String(product.id ?? rootProduct.id ?? rootProduct.code ?? productData.id),
      ),
      primaryImage: productData.primaryImage,
      images: productData.images,
    };

    const priceData = this.getPriceData(product);
    if (priceData && this.matchesSelectedCurrency(priceData, product)) {
      mappedProduct.price = this.mapPrice(priceData);
    }

    const mixins = rootProduct.mixins ?? product.mixins;
    const productDataWithMixins = this.mapProductMixins(mixins, mappedProduct);

    return productDataWithMixins;
  }

  /**
   * Maps an internal Product model back to BatteryIncluded product format
   * @param service - The internal Product model
   * @returns The BatteryIncluded product data
   */
  mapToSource(service: ServiceProduct): BatteryIncludedProduct {
    // Delegate to EmporixProductMapper since they share the same structure
    // custom modifications can be included here
    const result = this.emporixMapper.mapToSource(service);
    return {
      ...result,
      medias: service.images ? service.images : [],
    };
  }

  /**
   * Maps query completions from the API response
   * @param item - The query completion item from the API response
   * @returns Array of query completion strings
   */
  mapQueryCompletions(item: any): string[] {
    const completions: string[] = [];

    if (item && item.kind === 'query-completion' && Array.isArray(item.hits)) {
      item.hits.forEach((hit: any) => {
        if (hit && hit.value) {
          completions.push(hit.value);
        }
      });
    }

    return completions;
  }

  /**
   * Maps category suggestions from the API response
   * @param item - The category facet item from the API response
   * @returns Array of category suggestions
   */
  mapCategorySuggestions(item: any): CategorySuggestion[] {
    const categories: CategorySuggestion[] = [];

    if (
      item &&
      (item.field_name === BATTERY_INCLUDED_BREADCRUMB_FILTER ||
        item.kind === `facet.${BATTERY_INCLUDED_BREADCRUMB_FILTER}`) &&
      Array.isArray(item.hits)
    ) {
      item.hits.forEach((hit: any) => {
        if (hit && hit.value) {
          categories.push({
            name: hit.value,
            highlighted: hit.highlighted ?? hit.value,
            count: hit.count ?? 1,
            idPath: hit.data?.idPath,
          });
        }
      });
    }

    return categories;
  }

  private mergeSuggestionProduct(hit: any): BatteryIncludedProduct | undefined {
    if (!hit?.highlighted && !hit?.document) {
      return undefined;
    }

    const documentProduct = hit.document ?? {};
    const highlightedProduct = hit.highlighted ?? {};

    return {
      ...documentProduct,
      ...highlightedProduct,
      _product: {
        ...((documentProduct._product as Record<string, unknown> | undefined) ?? {}),
        ...((highlightedProduct._product as Record<string, unknown> | undefined) ?? {}),
      },
      _product_i18n: {
        ...((documentProduct._product_i18n as Record<string, unknown> | undefined) ?? {}),
        ...((highlightedProduct._product_i18n as Record<string, unknown> | undefined) ?? {}),
      },
      _product_siteAware: this.mergeSiteAwareBranch(
        documentProduct._product_siteAware,
        highlightedProduct._product_siteAware,
      ),
    } as BatteryIncludedProduct;
  }

  /**
   * Maps product suggestions from the API response
   * @param item - The document item from the API response
   * @returns Array of product models
   */
  mapProductSuggestions(item: any): ServiceProduct[] {
    const products: ServiceProduct[] = [];

    if (item && item.kind === 'document' && Array.isArray(item.hits)) {
      item.hits.forEach((hit: any) => {
        const suggestionSource = this.mergeSuggestionProduct(hit);

        if (suggestionSource) {
          const product = this.mapToService(suggestionSource);
          const rootProduct = this.getRootProduct(suggestionSource);

          if (!product.price) {
            const { currencyAware } = this.getSelectionContext(suggestionSource);
            let fallbackPrice = undefined;
            if (rootProduct.price) {
              fallbackPrice = rootProduct.price;
            } else if (Array.isArray(rootProduct.prices)) {
              fallbackPrice = this.getPriceFromPriceArray(rootProduct.prices, currencyAware);
            }
            if (fallbackPrice) {
              product.price = this.mapPrice(fallbackPrice);
            }
          }
          products.push(product);
        }
      });
    }

    return products;
  }

  /**
   * Maps the complete API response to a search suggestions object
   * @param apiResponse - The complete API response array
   * @returns Search suggestions object containing query completions, products, and categories
   */
  mapSearchSuggestions(apiResponse: any[]): SearchSuggestions {
    const result: SearchSuggestions = {
      queryCompletions: [],
      products: [],
      categories: [],
    };

    if (!Array.isArray(apiResponse)) {
      return result;
    }

    apiResponse.forEach((item) => {
      if (item.kind === 'query-completion') {
        result.queryCompletions = [...result.queryCompletions, ...this.mapQueryCompletions(item)];
      } else if (item.kind === 'document') {
        result.products = [...result.products, ...this.mapProductSuggestions(item)];
      } else if (
        item.kind?.startsWith('facet.') &&
        (item.field_name === BATTERY_INCLUDED_BREADCRUMB_FILTER ||
          item.kind === `facet.${BATTERY_INCLUDED_BREADCRUMB_FILTER}`)
      ) {
        result.categories = [...result.categories, ...this.mapCategorySuggestions(item)];
      }
    });

    return result;
  }

  /**
   * Maps a price object to extract only effectiveAmount, currency and originalAmount
   * @param priceData - The price data from mixins
   * @returns Simplified price object with only required fields
   */
  mapPrice(priceData: any): Price {
    const tierValues = priceData.priceModel?.tierValues || priceData.tiers;

    return {
      amount: priceData.effectiveAmount || 0,
      currency: priceData.currency || getPublicDefaultCurrency(),
      originalAmount: priceData.originalAmount || priceData.amount || 0,
      ...(tierValues && Array.isArray(tierValues)
        ? {
            tiers: tierValues.map((tier: any) => ({
              id: tier.id || '',
              minQuantity: tier.minQuantity?.quantity !== undefined ? tier.minQuantity.quantity : tier.minQuantity || 0,
              unit: tier.minQuantity?.unitCode || tier.unit,
              price: tier.priceValue !== undefined ? tier.priceValue : tier.price || 0,
            })),
          }
        : {}),
    };
  }

  /**
   * Maps product mixins data to proper Product interface structure
   * @param mixins The source mixins data from API
   * @param product The existing product object to enhance
   * @returns Enhanced product object with mixins data
   */
  mapProductMixins(mixins: any, product: Product): Product {
    if (!mixins) return product;

    // Create a new object to avoid mutating the input
    const enhancedProduct: Product = { ...product };

    if (mixins.usp?.usp) {
      enhancedProduct.usps = mixins.usp.usp.map((usp: any) => ({
        icon: typeof usp.icon === 'string' ? usp.icon : usp.icon != null ? String(usp.icon) : '',
        description: this.toLocalizedString(usp.description),
      }));
    }

    if (mixins.productTemplateAttributes) {
      enhancedProduct.templateAttributes = normalizeProductAttributeStringMap(
        mixins.productTemplateAttributes as Record<string, unknown>,
      );
    }

    if (mixins.productVariantAttributes) {
      enhancedProduct.variantAttributeValues = normalizeProductAttributeStringMap(
        mixins.productVariantAttributes as Record<string, unknown>,
      );
    }

    return enhancedProduct;
  }
}

export default BatteryIncludedProductMapper;
