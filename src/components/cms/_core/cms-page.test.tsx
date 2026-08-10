/**
 * Acceptance contract for `CmsPage` — the provider-agnostic CMS page shell
 * wired into the `(no-margin)` route group (`page.tsx` + `[...slug]/page.tsx`).
 *
 * `CmsPage` is an async React Server Component. It resolves the active
 * `CMSService` from the DI container, fetches a page through the agnostic
 * `getPage(slug, locale, site)` facade, and delegates body rendering to the
 * map-driven `CmsRenderer`. No provider SDK is referenced — a CMS-provider
 * swap is transparent to this shell.
 *
 * Behaviour contract pinned here:
 * - Server boundary: the page is fetched through `getCmsService()`, the
 *   SSR lazy-bind helper that resolves `CMSService` off the active container
 *   instance — never by direct instantiation, never via a bare
 *   `ssr.get('CMSService')` that can hit an unbound render-graph container.
 * - Valid `CMSPage`: every entry in `components[]` is handed to `CmsRenderer`.
 * - `CMSNoResult` + `emptyOnNoResult` falsy: `notFound()` is invoked.
 * - `CMSNoResult` + `emptyOnNoResult` true: `notFound()` is NOT invoked; a
 *   spacer shell is rendered instead.
 * - A payload that is neither a not-found marker nor a `components`-bearing
 *   page also funnels into `notFound()` (defence-in-depth).
 * - `no_margin` toggle: the layout wrapper carries the spacer classes only
 *   when `no_margin` is falsy.
 *
 * `CmsRenderer` is mocked here so the shell's own branching is isolated from
 * the component-map lookup (the renderer carries its own dedicated test).
 * `notFound()` is mocked as a throwing function — mirroring its real Next.js
 * control-flow behaviour of halting render — and asserted per branch.
 */
import { notFound } from 'next/navigation';
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import type { CMSService } from '@/platform/services/cms/CMSService';
import { getCmsService } from '@/platform/services/cms/get-cms-service';
import type { CMSComponent, CMSNoResult, CMSPage as CMSPageModel } from '@/platform/services/model/cms';
import CmsPage from './cms-page';

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

jest.mock('@/platform/services/cms/get-cms-service', () => ({
  __esModule: true,
  getCmsService: jest.fn(),
}));

jest.mock('./cms-renderer', () => ({
  CmsRenderer: ({ component, pageBody }: { component: CMSComponent; pageBody?: CMSComponent[] }) => (
    <div
      data-testid="cms-renderer"
      data-component-id={component.id}
      data-component-type={component.type}
      data-page-body-ids={(pageBody ?? []).map((c) => c.id).join(',')}
    />
  ),
}));

const mockGetPage = jest.fn<Promise<CMSPageModel | CMSNoResult>, [string, string, string]>();
const mockGetLayout = jest.fn<Promise<unknown>, [string, string, string]>();
const getCmsServiceMock = getCmsService as jest.Mock;
const notFoundMock = notFound as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetPage.mockReset();
  mockGetLayout.mockReset();
  // Default: no layout resolves -> shell renders the page body directly
  // (the backward-compatible path the original suite was written against).
  mockGetLayout.mockResolvedValue({ notfound: true });
  getCmsServiceMock.mockResolvedValue({
    getPage: mockGetPage,
    getLayout: mockGetLayout,
  } as unknown as CMSService);
  // Re-apply the throwing impl: clearAllMocks() strips the factory-defined
  // implementation, so without this notFound() would be a no-op and the
  // shell would fall through to the components.map branch — mirror Next's
  // real control-flow halt instead.
  notFoundMock.mockImplementation(() => {
    throw new Error('NEXT_NOT_FOUND');
  });
});

const COMPONENT_A = { id: 'cmp-a', type: 'button', title: 'Alpha', link: '/a' } as unknown as CMSComponent;
const COMPONENT_B = { id: 'cmp-b', type: 'button', title: 'Beta', link: '/b' } as unknown as CMSComponent;

const makePage = (overrides: Partial<CMSPageModel> = {}): CMSPageModel => ({
  title: 'Demo',
  description: '',
  url: '/demo',
  components: [COMPONENT_A, COMPONENT_B],
  ...overrides,
});

describe('CmsPage — server boundary (lazy-bind helper)', () => {
  it('resolves CMSService through getCmsService() and fetches via getPage(slug, locale, site)', async () => {
    mockGetPage.mockResolvedValue(makePage());

    render(await CmsPage({ slug: '/demo', locale: 'en', site: 'main' }));

    expect(getCmsServiceMock).toHaveBeenCalledTimes(1);
    expect(mockGetPage).toHaveBeenCalledWith('/demo', 'en', 'main');
  });
});

describe('CmsPage — valid CMSPage renders the body', () => {
  it('hands every components[] entry to CmsRenderer, in order', async () => {
    mockGetPage.mockResolvedValue(makePage());

    const { getAllByTestId } = render(await CmsPage({ slug: '/demo', locale: 'en', site: 'main' }));

    const rendered = getAllByTestId('cms-renderer');
    expect(rendered).toHaveLength(2);
    expect(rendered.map((el) => el.dataset.componentId)).toEqual(['cmp-a', 'cmp-b']);
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it('renders an empty body without invoking notFound when components[] is empty', async () => {
    mockGetPage.mockResolvedValue(makePage({ components: [] }));

    const { queryAllByTestId } = render(await CmsPage({ slug: '/demo', locale: 'en', site: 'main' }));

    expect(queryAllByTestId('cms-renderer')).toHaveLength(0);
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});

describe('CmsPage — notfound × emptyOnNoResult matrix', () => {
  it('invokes notFound() on CMSNoResult when emptyOnNoResult is falsy', async () => {
    mockGetPage.mockResolvedValue({ notfound: true } satisfies CMSNoResult);

    await expect(CmsPage({ slug: '/missing', locale: 'en', site: 'main' })).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT invoke notFound() on CMSNoResult when emptyOnNoResult is true (renders spacer shell)', async () => {
    mockGetPage.mockResolvedValue({ notfound: true } satisfies CMSNoResult);

    const { container } = render(
      await CmsPage({ slug: '/missing', locale: 'en', site: 'main', emptyOnNoResult: true }),
    );

    expect(notFoundMock).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="cms-renderer"]')).toBeNull();
    expect(container.firstElementChild).toHaveClass('flex-grow');
  });

  it('invokes notFound() for a payload that is neither a not-found marker nor a components-bearing page', async () => {
    // Deliberately off-contract: no `notfound: true` flag and no `components`.
    // The tightened `CMSNoResult` type rejects this shape (that is the point —
    // it models a degenerate runtime payload), so cast through `unknown`.
    mockGetPage.mockResolvedValue({ message: 'nothing here' } as unknown as CMSNoResult);

    await expect(CmsPage({ slug: '/weird', locale: 'en', site: 'main' })).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });
});

describe('CmsPage — no_margin layout toggle', () => {
  it('applies the spacer margin classes when no_margin is falsy', async () => {
    mockGetPage.mockResolvedValue(makePage({ no_margin: false }));

    const { container } = render(await CmsPage({ slug: '/demo', locale: 'en', site: 'main' }));

    const wrapper = container.firstElementChild;
    expect(wrapper).toHaveClass('flex-grow', 'mt-17', 'sm:mt-36', 'md:mt-52');
  });

  it('omits the spacer margin classes when no_margin is true', async () => {
    mockGetPage.mockResolvedValue(makePage({ no_margin: true }));

    const { container } = render(await CmsPage({ slug: '/demo', locale: 'en', site: 'main' }));

    const wrapper = container.firstElementChild;
    expect(wrapper).not.toHaveClass('flex-grow');
    expect(wrapper?.className).toBe('');
  });
});

describe('CmsPage — layout frame', () => {
  const makeLayout = () => ({
    id: 'layout-1',
    type: 'layout' as const,
    body: [{ id: 'slot-1', type: 'content-slot' }],
  });

  it('fetches the layout for page.layoutId and renders the layout tree with the page body threaded as pageBody', async () => {
    mockGetPage.mockResolvedValue(makePage({ layoutId: 'marketing' }));
    mockGetLayout.mockResolvedValue(makeLayout());

    const { getAllByTestId } = render(await CmsPage({ slug: '/demo', locale: 'en', site: 'main' }));

    expect(mockGetLayout).toHaveBeenCalledWith('marketing', 'en', 'main');
    // Single render call for the layout root, carrying the page body.
    const rendered = getAllByTestId('cms-renderer');
    expect(rendered).toHaveLength(1);
    expect(rendered[0]?.dataset.componentType).toBe('layout');
    expect(rendered[0]?.dataset.pageBodyIds).toBe('cmp-a,cmp-b');
  });

  it("defaults to the 'default' layout id when the page declares none", async () => {
    mockGetPage.mockResolvedValue(makePage());
    mockGetLayout.mockResolvedValue(makeLayout());

    render(await CmsPage({ slug: '/demo', locale: 'en', site: 'main' }));

    expect(mockGetLayout).toHaveBeenCalledWith('default', 'en', 'main');
  });

  it('falls back to rendering the page body directly when no layout resolves', async () => {
    mockGetPage.mockResolvedValue(makePage());
    mockGetLayout.mockResolvedValue({ notfound: true });

    const { getAllByTestId } = render(await CmsPage({ slug: '/demo', locale: 'en', site: 'main' }));

    const rendered = getAllByTestId('cms-renderer');
    expect(rendered.map((el) => el.dataset.componentId)).toEqual(['cmp-a', 'cmp-b']);
  });
});
