import type { ComponentType, HTMLAttributes } from 'react';
import type { CMSComponent, CMSNavigation, CMSNoResult, CMSPage } from '../model/cms';

/**
 * Plugin SPI for CMS providers (Storyblok, local-JSON, none, ...).
 *
 * Implementations are bound via DI with id `CmsAdapter:<provider-id>`. The
 * active adapter is alias-bound to `CmsAdapter` by `CmsProviderResolver`
 * at bootstrap. `DelegatingCmsServiceSSR` delegates `CMSService`-calls to
 * it.
 *
 * The required surface is intentionally small: identity, presence check,
 * page + navigation accessors. Accessor methods never reject for missing
 * content — they surface "no result" as `{ notfound: true }` instead.
 *
 * Optional surface (`getEditableProps`, `BridgeScript`) is reserved for
 * provider-side editing concerns (e.g. Storyblok Visual Editor). When an
 * adapter omits it, the `DelegatingCmsServiceSSR` facade falls back to
 * sensible defaults (`{}` / `null`).
 */
export interface CmsAdapter {
  readonly id: string;
  hasContent(): boolean;
  /**
   * `site` is a hint, not a directive. Adapters may use it (Storyblok prefixes
   * the slug with it for multi-site spaces), or override it from a more
   * authoritative source (LocalJsonCmsAdapter consults `SessionService`).
   * Adapters MUST NOT reject when the hint disagrees with their authoritative
   * source — they pick the right one and continue.
   */
  getPage(slug: string, locale: string, site: string): Promise<CMSPage | CMSNoResult>;
  getNavigation(locale: string, site: string): Promise<CMSNavigation | CMSNoResult>;
  /** Optional. Plain DOM attributes, NO wrapper tag. */
  getEditableProps?(component: CMSComponent): HTMLAttributes<HTMLElement>;
  /** Optional. Mounted once in the layout. */
  BridgeScript?: ComponentType;
}
