import type { ReactNode } from 'react';

/**
 * Single source of truth for the CMS page body's top-spacer classes.
 *
 * The storefront header is fixed/overlaid, so a page body that is NOT
 * `no_margin` needs this top margin to clear it. Both the provider-agnostic
 * shell (`CmsPage`) and the Storyblok preview adapter render through
 * `CmsBodyFrame` so the literal lives in exactly one place.
 */
export const CMS_BODY_SPACER_CLASS = 'flex-grow mt-17 sm:mt-36 md:mt-52';

interface CmsBodyFrameProps {
  /** When true, the spacer margin is omitted (full-bleed page). */
  noMargin?: boolean;
  children?: ReactNode;
}

/**
 * Provider-agnostic wrapper for a rendered CMS page body. Applies the shared
 * top-spacer unless the page opts out via `no_margin`.
 */
export function CmsBodyFrame({ noMargin, children }: CmsBodyFrameProps) {
  return <div className={noMargin ? '' : CMS_BODY_SPACER_CLASS}>{children}</div>;
}
