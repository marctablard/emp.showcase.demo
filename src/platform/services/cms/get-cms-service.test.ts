/**
 * Branch tests for `getCmsService` — the SSR-only lazy-bind helper that
 * routes `CMSService` lookups around the module-graph-split problem.
 *
 * Behaviour contract pinned here (Slice-4 version — plain alias only, no
 * composite/default-content fallback layer):
 * - If the SSR container already has `CmsAdapter` bound, the helper does
 *   NOT touch the binding — just resolves and returns `CMSService`.
 * - If `CmsAdapter` is NOT bound on the resolved-at-call-site container,
 *   the helper resolves the provider id from `process.env`, alias-binds
 *   `CmsAdapter` -> `CmsAdapter:<id>`, and returns `CMSService`.
 * - When the env-resolved target alias (`CmsAdapter:<id>`) is itself not
 *   bound, the helper falls back to `CmsAdapter:none` so the app boots on
 *   a partially-configured container (NullCmsAdapter safety net).
 *
 * The container is mocked — we are not exercising the DI library here, we
 * are pinning that the helper hits the correct `isBound`/`bind`/`get`
 * sequence under each branch.
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

const resolveCmsProviderMock = jest.fn();

jest.mock('@/platform/ssr', () => ({
  __esModule: true,
  default: mockContainer,
}));

jest.mock('./CmsProviderResolver', () => ({
  __esModule: true,
  resolveCmsProvider: (...args: unknown[]) => resolveCmsProviderMock(...args),
}));

const FAKE_CMS_SERVICE = { __marker: 'cms-service' } as unknown as CMSService;

beforeEach(() => {
  mockContainer.isBound.mockReset();
  mockContainer.bind.mockReset();
  mockContainer.get.mockReset();
  resolveCmsProviderMock.mockReset();

  mockContainer.get.mockReturnValue(FAKE_CMS_SERVICE);
  // Default `bind(...).toService(...)` chain returns void; emulate it.
  mockContainer.bind.mockReturnValue({ toService: jest.fn() });
});

describe('getCmsService — alias already bound (idempotent)', () => {
  it('does NOT rebind when `CmsAdapter` is already bound and returns CMSService', async () => {
    mockContainer.isBound.mockImplementation((id: string) => id === 'CmsAdapter');

    const service = await getCmsService();

    expect(service).toBe(FAKE_CMS_SERVICE);
    expect(resolveCmsProviderMock).not.toHaveBeenCalled();
    expect(mockContainer.bind).not.toHaveBeenCalled();
    expect(mockContainer.get).toHaveBeenCalledWith('CMSService');
  });
});

describe('getCmsService — alias not bound, env-resolved target available', () => {
  it('alias-binds `CmsAdapter` -> `CmsAdapter:<providerId>` when the env-resolved target is bound', async () => {
    resolveCmsProviderMock.mockReturnValue('storyblok');
    mockContainer.isBound.mockImplementation((id: string) => {
      if (id === 'CmsAdapter') return false;
      if (id === 'CmsAdapter:storyblok') return true;
      return false;
    });
    const toService = jest.fn();
    mockContainer.bind.mockReturnValue({ toService });

    const service = await getCmsService();

    expect(service).toBe(FAKE_CMS_SERVICE);
    expect(resolveCmsProviderMock).toHaveBeenCalledWith(process.env);
    expect(mockContainer.bind).toHaveBeenCalledWith('CmsAdapter');
    expect(toService).toHaveBeenCalledWith('CmsAdapter:storyblok');
    expect(mockContainer.get).toHaveBeenCalledWith('CMSService');
  });
});

describe('getCmsService — alias not bound, env-resolved target missing', () => {
  it('falls back to `CmsAdapter:none` when `CmsAdapter:<providerId>` is not bound', async () => {
    resolveCmsProviderMock.mockReturnValue('storyblok');
    mockContainer.isBound.mockImplementation((id: string) => {
      if (id === 'CmsAdapter') return false;
      if (id === 'CmsAdapter:storyblok') return false;
      return false;
    });
    const toService = jest.fn();
    mockContainer.bind.mockReturnValue({ toService });

    const service = await getCmsService();

    expect(service).toBe(FAKE_CMS_SERVICE);
    expect(mockContainer.bind).toHaveBeenCalledWith('CmsAdapter');
    expect(toService).toHaveBeenCalledWith('CmsAdapter:none');
    expect(mockContainer.get).toHaveBeenCalledWith('CMSService');
  });
});

describe('getCmsService — provider resolves to `none`', () => {
  it('alias-binds `CmsAdapter` -> `CmsAdapter:none` when the resolved provider is `none` and its target is bound', async () => {
    resolveCmsProviderMock.mockReturnValue('none');
    mockContainer.isBound.mockImplementation((id: string) => {
      if (id === 'CmsAdapter') return false;
      if (id === 'CmsAdapter:none') return true;
      return false;
    });
    const toService = jest.fn();
    mockContainer.bind.mockReturnValue({ toService });

    const service = await getCmsService();

    expect(service).toBe(FAKE_CMS_SERVICE);
    expect(toService).toHaveBeenCalledWith('CmsAdapter:none');
    expect(mockContainer.get).toHaveBeenCalledWith('CMSService');
  });
});
