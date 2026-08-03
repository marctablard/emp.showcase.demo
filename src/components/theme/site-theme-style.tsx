import { resolveThemeForSite } from '@/app/styles/themes';

interface SiteThemeStyleProps {
  /** The active site code (the `[site]` route segment). */
  siteCode: string;
}

/**
 * Server component that injects the per-site theme stylesheet.
 *
 * Resolves the site's theme file via `resolveThemeForSite` and emits a plain
 * `<link rel="stylesheet">`. Mounted as the FIRST `<body>` child in
 * `[site]/[locale]/layout.tsx` so it loads after `globals.css` (which is
 * injected into `<head>`) and therefore wins the cascade for the `:root`
 * token overrides it carries.
 *
 * ADR-0001 / drift-guard: the theme layer is a leaf. This component imports
 * only the pure theme registry — NO provider context, NO DI container, NO
 * `@/platform/integrations/*`. The site code is passed in as a prop by the
 * layout, which already resolves it from the route segment.
 */
export function SiteThemeStyle({ siteCode }: Readonly<SiteThemeStyleProps>) {
  const href = resolveThemeForSite(siteCode);
  return <link rel="stylesheet" href={href} data-site-theme={siteCode} />;
}

export default SiteThemeStyle;
