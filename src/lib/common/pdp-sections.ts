/**
 * Stable in-page anchor id for the PDP Technical Information section.
 * Must not include locale, site, or product segments so the same fragment works on every PDP URL.
 */
export const PDP_TECHNICAL_INFORMATION_SECTION_ID = 'technical-information';

/** Mark fixed/sticky overlays that cover the top of the viewport on PDP (header, ATC bar). */
export const PDP_STICKY_OVERLAY_ATTR = 'data-pdp-sticky-overlay';

/** Extra breathing room below the sticky stack when scrolling to an anchor. */
const PDP_ANCHOR_EXTRA_GAP_PX = 16;

/**
 * Builds the same-page href for the Technical Information section (`#…`).
 * Use with a plain `<a>` — the one case `multi-site-routing.mdc` allows outside `@/i18n/navigation`.
 */
export function getPdpTechnicalInformationHref(): string {
  return `#${PDP_TECHNICAL_INFORMATION_SECTION_ID}`;
}

function isEffectivelyVisible(element: Element): boolean {
  let node: Element | null = element;
  while (node && node !== globalThis.document.documentElement) {
    const style = globalThis.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }
    const opacity = Number.parseFloat(style.opacity);
    if (Number.isFinite(opacity) && opacity <= 0) {
      return false;
    }
    node = node.parentElement;
  }
  return true;
}

/**
 * Combined height of visible PDP sticky overlays (header + add-to-cart bar), from the
 * viewport top to the lowest overlay bottom — used as `scroll-margin-top` / scroll offset.
 */
export function getPdpStickyOverlayOffsetPx(extraGapPx: number = PDP_ANCHOR_EXTRA_GAP_PX): number {
  if (globalThis.document === undefined) {
    return extraGapPx;
  }

  let lowestBottom = 0;
  const overlays = globalThis.document.querySelectorAll(`[${PDP_STICKY_OVERLAY_ATTR}]`);
  overlays.forEach((overlay) => {
    if (!isEffectivelyVisible(overlay)) {
      return;
    }
    const { bottom, height } = overlay.getBoundingClientRect();
    if (height <= 0) {
      return;
    }
    lowestBottom = Math.max(lowestBottom, bottom);
  });

  return Math.max(0, Math.ceil(lowestBottom) + extraGapPx);
}

/** Apply measured sticky offset as `scroll-margin-top` on a PDP section anchor. */
export function applyPdpAnchorScrollMargin(element: HTMLElement | null): void {
  if (!element) {
    return;
  }
  element.style.scrollMarginTop = `${getPdpStickyOverlayOffsetPx()}px`;
}

/**
 * Smooth-scroll to a PDP section, clearing sticky header + ATC bar.
 * Updates the URL hash without a second native jump.
 */
export function scrollToPdpAnchor(sectionId: string): void {
  if (globalThis.document === undefined || globalThis.window === undefined) {
    return;
  }

  const target = globalThis.document.getElementById(sectionId);
  if (!target) {
    return;
  }

  applyPdpAnchorScrollMargin(target);
  const top = target.getBoundingClientRect().top + globalThis.window.scrollY - getPdpStickyOverlayOffsetPx();
  globalThis.window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });

  const nextHash = `#${sectionId}`;
  if (globalThis.location.hash !== nextHash) {
    globalThis.history.pushState(null, '', nextHash);
  }
}
