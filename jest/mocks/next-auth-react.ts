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
import type { ReactNode } from 'react';

interface InertSession {
  data: null;
  status: 'unauthenticated';
}

const noopHook = (): InertSession => ({ data: null, status: 'unauthenticated' });

export const useSession = noopHook;
export const signIn = (): Promise<void> => Promise.resolve();
export const signOut = (): Promise<void> => Promise.resolve();
export const getCsrfToken = (): Promise<null> => Promise.resolve(null);
export const getProviders = (): Promise<Record<string, never>> => Promise.resolve({});
export const getSession = (): Promise<null> => Promise.resolve(null);
export const SessionProvider = ({ children }: { children?: ReactNode }): ReactNode => children;
