/**
 * Raw, Emporix-shaped CMS settings payload. Attributes are parsed from
 * the `CMS_SETTINGS_DATA` mixin of a `STOREFRONT_CMS_SETTINGS` custom
 * entity, with any JSON-encoded TEXT attributes already decoded.
 *
 * Only the attributes consumed by the extension are typed here — the
 * rest (e.g. `shop_urls`, `domain_mappings`, `api_key`,
 * `max_archived_versions`) stay inside the storefront / editor domain.
 */
export interface RawCmsSettings {
  site_fallbacks?: RawSiteFallbackEntry[];
}

/**
 * A single row from the `site_fallbacks` JSON array. Mirrors the schema
 * documented for the editor team so the raw payload can be typed
 * without decoration.
 */
export interface RawSiteFallbackEntry {
  site: string;
  fallback_site?: string | null;
  fallback_locale?: string | null;
}

/**
 * API abstraction for reading the CMS settings entity.
 *
 * Kept deliberately thin so the service layer (which adds caching and
 * per-site indexing) stays free of Emporix-specific details.
 */
export interface EmporixCmsSettingsApi {
  /**
   * Returns the decoded settings payload, or `null` when the tenant
   * has no `STOREFRONT_CMS_SETTINGS` entity.
   *
   * Implementations must **not** throw on a missing entity — a missing
   * settings row is the well-defined "no custom fallbacks" state.
   */
  getSettings(): Promise<RawCmsSettings | null>;
}
