import type { CMSComponent, CMSPage as StorefrontCmsPage } from '@/platform/services/model/cms';

// ---------------------------------------------------------------------------
// CMS Component Definition Types
// ---------------------------------------------------------------------------

/** Supported field types for CMS component props */
export type CMSFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'color'
  | 'url'
  | 'media'
  | 'select'
  | 'object'
  | 'array'
  | 'component'
  /**
   * Searchable category tree picker backed by the `CATEGORY_TREE_RESPONSE`
   * data the editor receives from the storefront. Use with `multiple: true`
   * for a multi-select chip UI.
   */
  | 'category'
  /**
   * SKU input with a magnifying-glass dialog backed by the
   * `PRODUCT_SEARCH_RESPONSE` data the editor receives from the
   * storefront. Stores the selected `sku` as the field value.
   */
  | 'product';

/** Describes a single prop exposed to the CMS editor */
export interface CMSPropDefinition {
  /** Display label in the editor */
  label: string;
  /** Field type used to pick the right editor widget */
  type: CMSFieldType;
  /** Whether the field is required */
  required?: boolean;
  /** Default value for this field */
  defaultValue?: any;
  /** For 'select' fields: available options */
  options?: { label: string; value: string }[];
  /**
   * For 'select' fields: name of a dynamic options source the CMSComponentService
   * knows how to resolve (e.g. 'categories'). When set, `options` is populated
   * at editor-open time via {@link CMSComponentService.resolveDynamicOptions}.
   */
  dynamicOptionsSource?: string;
  /** For 'object' fields: nested prop definitions */
  properties?: Record<string, CMSPropDefinition>;
  /** For 'array' fields: definition of each array item */
  items?: CMSPropDefinition;
  /** For 'media' fields: allowed MIME types (e.g. ['image/*'], ['video/*']). Omit = any media. */
  allowedTypes?: string[];
  /** For 'component' fields: allowed component type(s) that can be nested. Empty = any. */
  allowedComponentTypes?: string[];
  /**
   * For 'component' and 'category' fields: whether the editor should allow
   * multi-selection (default false = single).
   */
  multiple?: boolean;
  /** Reference to a named field definition declared in fieldDefinitions */
  $ref?: string;
}

export interface CMSComponentTypeDefinition {
  type: string;
  label: string;
  description?: string;
  /** Reusable field definitions that can be referenced via $ref in props */
  fieldDefinitions?: Record<string, CMSPropDefinition>;
  /** Typed prop schema — tells the CMS editor which fields exist and how to render them */
  props?: Record<string, CMSPropDefinition>;
  defaultProps?: Record<string, any>;
  allowedComponents?: string[];
}

export interface CMSComponentEntry {
  definition: CMSComponentTypeDefinition;
  mapProps: (cmsProps: Record<string, any>) => Record<string, any>;
  component: React.ComponentType<any>;
  /**
   * Optional theme scoping.
   * - If omitted or empty, the component is theme-neutral and always exposed.
   * - If set, the component is only exposed when the current theme (passed to
   *   {@link CMSComponentService}) matches one of the listed theme identifiers.
   */
  themes?: string[];
}

export interface CMSSlotConfig {
  slotId: string;
  name: string;
  position: number;
  type: 'layout' | 'page';
}

export interface CMSContentSlot {
  id: string;
  name: string;
  layout: boolean; // true = layout slot, false = page slot
}

export interface CMSLayout {
  id: string;
  name: string;
  components: Record<string, CMSComponent[]>;
  contentSlots: CMSContentSlot[];
  version: 'draft' | 'live' | string; // string for timestamp
  base_id?: string;
  author?: string;
}

export interface CMSPage extends StorefrontCmsPage {
  id: string;
  contentSlots: Record<string, CMSComponent[]>;
  version: 'draft' | 'live' | string; // string for timestamp
  base_id: string;
  site: string;
  locale: string;
  author?: string;
  layout?: CMSLayout;
}

// ---------------------------------------------------------------------------
// CMS Editor Message Types (New Simplified Event System)
// ---------------------------------------------------------------------------

/**
 * Unified event for all component operations (add/update/delete/reorder).
 * Replaces: ADD_COMPONENT, UPDATE_COMPONENT, DELETE_COMPONENT, REORDER_COMPONENTS
 */
export interface UpdateSlotMessage {
  type: 'UPDATE_SLOT';
  slots: Array<{
    slotId: string;
    components: CMSComponent[];
  }>;
}

/**
 * Event for slot configuration changes (add/delete/reorder/rename slots).
 * Replaces: LAYOUT_UPDATE
 */
export interface UpdateLayoutMessage {
  type: 'UPDATE_LAYOUT';
  layoutId: string;
  slots: CMSSlotConfig[];
}

/**
 * Event for page metadata updates.
 */
export interface UpdateMetadataMessage {
  type: 'UPDATE_METADATA';
  metadata: {
    title: string;
    description: string;
    slug: string;
    url: string;
  };
}

/**
 * Request component types from storefront.
 */
export interface RequestComponentTypesMessage {
  type: 'REQUEST_COMPONENT_TYPES';
}

/**
 * Response with component types (renamed from COMPONENT_TYPES_RESPONSE).
 */
export interface ComponentTypesMessage {
  type: 'COMPONENT_TYPES';
  componentTypes: CMSComponentTypeDefinition[];
}

/**
 * Hierarchical category node consumed by the CMS editor
 * (autocomplete fields, category pickers, validation).
 *
 * Shape is dictated by the CMS editor contract — do NOT reuse the internal
 * `Category` model directly; map to this shape before sending.
 */
export interface CategoryTreeNode {
  /** Unique category ID. Stable across requests — stored in component props. */
  id: string;
  /** Display label (already localized for the current storefront locale). */
  name: string;
  /** URL slug segment (localized). */
  slug?: string;
  /** Full URL path (e.g. `/clothing/mens`). */
  path?: string;
  /** Depth in the tree; 0 = root, 1 = child, … */
  level: number;
  /** Parent category id (if any). */
  parentId?: string;
  /** Nested children; preferred over flat + `parentId`. */
  children?: CategoryTreeNode[];
  /** Free-form metadata (image, productCount, …). */
  metadata?: Record<string, unknown>;
}

/**
 * Editor → Storefront. Request the full category tree scoped to the current
 * storefront context (locale + site). The storefront answers with a
 * {@link CategoryTreeResponseMessage}.
 */
export interface RequestCategoryTreeMessage {
  type: 'REQUEST_CATEGORY_TREE';
  /** Optional correlation id — echoed back in the response. */
  requestId?: string;
}

/**
 * Storefront → Editor. Reply to a {@link RequestCategoryTreeMessage}.
 *
 * On success, `categories` holds the hierarchical tree (array of root nodes).
 * On failure, `error` describes what went wrong and `categories` is either
 * empty or omitted.
 */
export interface CategoryTreeResponseMessage {
  type: 'CATEGORY_TREE_RESPONSE';
  categories: CategoryTreeNode[];
  error?: string;
  requestId?: string;
}

/**
 * One product row rendered by the CMS editor's product picker dialog and
 * inline autocomplete. Shape is dictated by the editor contract — the
 * storefront maps its internal `Product` model into this shape before
 * sending.
 */
export interface ProductSearchResult {
  /** Required. The value the editor stores in the field. */
  sku: string;
  /** Required. Display name (already localized to the request locale). */
  name: string;
  /** Optional thumbnail. Absolute or relative URL. */
  imageUrl?: string;
  /**
   * Optional price. Either a pre-formatted string (e.g. "€19.90") or a
   * structured object the editor formats as `${amount} ${currency}`.
   */
  price?: { amount: number; currency: string } | string;
  /** Optional breadcrumb-ish category labels for context. */
  categoryNames?: string[];
  /** Free-form metadata. Currently unused by the editor. */
  metadata?: Record<string, unknown>;
}

/**
 * Editor → Storefront. Search products by free-text and optional category
 * filter. Sent on every keystroke (debounced ~250 ms) and on every
 * category-filter change. The storefront answers with a
 * {@link ProductSearchResponseMessage}.
 */
export interface RequestProductSearchMessage {
  type: 'REQUEST_PRODUCT_SEARCH';
  /** Echo back unchanged on the response — used to discard stale results. */
  requestId: string;
  /** Tenant scope. Always populated by the editor. */
  site: string;
  /** Locale for translated names / prices. Always populated by the editor. */
  locale: string;
  /** Free-text query. May be empty (treat as "list top products"). */
  query: string;
  /** Optional category filter. `null` / absent means "no filter". */
  categoryId?: string | null;
  /** Soft cap. Editor sends 20; storefronts may clamp further. */
  limit?: number;
}

/**
 * Storefront → Editor. Reply to a {@link RequestProductSearchMessage}.
 *
 * On success, `products` holds the matched rows (already localized).
 * On failure, `error` is a short human-readable message that the editor
 * renders verbatim in the dialog; `products` is an empty array.
 */
export interface ProductSearchResponseMessage {
  type: 'PRODUCT_SEARCH_RESPONSE';
  /** MUST equal the requestId from the matching request. */
  requestId: string;
  site: string;
  locale: string;
  query: string;
  /** Always an array — empty on no results / error. */
  products: ProductSearchResult[];
  /** Optional human-readable error; rendered verbatim in the dialog. */
  error?: string;
}

/**
 * Iframe ready signal.
 * Sent from storefront to editor when iframe is loaded and ready.
 */
export interface IframeReadyMessage {
  type: 'IFRAME_READY';
  apiKey?: string; // Optional API key for editor authentication
}

/**
 * Highlight a component in the preview (when selected in LiveEditor).
 */
export interface HighlightComponentMessage {
  type: 'HIGHLIGHT_COMPONENT';
  componentId: string | null; // null = clear highlight
  slotId?: string; // optional, for additional context
}

/**
 * Highlight a slot in the preview (when selected in LiveEditor).
 */
export interface HighlightSlotMessage {
  type: 'HIGHLIGHT_SLOT';
  slotId: string | null; // null = clear highlight
}

/**
 * Storefront → Editor. Sent when the user clicked an internal link inside the
 * preview iframe. The storefront suppresses the navigation and waits for a
 * {@link NavigationResponseMessage} before actually navigating, giving the
 * editor a chance to offer "open this page for editing?".
 */
export interface NavigationInterceptedMessage {
  type: 'NAVIGATION_INTERCEPTED';
  href: string; // absolute URL the user tried to navigate to
  path: string; // pathname + search + hash (no origin)
  requestId: string; // used to correlate the matching NAVIGATION_RESPONSE
}

/**
 * Editor → Storefront. Reply to a {@link NavigationInterceptedMessage}.
 * `action: 'allow'` tells the storefront to perform the navigation it had
 * previously suppressed. More actions may be added in the future.
 */
export interface NavigationResponseMessage {
  type: 'NAVIGATION_RESPONSE';
  requestId: string;
  action: 'allow';
}

// ---------------------------------------------------------------------------
// Theme LiveEditor Messages
// ---------------------------------------------------------------------------

/**
 * Editor → Storefront. Request the currently rendered theme payload.
 * Used on ThemeEditor mount to seed the UI from whatever the server
 * component emitted on initial load (avoids an extra HTTP call).
 */
export interface RequestThemeMessage {
  type: 'REQUEST_THEME';
  /** Optional correlation id — echoed back in the response. */
  requestId?: string;
}

/**
 * Storefront → Editor. Reply to a {@link RequestThemeMessage} with the
 * currently applied theme.
 */
export interface ThemeResponseMessage {
  type: 'THEME_RESPONSE';
  site: string;
  baseTheme?: string;
  target: string;
  variables: Record<string, string>;
  version: 'draft' | 'live' | string;
  requestId?: string;
}

/**
 * Editor → Storefront. Live preview: merge (or replace) the given CSS
 * variables into the rendered `<style data-cms-theme-override>` block
 * without persisting to Emporix. The editor owns the transient state.
 *
 * `site` is **optional** — a single iframe is scoped to exactly one
 * site, so omitting it means "this iframe". Set it explicitly when a
 * multi-iframe editor wants to make sure a stray message doesn't
 * patch the wrong preview.
 */
export interface UpdateThemeVariablesMessage {
  type: 'UPDATE_THEME_VARIABLES';
  site?: string;
  variables: Record<string, string>;
  /** `'merge'` (default) patches onto existing vars; `'replace'` swaps the whole set. */
  mode?: 'merge' | 'replace';
}

/**
 * Editor → Storefront. Reset the preview to whatever the storefront
 * rendered on initial load (captured by the live bridge on mount).
 *
 * `site` is optional — see {@link UpdateThemeVariablesMessage}.
 */
export interface ResetThemeVariablesMessage {
  type: 'RESET_THEME_VARIABLES';
  site?: string;
}

/**
 * Editor → Storefront. Swap the CSS selector the override `<style>` is
 * scoped to, live, without reloading the iframe.
 *
 * The storefront resolves the target selector during SSR from the
 * persisted `base_theme` attribute (`.<base_theme>` when set,
 * `body[data-cms-site="<site>"]` otherwise). Editing the base-theme
 * input in the ThemeEditor must retarget the preview immediately —
 * `UPDATE_THEME_VARIABLES` only mutates values inside the existing
 * selector.
 *
 * `base_theme`:
 *  - Treated identically whether `null`, `undefined`, or an empty /
 *    whitespace-only string: the bridge falls back to
 *    `body[data-cms-site="<site>"]`.
 *  - Trimmed before use (the editor also trims on save; the bridge
 *    is defensive for hand-crafted messages).
 *
 * `site` is **required** (unlike `UPDATE_THEME_VARIABLES`) because the
 * payload changes the selector and a stale cross-tab message
 * retargeting the wrong preview is more destructive than a stray
 * variable patch. Mismatches are dropped silently.
 *
 * Fire-and-forget — no response. Sending the same payload twice in a
 * row is a safe no-op (the bridge short-circuits when the computed
 * selector hasn't changed).
 *
 * The editor sends this:
 *  - debounced (≈250 ms) on every keystroke in the base-theme input,
 *  - unconditionally on every `IFRAME_READY` re-handshake, followed by
 *    `UPDATE_THEME_VARIABLES` in `replace` mode.
 */
export interface UpdateThemeTargetMessage {
  type: 'UPDATE_THEME_TARGET';
  /** Echoed for sanity-checking; the bridge ignores mismatches. */
  site: string;
  /**
   * Class name without leading dot. `null` / `undefined` / empty /
   * whitespace-only ⇒ fall back to `body[data-cms-site="<site>"]`.
   */
  base_theme?: string | null;
}

/**
 * Editor → Storefront. Ask the storefront to describe which CSS variables
 * it knows how to override (label, type, default, group).
 *
 * This replaces the former `/api/cms/theme-tokens` HTTP endpoint: the
 * storefront ships a {@link CMSThemeTokenManifestService} (DI) and the
 * live bridge replies in-process — same trust boundary as the rest of
 * the editor messaging contract, no CORS, no extra route surface.
 */
export interface RequestThemeTokensMessage {
  type: 'REQUEST_THEME_TOKENS';
  /** Optional correlation id — echoed back in the response. */
  requestId?: string;
}

/**
 * Storefront → Editor. Reply to a {@link RequestThemeTokensMessage}.
 *
 * `manifest` is a {@link import('./services/CMSThemeTokenManifestService').ThemeTokenManifest}
 * — kept untyped here to avoid a circular import between the message
 * union and the manifest interface (the manifest itself imports nothing
 * from this file).
 */
export interface ThemeTokensResponseMessage {
  type: 'THEME_TOKENS_RESPONSE';
  /** Site that the manifest was resolved for. */
  site: string;
  /** Token manifest — see CMSThemeTokenManifestService for the shape. */
  manifest: unknown;
  requestId?: string;
}

export type CMSEditorMessage =
  | UpdateSlotMessage
  | UpdateLayoutMessage
  | UpdateMetadataMessage
  | RequestComponentTypesMessage
  | ComponentTypesMessage
  | RequestCategoryTreeMessage
  | CategoryTreeResponseMessage
  | RequestProductSearchMessage
  | ProductSearchResponseMessage
  | IframeReadyMessage
  | HighlightComponentMessage
  | HighlightSlotMessage
  | NavigationInterceptedMessage
  | NavigationResponseMessage
  | RequestThemeMessage
  | ThemeResponseMessage
  | UpdateThemeVariablesMessage
  | ResetThemeVariablesMessage
  | UpdateThemeTargetMessage
  | RequestThemeTokensMessage
  | ThemeTokensResponseMessage;
