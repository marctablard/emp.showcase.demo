/**
 * @jest-environment jsdom
 */
/**
 * Acceptance contract for `StoryblokBridgeScript` — the client-side
 * Visual-Editor bridge that replaces the legacy `StoryblokProvider`.
 *
 * The bridge is the adapter's `BridgeScript` component type: the layout
 * mounts it once (`<BridgeScript />`, standalone, NOT as a children
 * wrapper). It bootstraps the Storyblok bridge SDK only when the server
 * action `getStoryblokBridgeConfig` resolves a config object — the access
 * token never reaches the browser bundle. The component itself adds no
 * DOM of its own.
 *
 * Behaviour pinned here:
 *  - `getStoryblokBridgeConfig()` resolves null → no `storyblokInit` call
 *    (the bridge stays a no-op; the app still boots).
 *  - `getStoryblokBridgeConfig()` resolves `{ accessToken }` → exactly one
 *    `storyblokInit({ accessToken, bridge: true })` call.
 *  - `getStoryblokBridgeConfig()` rejects → no `storyblokInit` call (the
 *    bridge fails safe and the page keeps rendering).
 *  - Renders `null` regardless — no wrapper DOM node.
 *  - `'use client'` directive remains at the file head.
 */
import { createElement } from 'react';
import '@testing-library/jest-dom';
import { act, render } from '@testing-library/react';
import * as fs from 'node:fs';
import * as path from 'node:path';

const mockStoryblokInit = jest.fn();
const mockGetStoryblokBridgeConfig = jest.fn();

jest.mock('@storyblok/react/rsc', () => ({
  __esModule: true,
  apiPlugin: { plugin: 'api' },
  storyblokInit: (...args: unknown[]) => mockStoryblokInit(...args),
}));

jest.mock('@/app/_actions/storyblok-bridge', () => ({
  __esModule: true,
  getStoryblokBridgeConfig: (...args: unknown[]) => mockGetStoryblokBridgeConfig(...args),
}));

beforeEach(() => {
  mockStoryblokInit.mockReset();
  mockStoryblokInit.mockImplementation(() => () => ({}));
  mockGetStoryblokBridgeConfig.mockReset();
  // Default: the bridge is a no-op. Each test that exercises the init path
  // explicitly overrides this with mockResolvedValueOnce / mockRejectedValueOnce.
  mockGetStoryblokBridgeConfig.mockResolvedValue(null);
});

async function flushAsyncEffects() {
  // The component runs the action inside `useEffect`. Wait for the resolved
  // microtask queue to drain so post-resolution assertions are deterministic.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('StoryblokBridgeScript — bridge bootstrap via server action', () => {
  it('does NOT call storyblokInit when getStoryblokBridgeConfig() resolves null', async () => {
    mockGetStoryblokBridgeConfig.mockResolvedValueOnce(null);
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- defer module-load to after mock setup
    const { StoryblokBridgeScript } = require('./StoryblokBridgeScript');

    render(createElement(StoryblokBridgeScript));
    await flushAsyncEffects();

    expect(mockStoryblokInit).not.toHaveBeenCalled();
  });

  it('calls storyblokInit once with the returned accessToken when getStoryblokBridgeConfig() resolves a config', async () => {
    mockGetStoryblokBridgeConfig.mockResolvedValueOnce({ accessToken: 'tk-bridge' });
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- defer module-load to after mock setup
    const { StoryblokBridgeScript } = require('./StoryblokBridgeScript');

    render(createElement(StoryblokBridgeScript));
    await flushAsyncEffects();

    expect(mockStoryblokInit).toHaveBeenCalledTimes(1);
    expect(mockStoryblokInit).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'tk-bridge',
        bridge: true,
      }),
    );
  });

  it('does NOT call storyblokInit when getStoryblokBridgeConfig() rejects', async () => {
    mockGetStoryblokBridgeConfig.mockRejectedValueOnce(new Error('action failed'));
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- defer module-load to after mock setup
    const { StoryblokBridgeScript } = require('./StoryblokBridgeScript');

    render(createElement(StoryblokBridgeScript));
    await flushAsyncEffects();

    expect(mockStoryblokInit).not.toHaveBeenCalled();
  });

  it('does NOT call storyblokInit when component unmounts before getStoryblokBridgeConfig resolves', async () => {
    // Deferred promise: the action stays pending until we explicitly resolve
    // it after unmount. This pins the in-flight `cancelled` guard in the
    // component's effect — without it, the resolved config would still drive
    // the bridge bootstrap on a torn-down component.
    let resolveAction: (value: { accessToken: string } | null) => void = () => {};
    const pending = new Promise<{ accessToken: string } | null>((resolve) => {
      resolveAction = resolve;
    });
    mockGetStoryblokBridgeConfig.mockReturnValueOnce(pending);
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- defer module-load to after mock setup
    const { StoryblokBridgeScript } = require('./StoryblokBridgeScript');

    const { unmount } = render(createElement(StoryblokBridgeScript));
    unmount();

    await act(async () => {
      resolveAction({ accessToken: 'tk-bridge' });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockStoryblokInit).not.toHaveBeenCalled();
  });
});

describe('StoryblokBridgeScript — render contract', () => {
  it('returns null — no wrapper DOM node added to the document (config resolved)', async () => {
    mockGetStoryblokBridgeConfig.mockResolvedValueOnce({ accessToken: 'tk' });
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- defer module-load to after mock setup
    const { StoryblokBridgeScript } = require('./StoryblokBridgeScript');

    const { container } = render(createElement(StoryblokBridgeScript));
    await flushAsyncEffects();

    expect(container.firstChild).toBeNull();
  });

  it('does not throw on first render', async () => {
    mockGetStoryblokBridgeConfig.mockResolvedValueOnce({ accessToken: 'tk' });
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- defer module-load to after mock setup
    const { StoryblokBridgeScript } = require('./StoryblokBridgeScript');

    expect(() => render(createElement(StoryblokBridgeScript))).not.toThrow();
    await flushAsyncEffects();
  });

  it('does not throw on unmount (cleanup-safe)', async () => {
    mockGetStoryblokBridgeConfig.mockResolvedValueOnce({ accessToken: 'tk' });
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- defer module-load to after mock setup
    const { StoryblokBridgeScript } = require('./StoryblokBridgeScript');

    const { unmount } = render(createElement(StoryblokBridgeScript));
    await flushAsyncEffects();

    expect(() => unmount()).not.toThrow();
  });
});

describe('StoryblokBridgeScript — `use client` semantics', () => {
  it("declares 'use client' before the first import (verified by file-header introspection)", () => {
    const filePath = path.resolve(__dirname, './StoryblokBridgeScript.tsx');
    const source = fs.readFileSync(filePath, 'utf8');

    expect(source).toMatch(/^['"]use client['"];?\s*$/m);
    const firstImportIdx = source.search(/^(import|export)\b/m);
    const directiveIdx = source.search(/^['"]use client['"];?\s*$/m);
    expect(directiveIdx).toBeGreaterThanOrEqual(0);
    expect(directiveIdx).toBeLessThan(firstImportIdx);
  });
});
