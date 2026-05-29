import type { HTMLAttributes } from 'react';
import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import type { CmsAdapter } from '@/platform/services/cms/CmsAdapter';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { CMSComponent, CMSLayout, CMSNavigation, CMSNoResult, CMSPage } from '@/platform/services/model/cms';
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
    } catch (_error) {
      this.logger.warn({ slug }, `Error loading Storyblok page with slug '${slug}'`);
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
      return this.mapper.mapLayout(result.data.story);
    } catch (_error) {
      this.logger.warn({ layoutId }, `Error loading Storyblok layout '${layoutId}'`);
      return { notfound: true };
    }
  }

  async getNavigation(_locale: string, _site: string): Promise<CMSNavigation | CMSNoResult> {
    return { notfound: true };
  }

  getEditableProps(component: CMSComponent): HTMLAttributes<HTMLElement> {
    const editable = (component as { _editable?: unknown })._editable;
    if (typeof editable !== 'string' || editable.length === 0) {
      return {};
    }
    const uid = this.parseUid(editable);
    return {
      'data-blok-c': component.type,
      'data-blok-uid': uid,
    } as HTMLAttributes<HTMLElement>;
  }

  private parseUid(editable: string): string {
    const match = editable.match(/"uid"\s*:\s*"([^"]+)"/);
    return match?.[1] ?? '';
  }
}

export default StoryblokCmsAdapter;
