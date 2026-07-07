import type {
  BatteryIncludedBrowseVariables,
  BatteryIncludedHighlight,
  BatteryIncludedPreset,
  BatteryIncludedProduct,
  BatteryIncludedSearchParams,
  BatteryIncludedSearchResponse,
  BatteryIncludedSuggestParams,
  BatteryIncludedSuggestion,
  BatteryIncludedVisibilityContext,
} from '../model';

export interface BatteryIncludedCategoryTreeBootstrapParams {
  locale: string;
  siteCode: string;
  country?: string;
  variables?: BatteryIncludedBrowseVariables;
  visibility?: BatteryIncludedVisibilityContext;
}

export interface BatteryIncludedShopApi {
  /**
   * Browse products with optional search query and filters
   * @param query Search query
   * @param page Page number
   * @param pageSize Number of items per page
   * @param locale Locale for localized content
   * @param filters Optional filters to apply
   * @param sort Optional sort parameter
   * @param preset Optional preset ID to use
   */
  browse<T>(params: BatteryIncludedSearchParams<T>): Promise<BatteryIncludedSearchResponse<T>>;

  /**
   * Browse with the grounded category-tree bootstrap contract.
   */
  browseCategoryTreeBootstrap<T>(
    params: BatteryIncludedCategoryTreeBootstrapParams,
  ): Promise<BatteryIncludedSearchResponse<T>>;

  /**
   * Get product suggestions based on a search query
   * @param params Search query plus BI variable context
   */
  suggest(params: BatteryIncludedSuggestParams): Promise<BatteryIncludedSuggestion<BatteryIncludedProduct>[]>;

  /**
   * Get highlighted products
   */
  getHighlights(
    visibility?: BatteryIncludedBrowseVariables | BatteryIncludedVisibilityContext,
  ): Promise<BatteryIncludedHighlight[]>;

  /**
   * Get product recommendations based on a product ID
   * @param id Product ID
   */
  getRecommendations(
    id: string,
    visibility?: BatteryIncludedBrowseVariables | BatteryIncludedVisibilityContext,
  ): Promise<BatteryIncludedProduct[]>;

  /**
   * Get available presets
   */
  getPresets(visibility?: BatteryIncludedBrowseVariables | BatteryIncludedVisibilityContext): Promise<BatteryIncludedPreset[]>;
}
