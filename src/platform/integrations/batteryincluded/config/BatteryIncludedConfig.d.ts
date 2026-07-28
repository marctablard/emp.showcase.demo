export interface BatteryIncludedRuntimeConfig {
  /**
   * API key for the active Battery Included public configuration.
   */
  apiKey: string;

  /**
   * Collection name for the active Battery Included public configuration.
   */
  collection: string;
}

export interface BatteryIncludedConfig {
  /**
   * Base URL for the Battery Included API
   */
  baseUrl: string;

  /**
   * Resolve the active Battery Included runtime configuration from Emporix.
   */
  getRuntimeConfig(): Promise<BatteryIncludedRuntimeConfig>;
}
