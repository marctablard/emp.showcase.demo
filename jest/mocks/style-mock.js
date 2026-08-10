/**
 * Jest stub for CSS / global-stylesheet imports (e.g. `import '@/app/globals.css'`).
 *
 * The custom `projects` in `jest.config.js` override `moduleNameMapper` and
 * therefore lose next/jest's built-in CSS handling. Component / layout tests
 * that transitively import a stylesheet would otherwise feed `.css` through the
 * `@swc/jest` TypeScript transform and crash on a parse error. Mapping every
 * stylesheet to this inert module keeps the render path alive — styles are not
 * asserted in unit tests.
 */
module.exports = {};
