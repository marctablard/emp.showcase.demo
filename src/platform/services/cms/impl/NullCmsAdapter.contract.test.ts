/**
 * Applies the shared `CmsAdapter` contract suite to `NullCmsAdapter`.
 *
 * The actual `expect()` assertions live in
 *   src/platform/services/cms/__tests__/CmsAdapter.contract.ts
 * (`runCmsAdapterContract`). That helper is intentionally named
 * `*.contract.ts` (not `*.test.ts`) so Jest does not pick it up as a
 * standalone suite — every adapter wires it into its own runner.
 *
 * This file is that runner for the Null adapter: it builds a fresh
 * instance and lets the shared suite verify the SPI invariants
 * (return shapes, never-throws, optional surface) so every
 * `CmsAdapter` implementation is held to the same vertical contract.
 */
import { runCmsAdapterContract } from '../__tests__/CmsAdapter.contract';
import { NullCmsAdapter } from './NullCmsAdapter';

runCmsAdapterContract({
  name: 'NullCmsAdapter',
  expectedId: 'none',
  build: () => new NullCmsAdapter(),
});
