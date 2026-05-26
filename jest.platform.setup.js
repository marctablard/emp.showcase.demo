// This file is run before each test file
// Add any global setup here

// Keep test output concise by default; opt in with JEST_DEBUG_API=true.
if (process.env.JEST_DEBUG_API !== 'true') {
  process.env.NEXT_PUBLIC_DEBUG_API_CURL = 'false';
  process.env.NEXT_PUBLIC_DEBUG_API_RESPONSE = 'off';
  process.env.NEXT_DEBUG_API_PAYLOAD = 'false';
}

// Default CMS provider for jest. The middleware preview-detector-registry
// dispatches off this id; the production middleware flow (e.g. preview-
// rewrite) needs a real dispatch target, not 'none'. Resolver tests inject
// their own env argument and ignore process.env, so this default is safe
// to apply globally. Developer-set values via `.env.test` or env-injection
// in CI still win because we only seed when unset.
if (!process.env.NEXT_PUBLIC_CMS_PROVIDER) {
  process.env.NEXT_PUBLIC_CMS_PROVIDER = 'storyblok';
}

// Reset all mocks after each test
afterEach(() => {
  jest.resetAllMocks();
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
