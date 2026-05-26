/**
 * Jest stub for `next-auth/react` (the real package is ESM-only and trips up
 * the jest CommonJS pipeline — see `transformIgnorePatterns` allowlist).
 *
 * The real exports are not exercised by any CMS-component test; the import
 * chain reaches this module transitively through `useCart` (imported by
 * `ProductTile`, in turn imported by the recommendations carousel). Returning
 * an inert stub is enough to unblock the module-load path. Individual tests
 * that need real behaviour should still call `jest.mock('next-auth/react')`
 * with their own fixtures.
 */
const noopHook = () => ({ data: null, status: 'unauthenticated' });

module.exports = {
  useSession: noopHook,
  signIn: () => Promise.resolve(),
  signOut: () => Promise.resolve(),
  getCsrfToken: () => Promise.resolve(null),
  getProviders: () => Promise.resolve({}),
  getSession: () => Promise.resolve(null),
  SessionProvider: ({ children }) => children,
};
