import type { ComponentType, HTMLAttributes } from 'react';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type {
  CMSComponent,
  CMSLayout,
  CMSNavigation,
  CMSNoResult,
  CMSPage,
  WebhookEvent,
  WebhookResult,
} from '../../model/cms';
import type { CmsAdapter } from '../CmsAdapter';

/**
 * `true` iff an accessor result is the "no content" sentinel. The CMS SPI
 * surfaces a miss as `{ notfound: true }`; real `CMSPage`/`CMSLayout`/
 * `CMSNavigation` payloads never carry a `notfound` key, so its presence is a
 * safe discriminator across the union.
 */
function isNoResult(result: unknown): result is CMSNoResult {
  return typeof result === 'object' && result !== null && 'notfound' in result;
}

/**
 * Composite `CmsAdapter` that wraps a primary provider with a default-content
 * fallback source (EMP-16 Phase G).
 *
 * Required accessors ask the primary first. A primary `{ notfound: true }`
 * delegates to the fallback source; any real payload is passed through
 * verbatim and the fallback is never consulted. When delegating, the fallback
 * is always queried with the fixed `fallbackSite` (typically `'_default_'`),
 * NEVER the caller's original `site` hint — that is what guarantees a fresh
 * clone with an empty primary space still renders the showcase content.
 *
 * The optional surface (`getEditableProps` / `BridgeScript` / webhook
 * primitives) is presence-mirrored from the PRIMARY only. Each member is wired
 * iff the primary exposes it, delegates exclusively to the primary, and the
 * fallback's optional surface is NEVER invoked — delegating webhooks to the
 * fallback would double-fire content-change events / invalidate the wrong
 * source. When the primary omits an optional member, the composite member
 * stays `undefined` so `DelegatingCmsServiceSSR`'s `?.()` / `?? {}` / `?? null`
 * fallbacks (and the `405` webhook path) behave exactly as for the primary
 * alone.
 *
 * This class is intentionally NOT `@injectable`: it needs constructor
 * arguments (`primary`, `fallbackSource`, `fallbackSite`) that are not static
 * DI aliases. It is instantiated and bound programmatically by
 * `bindActiveCmsAdapter`, which keeps the wrap eager (no hidden lazy
 * resolve-time failure under the Turbopack module-graph split — see ADR 0001).
 */
export class FallbackCmsAdapter implements CmsAdapter {
  readonly id = 'fallback';

  // Optional surface — only assigned in the constructor when the primary has it.
  getEditableProps?: (component: CMSComponent) => HTMLAttributes<HTMLElement>;
  BridgeScript?: ComponentType;
  handleWebhook?: (request: Request) => Promise<WebhookResult>;
  validateWebhookSignature?: (headers: Headers, rawBody: string) => boolean;
  mapWebhookPayload?: (headers: Headers, body: unknown) => WebhookEvent[] | null;

  constructor(
    private readonly primary: CmsAdapter,
    private readonly fallbackSource: CmsAdapter,
    private readonly fallbackSite: string,
    private readonly logger?: LoggerService,
  ) {
    // Mirror the optional surface from the primary ONLY. Delegating any of
    // these to the fallback would double-fire webhook events or leak the
    // fallback's editing bridge — both wrong. A member the primary lacks
    // stays undefined so the facade's optional-method fallbacks still apply.
    if (this.primary.getEditableProps) {
      this.getEditableProps = (component) => this.primary.getEditableProps!(component);
    }
    if (this.primary.BridgeScript) {
      this.BridgeScript = this.primary.BridgeScript;
    }
    if (this.primary.handleWebhook) {
      this.handleWebhook = (request) => this.primary.handleWebhook!(request);
    }
    if (this.primary.validateWebhookSignature) {
      this.validateWebhookSignature = (headers, rawBody) => this.primary.validateWebhookSignature!(headers, rawBody);
    }
    if (this.primary.mapWebhookPayload) {
      this.mapWebhookPayload = (headers, body) => this.primary.mapWebhookPayload!(headers, body);
    }
  }

  hasContent(): boolean {
    return this.primary.hasContent() || this.fallbackSource.hasContent();
  }

  async getPage(slug: string, locale: string, site: string): Promise<CMSPage | CMSNoResult> {
    const result = await this.primary.getPage(slug, locale, site);
    if (!isNoResult(result)) {
      return result;
    }
    this.logger?.info(
      { slug, locale, site, fallbackSite: this.fallbackSite },
      `Primary CMS has no page '${slug}', delegating to fallback source`,
    );
    return this.fallbackSource.getPage(slug, locale, this.fallbackSite);
  }

  async getLayout(layoutId: string, locale: string, site: string): Promise<CMSLayout | CMSNoResult> {
    const result = await this.primary.getLayout(layoutId, locale, site);
    if (!isNoResult(result)) {
      return result;
    }
    this.logger?.info(
      { layoutId, locale, site, fallbackSite: this.fallbackSite },
      `Primary CMS has no layout '${layoutId}', delegating to fallback source`,
    );
    return this.fallbackSource.getLayout(layoutId, locale, this.fallbackSite);
  }

  async getNavigation(locale: string, site: string): Promise<CMSNavigation | CMSNoResult> {
    const result = await this.primary.getNavigation(locale, site);
    if (!isNoResult(result)) {
      return result;
    }
    this.logger?.info(
      { locale, site, fallbackSite: this.fallbackSite },
      'Primary CMS has no navigation, delegating to fallback source',
    );
    return this.fallbackSource.getNavigation(locale, this.fallbackSite);
  }
}

export default FallbackCmsAdapter;
