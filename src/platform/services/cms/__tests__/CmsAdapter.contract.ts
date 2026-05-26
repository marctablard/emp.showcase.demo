/**
 * Reusable contract suite for `CmsAdapter` implementations.
 *
 * Every concrete adapter exposes its own thin `*.contract.test.ts` runner that
 * builds an instance and calls `runCmsAdapterContract({ name, build })`. The
 * suite asserts the cross-adapter invariants from the SPI:
 *
 * 1. `id` is a non-empty string and matches the adapter's declared identifier.
 * 2. `hasContent()` returns a boolean (never throws).
 * 3. `getPage` / `getNavigation` always resolve to a value of the declared
 *    shape and never reject for non-existent content — adapters must surface
 *    "no result" as `{ notfound: true }` rather than throwing.
 * 4. Optional surface (`getEditableProps`, `BridgeScript`) — when present, has
 *    the right type; when absent, the facade falls back to `{}` / `null`.
 *
 * The contract intentionally does NOT assert side-effects (logging, caching,
 * network calls) — those belong in adapter-specific tests.
 *
 * NOT a `*.test.ts` file: Jest must not pick it up directly. Runners import
 * `runCmsAdapterContract` and embed the suite in their own `describe()`.
 */
import { type ReactElement, isValidElement } from 'react';
import type { CMSComponent } from '../../model/cms';
import type { CmsAdapter } from '../CmsAdapter';

interface CmsAdapterContractOptions {
  /** Display name used in the `describe` block. */
  readonly name: string;
  /** Adapter identifier expected on the instance. */
  readonly expectedId: string;
  /** Build a fresh, fully-wired adapter instance for each test. */
  readonly build: () => CmsAdapter;
}

const SAMPLE_COMPONENT: CMSComponent = {
  id: 'sample-1',
  type: 'button',
  title: 'Sample',
  link: '/',
};

function isCmsNoResult(value: unknown): value is { notfound?: boolean; message?: string } {
  return typeof value === 'object' && value !== null && 'notfound' in value;
}

export function runCmsAdapterContract({ name, expectedId, build }: CmsAdapterContractOptions): void {
  describe(`CmsAdapter contract — ${name}`, () => {
    let adapter: CmsAdapter;

    beforeEach(() => {
      adapter = build();
    });

    describe('identity', () => {
      it('exposes a non-empty string `id`', () => {
        expect(typeof adapter.id).toBe('string');
        expect(adapter.id.length).toBeGreaterThan(0);
      });

      it('reports its declared provider id', () => {
        expect(adapter.id).toBe(expectedId);
      });
    });

    describe('hasContent()', () => {
      it('returns a boolean and never throws', () => {
        expect(() => adapter.hasContent()).not.toThrow();
        expect(typeof adapter.hasContent()).toBe('boolean');
      });
    });

    describe('getPage(slug, locale, site)', () => {
      it('resolves (does not reject) for a non-existent slug — adapters surface no-result via `{ notfound: true }`', async () => {
        const result = await adapter.getPage('definitely-does-not-exist', 'en', '_default_');
        expect(result).toBeDefined();
        // Either a CMSPage (with components array) or a CMSNoResult (notfound).
        if ('components' in result) {
          expect(Array.isArray(result.components)).toBe(true);
        } else {
          expect(isCmsNoResult(result)).toBe(true);
        }
      });
    });

    describe('getNavigation(locale, site)', () => {
      it('resolves and never rejects', async () => {
        await expect(adapter.getNavigation('en', '_default_')).resolves.toBeDefined();
      });
    });

    describe('optional surface — getEditableProps', () => {
      it('returns a plain DOM-attribute object (no React element) when implemented', () => {
        if (typeof adapter.getEditableProps !== 'function') {
          return; // optional — DelegatingCmsService falls back to `{}`.
        }
        const props = adapter.getEditableProps(SAMPLE_COMPONENT);
        expect(typeof props).toBe('object');
        expect(props).not.toBeNull();
        // Must NOT be a React element — Editable-Props contract forbids wrapper tags.
        expect(isValidElement(props as unknown as ReactElement)).toBe(false);
      });
    });

    describe('optional surface — BridgeScript', () => {
      it('is either undefined or a renderable component type', () => {
        if (adapter.BridgeScript === undefined) {
          return; // optional — DelegatingCmsService exposes `null`.
        }
        expect(typeof adapter.BridgeScript).toBe('function');
      });
    });
  });
}
