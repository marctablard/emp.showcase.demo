/**
 * Component registry for medienwerft-cms-plugin.
 *
 * Exports React components that can be used by the host application
 * or by other extensions. Import from '@extensions/medienwerft-cms-plugin/components'.
 */
export { default as EmporixCmsPage } from './emporix-cms-page';
export { default as EmporixCmsLayout } from './emporix-cms-layout';
export { default as EmporixContentSlot } from './emporix-content-slot';
export { default as EmporixCmsThemeStyle } from './emporix-cms-theme-style';
export { fetchCMSPage, fetchCMSLayout } from '../lib/fetch-cms-page';
export { fetchCMSTheme } from '../lib/fetch-cms-theme';
// Theme stylesheet building blocks — re-exported so a host that wires
// up its own variant of the SSR <link> emitter, or unit-tests the
// route handler in isolation, doesn't have to reach into the
// extension's `lib/` folder.
export { buildCssDeclaration, cmsThemeCssUrl, resolveTargetSelector } from '../lib/build-theme-css';
export {
  THEME_DRAFT_MARKER_ATTR,
  THEME_STYLE_HREF_ATTR,
  THEME_STYLE_NODE_ID,
  THEME_STYLE_PRECEDENCE,
  themeStyleHref,
} from '../lib/theme-style-constants';

// Internal components (exported for advanced use cases)
export { default as EmporixCMSComponentRenderer } from './emporix-cms-component-renderer';
