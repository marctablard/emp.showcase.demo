// This file is run before each test file
// Add any global setup here

// Set up DOM environment for React tests
require('@testing-library/jest-dom');

// jsdom does not implement `window.matchMedia`; libraries like
// `embla-carousel-react` call it eagerly on mount and crash otherwise.
// Provide a minimal no-op polyfill compatible with the standard return
// shape — listeners are inert, which is fine for component-render tests
// that do not exercise responsive behaviour.
const noop = () => {
  // Inert listener: render tests do not exercise responsive behaviour.
};

if (globalThis.window !== undefined && typeof globalThis.window.matchMedia !== 'function') {
  globalThis.window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: noop,
    removeListener: noop,
    addEventListener: noop,
    removeEventListener: noop,
    dispatchEvent: () => false,
  });
}

// jsdom does not implement `IntersectionObserver` / `ResizeObserver`;
// libraries that subscribe to viewport changes (embla-carousel, sticky
// elements, lazy-loaders) crash without these. Inert stubs keep the
// render path alive — tests that need real observer behaviour should
// override locally with `jest.spyOn(window, 'IntersectionObserver')`.
if (globalThis.window !== undefined && globalThis.window.IntersectionObserver === undefined) {
  class IntersectionObserverStub {
    observe() {
      // Inert stub: no viewport intersections are simulated.
    }
    unobserve() {
      // Inert stub: nothing is ever observed.
    }
    disconnect() {
      // Inert stub: nothing is ever observed.
    }
    takeRecords() {
      return [];
    }
  }
  globalThis.window.IntersectionObserver = IntersectionObserverStub;
  globalThis.IntersectionObserver = IntersectionObserverStub;
}
if (globalThis.window !== undefined && globalThis.window.ResizeObserver === undefined) {
  class ResizeObserverStub {
    observe() {
      // Inert stub: no resize events are simulated.
    }
    unobserve() {
      // Inert stub: nothing is ever observed.
    }
    disconnect() {
      // Inert stub: nothing is ever observed.
    }
  }
  globalThis.window.ResizeObserver = ResizeObserverStub;
  globalThis.ResizeObserver = ResizeObserverStub;
}

// Load environment variables from .env.test
require('dotenv').config({ path: '.env.test', quiet: true });

// Keep test output concise by default; opt in with JEST_DEBUG_API=true.
if (process.env.JEST_DEBUG_API !== 'true') {
  process.env.NEXT_PUBLIC_DEBUG_API_CURL = 'false';
  process.env.NEXT_PUBLIC_DEBUG_API_RESPONSE = 'off';
  process.env.NEXT_DEBUG_API_PAYLOAD = 'false';
}

// Default CMS provider for jest. The middleware preview-detector-registry
// dispatches off this id; the production middleware flow needs a real
// dispatch target, not 'none'. Resolver tests inject their own env
// argument and ignore process.env, so this default is safe to apply
// globally. Developer-set values via `.env.test` or env-injection in CI
// still win because we only seed when unset.
if (!process.env.NEXT_CMS_PROVIDER) {
  process.env.NEXT_CMS_PROVIDER = 'storyblok';
}

jest.mock('next-intl', () => {
  return {
    useLocale: () => 'en',
    useTranslations: () => (key) => key,
  };
});

// Silence known benign warnings in test runs
const originalEmitWarning = process.emitWarning;
process.emitWarning = (warning, ...args) => {
  const message = typeof warning === 'string' ? warning : warning?.message;
  if (message && message.includes('--localstorage-file')) {
    return;
  }

  return originalEmitWarning.call(process, warning, ...args);
};

// Reset all mocks after each test
afterEach(() => {
  jest.resetAllMocks();
});
