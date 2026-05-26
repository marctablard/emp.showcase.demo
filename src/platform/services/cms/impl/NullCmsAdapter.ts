import { injectable } from '@/platform/core/di/injectable';
import type { CMSNavigation, CMSNoResult, CMSPage } from '../../model/cms';
import type { CmsAdapter } from '../CmsAdapter';

/**
 * Default fallback `CmsAdapter`, bound when no CMS provider is configured.
 *
 * Every required accessor resolves to `{ notfound: true }`. This adapter
 * is what lets the app boot green even without any CMS provider env.
 *
 * The optional surface (`getEditableProps`, `BridgeScript`) is
 * deliberately NOT implemented — `DelegatingCmsServiceSSR` falls back to
 * `{}` / `null` respectively.
 */
@injectable('CmsAdapter:none', 'Singleton')
export class NullCmsAdapter implements CmsAdapter {
  readonly id = 'none';

  hasContent(): boolean {
    return false;
  }

  async getPage(slug: string, _locale: string, _site: string): Promise<CMSPage | CMSNoResult> {
    return {
      notfound: true,
      message: `No CMS provider configured (slug: ${slug})`,
    };
  }

  async getNavigation(_locale: string, _site: string): Promise<CMSNavigation | CMSNoResult> {
    return { notfound: true };
  }
}

export default NullCmsAdapter;
