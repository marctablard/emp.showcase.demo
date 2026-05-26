/**
 * Applies the shared `CmsAdapter` contract suite to `LocalJsonCmsAdapter`,
 * wired with a fake `CmsDataLoader` that always returns `null` so no JSON
 * fixtures on disk are needed.
 *
 * The actual `expect()` assertions live in
 *   src/platform/services/cms/__tests__/CmsAdapter.contract.ts
 * (`runCmsAdapterContract`). That helper is intentionally named
 * `*.contract.ts` (not `*.test.ts`) so Jest does not pick it up as a
 * standalone suite — every adapter wires it into its own runner.
 *
 * This file is that runner for the Local-JSON adapter: it builds a fresh
 * instance and lets the shared suite verify the SPI invariants (return
 * shapes, never-throws, optional surface) so every `CmsAdapter`
 * implementation is held to the same vertical contract.
 */
import { runCmsAdapterContract } from '@/platform/services/cms/__tests__/CmsAdapter.contract';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { SessionService } from '@/platform/services/session';
import { type CmsDataLoader, LocalJsonCmsAdapter } from './LocalJsonCmsAdapter';

const fakeSession = (): SessionService =>
  ({
    getCurrent: async () => undefined,
  }) as unknown as SessionService;

const silentLogger = (): LoggerService =>
  ({
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    fatal: () => {},
  }) as unknown as LoggerService;

const nullLoader: CmsDataLoader = async () => null;

runCmsAdapterContract({
  name: 'LocalJsonCmsAdapter',
  expectedId: 'local',
  build: () => new LocalJsonCmsAdapter(fakeSession(), silentLogger(), nullLoader),
});
