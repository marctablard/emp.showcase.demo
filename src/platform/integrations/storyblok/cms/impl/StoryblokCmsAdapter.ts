import type { HTMLAttributes } from 'react';
import { type SbBlokData, storyblokEditable } from '@storyblok/react/rsc';
import { inject } from 'inversify';
import crypto from 'node:crypto';
import 'server-only';
import { LayoutContentSchema } from '@/components/cms/component-schema';
import { routingConfig } from '@/i18n/routing';
import { getStoryblokEnv } from '@/lib/server/storyblok-env';
import { injectable } from '@/platform/core/di/injectable';
import type { CmsAdapter } from '@/platform/services/cms/CmsAdapter';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type {
  CMSComponent,
  CMSLayout,
  CMSNavigation,
  CMSNoResult,
  CMSPage,
  WebhookEvent,
} from '@/platform/services/model/cms';
import type { StoryblokCmsApi } from '../StoryblokCmsApi';
import { StoryblokBridgeScript } from './StoryblokBridgeScript';
import type { StoryblokCmsMapper } from './StoryblokCmsMapper';

/**
 * `CmsAdapter` backed by Storyblok.
 *
 * Wires the SDK encapsulation (`StoryblokCmsApi`) and the wire-format
 * translation (`StoryblokCmsMapper`) into the agnostic SPI consumed by
 * `DelegatingCmsServiceSSR`. It is the only file outside this integration
 * folder aware Storyblok is in play; Content-Delivery itself lives solely
 * inside the API capsule, so the adapter never touches the SDK directly.
 *
 * All accessor methods are total: a missing story, an API error, or a
 * mapper crash surface as `{ notfound: true }` rather than a rejection.
 */
@injectable('CmsAdapter:storyblok', 'Singleton')
export class StoryblokCmsAdapter implements CmsAdapter {
  readonly id = 'storyblok';
  readonly BridgeScript = StoryblokBridgeScript;

  constructor(
    @inject('StoryblokCmsApi') private readonly api: StoryblokCmsApi,
    @inject('StoryblokCmsMapper') private readonly mapper: StoryblokCmsMapper,
    @inject('LoggerService') private readonly logger: LoggerService,
  ) {}

  hasContent(): boolean {
    try {
      return this.api.hasToken();
    } catch {
      return false;
    }
  }

  async getPage(slug: string, locale: string, site: string): Promise<CMSPage | CMSNoResult> {
    try {
      const result = await this.api.getStory(slug, locale, site);
      if (!result?.data?.story) {
        return { notfound: true };
      }
      return this.mapper.mapPage(result.data.story);
    } catch (error) {
      this.logger.warn({ err: error, slug }, `Error loading Storyblok page with slug '${slug}'`);
      return { notfound: true };
    }
  }

  async getLayout(layoutId: string, locale: string, site: string): Promise<CMSLayout | CMSNoResult> {
    try {
      // Layouts are always fetched `published` — an in-progress editor draft
      // of the storefront frame must never leak into a live page.
      const result = await this.api.getStory(`layouts/${layoutId}`, locale, site, 'published');
      if (!result?.data?.story) {
        return { notfound: true };
      }
      const mapped = this.mapper.mapLayout(result.data.story);
      const parsed = LayoutContentSchema.safeParse(mapped);
      if (!parsed.success) {
        this.logger.warn({ layoutId, issues: parsed.error.issues }, `Layout '${layoutId}' failed schema validation`);
        return { notfound: true };
      }
      return parsed.data as CMSLayout;
    } catch (error) {
      this.logger.warn({ err: error, layoutId }, `Error loading Storyblok layout '${layoutId}'`);
      return { notfound: true };
    }
  }

  async getNavigation(_locale: string, _site: string): Promise<CMSNavigation | CMSNoResult> {
    return { notfound: true };
  }

  /**
   * Constant-time HMAC-SHA-256 verification of the `webhook-signature` header
   * against the raw request body, keyed by the server-only
   * `NEXT_CMS_WEBHOOK_SECRET`.
   *
   * Length-guard rationale: `crypto.timingSafeEqual` THROWS on unequal buffer
   * lengths. A signature of the wrong length is itself an invalid signature,
   * so we compare lengths first and return `false` (→ caller answers `401`)
   * rather than (a) letting `timingSafeEqual` throw into a 500, or (b)
   * swallowing that throw in a `try/catch` that would mask unrelated errors.
   * The SHA-256 hex digest is always 64 chars, so a legitimate signature is
   * always length-64; a mismatch is a forgery, not a server fault.
   */
  validateWebhookSignature(headers: Headers, rawBody: string): boolean {
    const secret = process.env.NEXT_CMS_WEBHOOK_SECRET;
    if (!secret) {
      // Defensive: the route guards with 503 before reaching here. Never
      // validate against an empty/absent secret.
      return false;
    }
    const provided = headers.get('webhook-signature') ?? '';
    const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const providedBuf = Buffer.from(provided, 'utf8');
    if (expectedBuf.length !== providedBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  }

  /**
   * Translate a Storyblok story webhook into granular invalidation events.
   *
   * Storyblok posts `{ action, full_slug, ... }`. Only `published`,
   * `unpublished` and `deleted` actions invalidate content. The `full_slug`
   * is decoded against the same conventions the read path uses:
   *  - multi-site spaces prefix the slug with the site code
   *    (`NEXT_STORYBLOK_MULTI_SITE`), mirroring `StoryblokCmsApi`;
   *    without that explicit prefix the change fans out across every
   *    configured site, since one story then serves all of them — and the
   *    read path keys the cache by the real route-segment site code (always a
   *    member of `NEXT_PUBLIC_AVAILABLE_SITES`), so a `site: ''` event would
   *    never match a cached key; the site segment is consumed before locale
   *    detection, so a slug like `us-branch/de/about` unambiguously parses as
   *    site=`us-branch`, locale=`de`, slug=`about` — no collision with
   *    locale-prefix mode because the two prefixes occupy distinct segments
   *    and are evaluated in order (site first, locale second);
   *  - a leading locale segment (`de/…`) addresses a single locale; without
   *    one (field-level i18n) the change fans out across every configured
   *    locale, since one story serves all of them;
   *  - a `layouts/` prefix targets the layout cache, everything else the page
   *    cache.
   *
   * The result is the cartesian product of the target sites and locales, so
   * the produced invalidation keys stay congruent with whatever the read path
   * cached.
   */
  mapWebhookPayload(_headers: Headers, body: unknown): WebhookEvent[] | null {
    if (typeof body !== 'object' || body === null) {
      return null;
    }
    const { action, full_slug: fullSlug } = body as { action?: unknown; full_slug?: unknown };
    if (action !== 'published' && action !== 'unpublished' && action !== 'deleted') {
      return null;
    }
    if (typeof fullSlug !== 'string' || fullSlug.length === 0) {
      return null;
    }

    let explicitSite: string | null = null;
    let rest = fullSlug;
    if (getStoryblokEnv('MULTI_SITE') === 'true') {
      const slash = rest.indexOf('/');
      if (slash > 0) {
        explicitSite = rest.slice(0, slash);
        rest = rest.slice(slash + 1);
      }
    }

    const locales = routingConfig.locales;
    const firstSlash = rest.indexOf('/');
    const maybeLocale = firstSlash > 0 ? rest.slice(0, firstSlash) : '';
    let targetLocales: readonly string[] = locales;
    if (maybeLocale && locales.includes(maybeLocale)) {
      targetLocales = [maybeLocale];
      rest = rest.slice(firstSlash + 1);
    }

    const targetSites = explicitSite === null ? this.configuredSites() : [explicitSite];
    const expand = <E extends WebhookEvent>(make: (site: string, locale: string) => E): E[] =>
      targetSites.flatMap((site) => targetLocales.map((locale) => make(site, locale)));

    if (rest.startsWith('layouts/')) {
      const layoutId = rest.slice('layouts/'.length);
      return expand((site, locale) => ({ kind: 'layout', layoutId, locale, site }));
    }
    return expand((site, locale) => ({ kind: 'page', slug: rest, locale, site }));
  }

  /**
   * Sites the cache must be invalidated for when a webhook carries no explicit
   * site prefix. Mirrors the read path's source of truth
   * (`NEXT_PUBLIC_AVAILABLE_SITES`); falls back to the default site, then to a
   * single empty-site event so a misconfigured deployment still invalidates
   * the default key rather than silently no-opping.
   */
  private configuredSites(): string[] {
    const sites = (process.env.NEXT_PUBLIC_AVAILABLE_SITES ?? '')
      .split(',')
      .map((site) => site.trim())
      .filter(Boolean);
    if (sites.length > 0) {
      return sites;
    }
    const fallback = process.env.NEXT_PUBLIC_DEFAULT_SITE?.trim();
    return fallback ? [fallback] : [''];
  }

  /**
   * Visual-Editor click-to-edit attributes for a mapped component.
   *
   * Delegates to the SDK's `storyblokEditable` rather than hand-rolling the
   * attributes: the bridge binds against `data-blok-c` set to the *stringified
   * `_editable` object* (not the component name) and `data-blok-uid` set to
   * `${storyId}-${blockUid}` (not the bare uid). Emitting the wrong shape
   * silently breaks click-to-edit. The helper is pure (no `window` access), so
   * it is safe in this server-only module; it reads only `_editable`, which
   * `StoryblokCmsMapper.mapComponent` preserves on the mapped component, and
   * returns `{}` when that payload is absent or malformed.
   */
  getEditableProps(component: CMSComponent): HTMLAttributes<HTMLElement> {
    return storyblokEditable(component as unknown as SbBlokData) as HTMLAttributes<HTMLElement>;
  }
}

export default StoryblokCmsAdapter;
