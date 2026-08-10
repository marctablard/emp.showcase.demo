/**
 * Applies the shared `CmsAdapter` contract suite to `StoryblokCmsAdapter`.
 *
 * The actual `expect()` assertions live in
 *   src/platform/services/cms/__tests__/CmsAdapter.contract.ts
 * (`runCmsAdapterContract`). That helper is intentionally named
 * `*.contract.ts` (not `*.test.ts`) so Jest does not pick it up as a
 * standalone suite — every adapter wires it into its own runner.
 *
 * Mirrors `LocalJsonCmsAdapter.contract.test.ts` — every concrete adapter
 * is held to the same cross-adapter SPI invariants (return shapes,
 * never-throws, optional surface) so a CMS provider swap is a true
 * drop-in.
 *
 * The injected `StoryblokCmsApi` is faked to a `getStory: async () => null`
 * stub so the contract's `does-not-reject-for-missing-slug` assertion
 * exercises the no-result branch without hitting a real network.
 */
import { runCmsAdapterContract } from '@/platform/services/cms/__tests__/CmsAdapter.contract';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { StoryblokCmsApi } from '../StoryblokCmsApi';
import { StoryblokCmsAdapter } from './StoryblokCmsAdapter';
import { StoryblokCmsMapper } from './StoryblokCmsMapper';

const fakeApi = (): StoryblokCmsApi =>
  ({
    getStory: async () => null,
    hasToken: () => false,
  }) as unknown as StoryblokCmsApi;

const silentLogger = (): LoggerService =>
  ({
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    fatal: () => {},
  }) as unknown as LoggerService;

runCmsAdapterContract({
  name: 'StoryblokCmsAdapter',
  expectedId: 'storyblok',
  build: () => new StoryblokCmsAdapter(fakeApi(), new StoryblokCmsMapper(), silentLogger()),
});
