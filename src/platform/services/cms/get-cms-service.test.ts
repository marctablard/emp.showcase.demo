/**
 * Branch tests for `getCmsService` — the SSR-only lazy-bind helper that
 * routes `CMSService` lookups around the module-graph-split problem.
 *
 * Behaviour contract pinned here (Phase-G version — the not-bound branch now
 * DELEGATES the whole alias/composite decision to `bindActiveCmsAdapter`):
 * - If the SSR container already has `CmsAdapter` bound, the helper does
 *   NOT touch the binding and does NOT call `bindActiveCmsAdapter` — it just
 *   resolves and returns `CMSService`.
 * - If `CmsAdapter` is NOT bound on the resolved-at-call-site container, the
 *   helper calls `bindActiveCmsAdapter(container)` exactly once (which owns
 *   the env-resolution, alias-vs-composite, primary/none-fallback and
 *   idempotency logic — covered by its own test) and then returns
 *   `CMSService`.
 *
 * The container and `bindActiveCmsAdapter` are mocked — we are pinning the
 * `isBound` gate + the delegation, NOT re-testing the binding rules here.
 */
import type { CMSService } from './CMSService';
// Imported AFTER the mocks so the helper picks the mocked modules up.
// eslint-disable-next-line import-x/first
import { getCmsService } from './get-cms-service';

type ContainerMock = {
  isBound: jest.Mock;
  bind: jest.Mock;
  get: jest.Mock;
};

const mockContainer: ContainerMock = {
  isBound: jest.fn(),
  bind: jest.fn(),
  get: jest.fn(),
};

const bindActiveCmsAdapterMock = jest.fn();

jest.mock('@/platform/ssr', () => ({
  __esModule: true,
  default: mockContainer,
}));

jest.mock('./bind-active-cms-adapter', () => ({
  __esModule: true,
  bindActiveCmsAdapter: (...args: unknown[]) => bindActiveCmsAdapterMock(...args),
}));

const FAKE_CMS_SERVICE = { __marker: 'cms-service' } as unknown as CMSService;

beforeEach(() => {
  mockContainer.isBound.mockReset();
  mockContainer.bind.mockReset();
  mockContainer.get.mockReset();
  bindActiveCmsAdapterMock.mockReset();

  mockContainer.get.mockReturnValue(FAKE_CMS_SERVICE);
});

describe('getCmsService — alias already bound (idempotent)', () => {
  it('does NOT call bindActiveCmsAdapter when `CmsAdapter` is already bound and returns CMSService', async () => {
    mockContainer.isBound.mockImplementation((id: string) => id === 'CmsAdapter');

    const service = await getCmsService();

    expect(service).toBe(FAKE_CMS_SERVICE);
    expect(bindActiveCmsAdapterMock).not.toHaveBeenCalled();
    expect(mockContainer.bind).not.toHaveBeenCalled();
    expect(mockContainer.get).toHaveBeenCalledWith('CMSService');
  });
});

describe('getCmsService — alias not bound (delegates to bindActiveCmsAdapter)', () => {
  it('calls bindActiveCmsAdapter exactly once with the container, then returns CMSService', async () => {
    mockContainer.isBound.mockImplementation((id: string) => id !== 'CmsAdapter');

    const service = await getCmsService();

    expect(service).toBe(FAKE_CMS_SERVICE);
    expect(bindActiveCmsAdapterMock).toHaveBeenCalledTimes(1);
    expect(bindActiveCmsAdapterMock).toHaveBeenCalledWith(mockContainer);
    expect(mockContainer.get).toHaveBeenCalledWith('CMSService');
  });

  it('returns the CMSService resolved AFTER the delegation has run', async () => {
    mockContainer.isBound.mockImplementation((id: string) => id !== 'CmsAdapter');

    const service = await getCmsService();

    expect(service).toBe(FAKE_CMS_SERVICE);
    // get('CMSService') is the last thing the helper does — the delegation
    // must have happened before the resolve.
    const bindOrder = bindActiveCmsAdapterMock.mock.invocationCallOrder[0];
    const getOrder = mockContainer.get.mock.invocationCallOrder[0];
    expect(bindOrder).toBeLessThan(getOrder);
  });
});
