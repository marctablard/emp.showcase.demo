/**
 * Branch tests for `bindActiveCmsAdapter` — the server-only helper that
 * decides whether to bind the `CmsAdapter` alias as a plain alias to the
 * active primary, or to wrap it in a `FallbackCmsAdapter` composite
 * (EMP-16 Phase G).
 *
 * Behaviour contract pinned here (the container is mocked — we are pinning
 * the bind/unbind/get sequence under each branch, NOT exercising Inversify):
 * - No fallback configured (`resolveCmsFallbackProvider` → null): bind
 *   `CmsAdapter` as a plain alias (`.toService(primaryTarget)`), no composite.
 * - Fallback configured AND its target bound: resolve primary + fallback +
 *   logger from the container and bind `CmsAdapter` to a
 *   `toConstantValue(new FallbackCmsAdapter(...))`. The constant is an actual
 *   `FallbackCmsAdapter` instance.
 * - Fallback == primary (self-wrap, surfaced by resolver as null): plain
 *   alias, no composite.
 * - Fallback configured but its target NOT bound on this container: degrade
 *   to the plain-alias path (composite needs a real fallback source).
 * - When the env-resolved primary target is itself not bound, fall back to
 *   `CmsAdapter:none`.
 * - Idempotency: when `CmsAdapter` is already bound, `unbind('CmsAdapter')`
 *   is called before the (re)bind, on BOTH the alias and the composite path.
 *
 * `FallbackCmsAdapter` is intentionally NOT mocked: the composite-path tests
 * assert `instanceof FallbackCmsAdapter`, which requires the real class.
 *
 * Tier: Platform tests (Jest `Platform Tests` project, node env).
 */
// Imported AFTER the mocks so the helper picks the mocked modules up.
// eslint-disable-next-line import-x/first
import { bindActiveCmsAdapter } from './bind-active-cms-adapter';
import { FallbackCmsAdapter } from './impl/FallbackCmsAdapter';

type ContainerMock = {
  isBound: jest.Mock;
  bind: jest.Mock;
  unbind: jest.Mock;
  get: jest.Mock;
};

const resolveCmsProviderMock = jest.fn();
const resolveCmsFallbackProviderMock = jest.fn();
const getPublicCmsLocalDefaultSiteMock = jest.fn();

jest.mock('server-only', () => ({}));

jest.mock('./CmsProviderResolver', () => ({
  __esModule: true,
  resolveCmsProvider: (...args: unknown[]) => resolveCmsProviderMock(...args),
  resolveCmsFallbackProvider: (...args: unknown[]) => resolveCmsFallbackProviderMock(...args),
}));

jest.mock('@/lib/common/public-default-env', () => ({
  __esModule: true,
  getPublicCmsLocalDefaultSite: (...args: unknown[]) => getPublicCmsLocalDefaultSiteMock(...args),
}));

// Sentinels returned by container.get for each known target id.
const PRIMARY_ADAPTER = { id: 'storyblok-primary' };
const FALLBACK_ADAPTER = { id: 'local-fallback' };
const LOGGER = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

function buildContainer(boundIds: Set<string>): ContainerMock {
  const toService = jest.fn();
  const toConstantValue = jest.fn();
  return {
    isBound: jest.fn((id: string) => boundIds.has(id)),
    bind: jest.fn(() => ({ toService, toConstantValue })),
    unbind: jest.fn(),
    get: jest.fn((id: string) => {
      if (id === 'CmsAdapter:storyblok') return PRIMARY_ADAPTER;
      if (id === 'CmsAdapter:local') return FALLBACK_ADAPTER;
      if (id === 'LoggerService') return LOGGER;
      return undefined;
    }),
  };
}

beforeEach(() => {
  resolveCmsProviderMock.mockReset();
  resolveCmsFallbackProviderMock.mockReset();
  getPublicCmsLocalDefaultSiteMock.mockReset();

  resolveCmsProviderMock.mockReturnValue('storyblok');
  resolveCmsFallbackProviderMock.mockReturnValue(null);
  getPublicCmsLocalDefaultSiteMock.mockReturnValue('_default_');
});

describe('bindActiveCmsAdapter — no fallback configured (plain alias)', () => {
  it('alias-binds CmsAdapter -> primary target via toService and does not build a composite', () => {
    resolveCmsProviderMock.mockReturnValue('storyblok');
    resolveCmsFallbackProviderMock.mockReturnValue(null);
    const container = buildContainer(new Set(['CmsAdapter:storyblok']));

    bindActiveCmsAdapter(container as never, {} as NodeJS.ProcessEnv);

    expect(container.bind).toHaveBeenCalledWith('CmsAdapter');
    const chain = container.bind.mock.results[0].value;
    expect(chain.toService).toHaveBeenCalledWith('CmsAdapter:storyblok');
    expect(chain.toConstantValue).not.toHaveBeenCalled();
  });

  it('falls back to CmsAdapter:none when the env-resolved primary target is not bound', () => {
    resolveCmsProviderMock.mockReturnValue('storyblok');
    resolveCmsFallbackProviderMock.mockReturnValue(null);
    // Primary target NOT in the bound set.
    const container = buildContainer(new Set());

    bindActiveCmsAdapter(container as never, {} as NodeJS.ProcessEnv);

    const chain = container.bind.mock.results[0].value;
    expect(chain.toService).toHaveBeenCalledWith('CmsAdapter:none');
  });
});

describe('bindActiveCmsAdapter — fallback configured and target bound (composite)', () => {
  it('binds CmsAdapter to a FallbackCmsAdapter constant built from the resolved primary + fallback', () => {
    resolveCmsProviderMock.mockReturnValue('storyblok');
    resolveCmsFallbackProviderMock.mockReturnValue('local');
    getPublicCmsLocalDefaultSiteMock.mockReturnValue('_default_');
    const container = buildContainer(new Set(['CmsAdapter:storyblok', 'CmsAdapter:local', 'LoggerService']));

    bindActiveCmsAdapter(container as never, {} as NodeJS.ProcessEnv);

    expect(container.bind).toHaveBeenCalledWith('CmsAdapter');
    const chain = container.bind.mock.results[0].value;
    expect(chain.toConstantValue).toHaveBeenCalledTimes(1);
    expect(chain.toService).not.toHaveBeenCalled();

    const constant = chain.toConstantValue.mock.calls[0][0];
    expect(constant).toBeInstanceOf(FallbackCmsAdapter);
    expect(constant.id).toBe('fallback');
  });

  it('resolves the local-default site for the composite from getPublicCmsLocalDefaultSite()', () => {
    resolveCmsProviderMock.mockReturnValue('storyblok');
    resolveCmsFallbackProviderMock.mockReturnValue('local');
    const container = buildContainer(new Set(['CmsAdapter:storyblok', 'CmsAdapter:local', 'LoggerService']));

    bindActiveCmsAdapter(container as never, {} as NodeJS.ProcessEnv);

    expect(getPublicCmsLocalDefaultSiteMock).toHaveBeenCalled();
  });
});

describe('bindActiveCmsAdapter — fallback configured but target not bound (degrade to alias)', () => {
  it('binds a plain alias when the fallback target id is not bound on the container', () => {
    resolveCmsProviderMock.mockReturnValue('storyblok');
    resolveCmsFallbackProviderMock.mockReturnValue('local');
    // Fallback target id intentionally absent.
    const container = buildContainer(new Set(['CmsAdapter:storyblok', 'LoggerService']));

    bindActiveCmsAdapter(container as never, {} as NodeJS.ProcessEnv);

    const chain = container.bind.mock.results[0].value;
    expect(chain.toService).toHaveBeenCalledWith('CmsAdapter:storyblok');
    expect(chain.toConstantValue).not.toHaveBeenCalled();
  });
});

describe('bindActiveCmsAdapter — fallback resolves to null (self-wrap guard upstream)', () => {
  it('binds a plain alias, no composite, when resolveCmsFallbackProvider returns null', () => {
    resolveCmsProviderMock.mockReturnValue('local');
    resolveCmsFallbackProviderMock.mockReturnValue(null);
    const container = buildContainer(new Set(['CmsAdapter:local', 'CmsAdapter:storyblok', 'LoggerService']));

    bindActiveCmsAdapter(container as never, {} as NodeJS.ProcessEnv);

    const chain = container.bind.mock.results[0].value;
    expect(chain.toService).toHaveBeenCalledWith('CmsAdapter:local');
    expect(chain.toConstantValue).not.toHaveBeenCalled();
  });
});

describe('bindActiveCmsAdapter — idempotency', () => {
  it('unbinds the existing CmsAdapter binding before rebinding (alias path)', () => {
    resolveCmsProviderMock.mockReturnValue('storyblok');
    resolveCmsFallbackProviderMock.mockReturnValue(null);
    const container = buildContainer(new Set(['CmsAdapter', 'CmsAdapter:storyblok']));

    bindActiveCmsAdapter(container as never, {} as NodeJS.ProcessEnv);

    expect(container.unbind).toHaveBeenCalledWith('CmsAdapter');
    expect(container.bind).toHaveBeenCalledWith('CmsAdapter');
  });

  it('does NOT unbind when CmsAdapter is not yet bound', () => {
    resolveCmsProviderMock.mockReturnValue('storyblok');
    resolveCmsFallbackProviderMock.mockReturnValue(null);
    const container = buildContainer(new Set(['CmsAdapter:storyblok']));

    bindActiveCmsAdapter(container as never, {} as NodeJS.ProcessEnv);

    expect(container.unbind).not.toHaveBeenCalled();
  });

  it('unbinds before rebinding on the composite path too', () => {
    resolveCmsProviderMock.mockReturnValue('storyblok');
    resolveCmsFallbackProviderMock.mockReturnValue('local');
    const container = buildContainer(
      new Set(['CmsAdapter', 'CmsAdapter:storyblok', 'CmsAdapter:local', 'LoggerService']),
    );

    bindActiveCmsAdapter(container as never, {} as NodeJS.ProcessEnv);

    expect(container.unbind).toHaveBeenCalledWith('CmsAdapter');
    const chain = container.bind.mock.results[0].value;
    expect(chain.toConstantValue).toHaveBeenCalledTimes(1);
  });
});
