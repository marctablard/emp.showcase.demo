import type { ReactElement } from 'react';
import type { CmsPreviewDetector } from './CmsPreviewDetector';

/**
 * Node-only rendering half of the CMS preview SPI (EMP-15 §1).
 *
 * A `CmsPreviewAdapter` extends the edge-safe detector with the ability to
 * actually render a draft preview page. Unlike the detector, it MAY use the
 * provider SDK and `server-only`, so it is resolved exclusively through the
 * Node-only adapter registry (never the Edge middleware).
 */
export interface CmsPreviewAdapter extends CmsPreviewDetector {
  /**
   * Renders the draft preview page for the given route, or `null` when the
   * request fails validation (presence → timestamp → space-id) or the draft
   * story is not found. The route turns a `null` into `notFound()`.
   */
  renderPreviewPage(params: { slug: string; locale: string; site: string; url: URL }): Promise<ReactElement | null>;
}
