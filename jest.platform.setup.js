// This file is run before each test file
// Add any global setup here

// Keep test output concise by default; opt in with JEST_DEBUG_API=true.
if (process.env.JEST_DEBUG_API !== 'true') {
  process.env.NEXT_PUBLIC_DEBUG_API_CURL = 'false';
  process.env.NEXT_PUBLIC_DEBUG_API_RESPONSE = 'off';
  process.env.NEXT_DEBUG_API_PAYLOAD = 'false';
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
