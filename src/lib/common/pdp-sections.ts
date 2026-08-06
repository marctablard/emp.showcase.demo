/**
 * Stable in-page anchor id for the PDP Technical Information section.
 * Must not include locale, site, or product segments so the same fragment works on every PDP URL.
 */
export const PDP_TECHNICAL_INFORMATION_SECTION_ID = 'technical-information';

/**
 * Builds the same-page href for the Technical Information section (`#…`).
 * Use with a plain `<a>` — the one case `multi-site-routing.mdc` allows outside `@/i18n/navigation`.
 */
export function getPdpTechnicalInformationHref(): string {
  return `#${PDP_TECHNICAL_INFORMATION_SECTION_ID}`;
}
