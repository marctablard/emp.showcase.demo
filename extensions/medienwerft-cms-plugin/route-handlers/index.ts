/**
 * Route handlers exposed by the medienwerft-cms-plugin.
 *
 * Each export is intended to be re-exported as a Next.js App Router
 * route handler from a thin file under `src/app/...`:
 *
 * ```ts
 * // src/app/[site]/cms-theme.css/route.ts
 * export { cmsThemeCssGET as GET } from '@extensions/medienwerft-cms-plugin/route-handlers';
 * ```
 *
 * Keeping the implementation inside the extension means a host
 * application picking up the plugin only needs to add the route file
 * and run the install \u2014 it never has to copy or maintain handler
 * logic itself.
 */
export { cmsThemeCssGET } from './cms-theme-css';
export { categoryTreeGET } from './category-tree';
