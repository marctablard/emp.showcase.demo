import { type ReactElement, type ReactNode, createElement } from 'react';
import { inject } from 'inversify';
import 'server-only';
import { CmsBodyFrame } from '@/components/cms/_core/cms-page-frame';
import { injectable } from '@/platform/core/di/injectable';
import type { CmsPreviewAdapter } from '@/platform/services/cms/preview/CmsPreviewAdapter';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { CMSComponent } from '@/platform/services/model/cms';
import type { StoryblokCmsApi } from '../StoryblokCmsApi';
import { StoryblokBridgeScript } from '../impl/StoryblokBridgeScript';
import type { StoryblokCmsMapper } from '../impl/StoryblokCmsMapper';
import { isStoryblokPreviewRequest } from './storyblok-preview-detection';

const SPACE_ID_KEY = '_storyblok_tk[space_id]';

/**
 * Node-only Storyblok preview adapter (EMP-15 §4).
 *
 * Extends the pure detector (id + `isPreviewRequest` delegate to the edge-safe
 * `storyblok-preview-detection` module) and adds `renderPreviewPage(...)`,
 * which fetches the DRAFT story and renders it with the Visual-Editor bridge
 * mounted so the editor connects.
 *
 * `renderPreviewPage` validation ORDER (return `null` on any failure, so the
 * route falls through to `notFound()`):
 *   (1) presence + timestamp — re-run `isStoryblokPreviewRequest(url)`.
 *   (2) space-id match — `_storyblok_tk[space_id]` === `api.getSpaceId()`.
 *       When `getSpaceId()` is `null` (space id unconfigured) the check is
 *       SKIPPED with a warn-log (documented residual risk, FU-004); a
 *       mismatching url space id must NOT reject in that case.
 *   (3) draft fetch — `api.getStory(slug, locale, site, 'draft')`; `null` →
 *       `null`.
 *
 * The shared `CmsRenderer` tree is loaded LAZILY (`await import`) only when the
 * page actually has body components: it transitively pulls the full CMS
 * component map (→ `next-auth`/`next-intl` ESM), which must stay out of this
 * server adapter's static module graph (ADR 0001 lesson). The mounted bridge
 * script is the static dependency that connects the Visual Editor.
 *
 * The HMAC token CONTENT is intentionally NOT validated (EMP-11 §8 FU-004,
 * board-accepted).
 */
@injectable('CmsPreviewAdapter:storyblok', 'Singleton')
export class StoryblokPreviewAdapter implements CmsPreviewAdapter {
  readonly id = 'storyblok';

  constructor(
    @inject('StoryblokCmsApi') private readonly api: StoryblokCmsApi,
    @inject('StoryblokCmsMapper') private readonly mapper: StoryblokCmsMapper,
    @inject('LoggerService') private readonly logger: LoggerService,
  ) {}

  isPreviewRequest(url: URL): boolean {
    return isStoryblokPreviewRequest(url);
  }

  async renderPreviewPage(params: {
    slug: string;
    locale: string;
    site: string;
    url: URL;
  }): Promise<ReactElement | null> {
    const { slug, locale, site, url } = params;

    // (1) presence + timestamp.
    if (!isStoryblokPreviewRequest(url)) {
      return null;
    }

    // (2) space-id match (skipped + warn-logged when unconfigured).
    const configuredSpaceId = this.api.getSpaceId();
    if (configuredSpaceId === null) {
      this.logger.warn(
        { slug },
        'Storyblok space id is unconfigured (NEXT_STORYBLOK_SPACE_ID) — skipping preview space-id check (FU-004 residual risk)',
      );
    } else if (url.searchParams.get(SPACE_ID_KEY) !== configuredSpaceId) {
      return null;
    }

    // (3) fetch the DRAFT story.
    const result = await this.api.getStory(slug, locale, site, 'draft');
    if (!result?.data?.story) {
      return null;
    }

    const page = this.mapper.mapPage(result.data.story);
    const body = await this.renderBody(page.components);

    // Bounded ADR-0001 exception: the preview path is provider-owned because it
    // must fetch the DRAFT version and mount the Visual-Editor bridge — neither
    // is expressible through the published `CMSService`/`CmsPage` shell. It
    // still reuses the shared, provider-agnostic `CmsBodyFrame` so the page
    // spacer/`no_margin` markup is NOT duplicated.
    return (
      <CmsBodyFrame noMargin={page.no_margin}>
        <StoryblokBridgeScript />
        {body}
      </CmsBodyFrame>
    );
  }

  /**
   * Resolves the page body via the shared `CmsRenderer`, imported lazily so the
   * heavy CMS component map never enters this adapter's static module graph.
   * An empty body needs no renderer at all.
   */
  private async renderBody(components: CMSComponent[]): Promise<ReactNode> {
    if (components.length === 0) {
      return null;
    }
    const { CmsRenderer } = await import('@/components/cms/_core/cms-renderer');
    return components.map((component) => createElement(CmsRenderer, { key: component.id, component }));
  }
}

export default StoryblokPreviewAdapter;
