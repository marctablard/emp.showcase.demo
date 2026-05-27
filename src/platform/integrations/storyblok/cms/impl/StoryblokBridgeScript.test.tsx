/**
 * @jest-environment jsdom
 */
/**
 * Acceptance contract for `StoryblokBridgeScript` — the client-side
 * Visual-Editor bridge that replaces the legacy `StoryblokProvider`.
 *
 * The bridge is the adapter's `BridgeScript` component type: the layout
 * mounts it once (`<BridgeScript />`, standalone, NOT as a children
 * wrapper). It bootstraps the Storyblok bridge SDK when an access token is
 * configured and renders `null` either way — it adds no DOM of its own.
 *
 * Behaviour pinned here (matches the legacy `StoryblokProvider` token
 * guard):
 *  - With `NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN` set → calls `storyblokInit`
 *    once on mount with `{ accessToken, bridge: true }`.
 *  - Without a token → renders `null`, never calls `storyblokInit` (the
 *    app boots without a Storyblok token).
 *  - Renders `null` regardless — no wrapper DOM node.
 *  - `'use client'` directive remains at the file head.
 */
import { createElement } from 'react';
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import * as fs from 'node:fs';
import * as path from 'node:path';

const mockStoryblokInit = jest.fn();

jest.mock('@storyblok/react/rsc', () => ({
  __esModule: true,
  apiPlugin: { plugin: 'api' },
  storyblokInit: (...args: unknown[]) => mockStoryblokInit(...args),
}));

const originalToken = process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN;

beforeEach(() => {
  mockStoryblokInit.mockReset();
  mockStoryblokInit.mockImplementation(() => () => ({}));
  delete process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN;
});

afterAll(() => {
  if (originalToken === undefined) {
    delete process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN;
  } else {
    process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN = originalToken;
  }
});

describe('StoryblokBridgeScript — token guard', () => {
  it('renders null and does NOT call storyblokInit when no token is configured', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- defer module-load to after env reset
    const { StoryblokBridgeScript } = require('./StoryblokBridgeScript');

    const { container } = render(createElement(StoryblokBridgeScript));

    expect(container.firstChild).toBeNull();
    expect(mockStoryblokInit).not.toHaveBeenCalled();
  });

  it('does NOT call storyblokInit for a whitespace-only token', () => {
    process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN = '   ';
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- defer module-load to after env reset
    const { StoryblokBridgeScript } = require('./StoryblokBridgeScript');

    render(createElement(StoryblokBridgeScript));

    expect(mockStoryblokInit).not.toHaveBeenCalled();
  });

  it('calls storyblokInit once with the configured access token and bridge enabled', () => {
    process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN = 'tk-bridge';
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- defer module-load to after env reset
    const { StoryblokBridgeScript } = require('./StoryblokBridgeScript');

    render(createElement(StoryblokBridgeScript));

    expect(mockStoryblokInit).toHaveBeenCalledTimes(1);
    expect(mockStoryblokInit).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'tk-bridge',
        bridge: true,
      }),
    );
  });
});

describe('StoryblokBridgeScript — render contract', () => {
  it('returns null — no wrapper DOM node added to the document (token set)', () => {
    process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN = 'tk';
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- defer module-load to after env reset
    const { StoryblokBridgeScript } = require('./StoryblokBridgeScript');

    const { container } = render(createElement(StoryblokBridgeScript));

    expect(container.firstChild).toBeNull();
  });

  it('does not throw on first render', () => {
    process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN = 'tk';
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- defer module-load to after env reset
    const { StoryblokBridgeScript } = require('./StoryblokBridgeScript');

    expect(() => render(createElement(StoryblokBridgeScript))).not.toThrow();
  });

  it('does not throw on unmount (cleanup-safe)', () => {
    process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN = 'tk';
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- defer module-load to after env reset
    const { StoryblokBridgeScript } = require('./StoryblokBridgeScript');

    const { unmount } = render(createElement(StoryblokBridgeScript));

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
