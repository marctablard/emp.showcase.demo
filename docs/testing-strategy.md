# Testing Strategy Documentation

## Overview

The Emporix Showcase project implements a comprehensive testing strategy using both Jest and Playwright. This document outlines how these testing frameworks are integrated, what types of tests are supported, and how to run them.

## Testing Frameworks

### Jest

Jest is used for unit and integration testing of JavaScript/TypeScript code. It's particularly well-suited for testing:

- React hooks and components
- State management (Zustand stores)
- API services and utilities
- Business logic

### Playwright

Playwright is used for end-to-end (E2E) testing, simulating real user interactions with the application in a browser environment. It's ideal for testing:

- User flows and journeys
- UI rendering and interactions
- Cross-browser compatibility
- Routing and navigation
- Locale handling and internationalization

## Test Structure

### Unit and Integration Tests (Jest)

Unit and integration tests are located alongside the code they test, following a naming convention of `*.test.ts` or `*.test.tsx`. For example:

- `src/hooks/product/useProduct.test.tsx` - Tests for the `useProduct` hook
- `src/platform/integrations/emporix/product/impl/EmporixProductApi.test.ts` - Tests for the Emporix Product API

### End-to-End Tests (Playwright)

E2E tests are located in the `/e2e` directory at the root of the project.

- Root-level specs in `/e2e` are the default environment-agnostic suite and must not depend on tenant-specific env vars or seeded data.
- Specs in `/e2e/local` are opt-in local tests for tenant/data-dependent scenarios and are excluded from `npm run e2e` by default.
- Tracked `*.local.spec.ts` files are committed local-only scenarios that stay out of `npm run e2e`; `e2e/auth-site-sync.local.spec.ts` bootstraps shopper auth through a guarded local route instead of browser credentials, requires `NEXT_E2E_LOCAL_AUTH_BOOTSTRAP_TOKEN`, and runs on a dedicated localhost lane so it does not collide with the default dev server.

Current default-suite examples:

- `e2e/homepage.spec.ts` - Tests for homepage functionality and locale redirects
- `e2e/login-dialog-register.spec.ts` - Tests the login dialog to registration flow

## Dependency Injection in Tests

The Emporix Showcase project uses InversifyJS for dependency injection, which makes testing services and APIs much easier. For detailed information about the dependency injection system, see [Dependency Injection Documentation](./dependency-injection.md).

### Mocking Dependencies

When testing services that have dependencies, you can create test-specific implementations or mocks:

```typescript
// Example of mocking dependencies in a test
import { Container } from 'inversify';
import { MyDependency } from './MyDependency';
import { MyService } from './MyService';

// Create a mock implementation
class MockDependency implements MyDependency {
  someMethod() {
    return 'mocked result';
  }
}

// Set up the container with the mock
const container = new Container();
container.bind<MyDependency>('MyDependency').to(MockDependency);
container.bind<MyService>('MyService').to(MyService);

// Get the service with the mock dependency injected
const service = container.get<MyService>('MyService');
```

## Sample Tests

### Jest Example: Testing a Hook

The project includes a sample test for the `useProduct` hook that demonstrates:

- Testing loading states
- Testing error handling
- Verifying store integration
- Mocking API responses

```typescript
// src/hooks/product/useProduct.test.tsx
import { renderHook, waitFor } from '@testing-library/react';
import { fetchProductById } from '@/lib/client/products';
import { createProductStore } from '@/stores/products-store';
import { ProductStoreContext } from '@/providers/StoreProvider';
import { useProduct } from './useProduct';

// Mock the API module
jest.mock('@/lib/client/products', () => ({
  fetchProductById: jest.fn(),
}));

test('should fetch product and update store with loaded state', async () => {
  // Mock the API response
  (fetchProductById as jest.Mock).mockResolvedValue(mockProduct);

  const sharedStore = createProductStore();
  const wrapper = ({ children }) => (
    <ProductStoreContext.Provider value={sharedStore}>{children}</ProductStoreContext.Provider>
  );

  // Render the hook with the product ID
  const { result } = renderHook(() => useProduct('test-product-123'), { wrapper });

  // Initially, loading should be true
  expect(result.current.loading).toBe(true);

  // Wait for the fetch to complete
  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });

  // After loading, product should be available
  expect(result.current.product).toEqual(mockProduct);
});
```

### Playwright Example: Testing Locale Redirects

The project includes a sample E2E test that verifies locale handling:

```typescript
// e2e/homepage.spec.ts
import { expect, test } from '@playwright/test';

test('Root URL (/) loads the homepage using the active default locale', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('header > div').first()).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', /.+/);
});

test('Current default-locale path resolves to the same homepage locale as root', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const defaultLocale = await page.locator('html').getAttribute('lang');

  await page.goto(`/${defaultLocale}`, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('header > div').first()).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', defaultLocale ?? '');
});
```

## Running Tests

To run all tests (Jest and Playwright), use the following npm script:

```bash
npm run test
```

### Jest Tests

To run Jest tests, use the following npm scripts:

```bash
# Run all Jest tests
npm run jest

# Run tests in watch mode (re-runs when files change)
npm run jest:watch

# Run tests with coverage report
npm run jest:coverage
```

### Playwright Tests

To run Playwright tests, use the following commands:

```bash
# Run the default environment-agnostic Playwright suite
npm run e2e

# Run tracked local-only Playwright tests (`*.local.spec.ts`). Set `NEXT_E2E_LOCAL_AUTH_BOOTSTRAP_TOKEN` in `.env` first for the auth bootstrap scenario.
npm run e2e:local

# Run the credential-free local auth/site sync spec explicitly.
# The script uses localhost:3100 so it can run while localhost:3000 is already in use.
npm run e2e:auth-sync

# Run tests with UI mode for debugging
npm run e2e:ui

# Run a specific test file
npx playwright test homepage.spec.ts
```

## Best Practices

### Jest Best Practices

1. **Test in isolation**: Mock external dependencies to ensure tests are focused and reliable
2. **Use React Testing Library**: Focus on testing behavior, not implementation details
3. **Leverage dependency injection**: Use InversifyJS to inject mocks for dependencies
4. **Test edge cases**: Include tests for loading states, error handling, and empty states
5. **Keep tests fast**: Avoid unnecessary setup and teardown operations

### Playwright Best Practices

1. **Focus on user journeys**: Test complete flows rather than individual components
2. **Use page objects**: Create abstractions for complex pages to make tests more maintainable
3. **Test across browsers**: Run tests in multiple browsers to catch compatibility issues
4. **Minimize test dependencies**: Make tests as independent as possible
5. **Use visual testing**: For critical UI components, consider adding visual regression tests

## Continuous Integration

Both Jest and Playwright tests are configured to run in the CI pipeline. The configuration ensures:

1. Tests run on every pull request
2. Failed tests block merging
3. Test coverage reports are generated
4. Screenshots and videos are captured for failed Playwright tests

## Conclusion

The testing strategy implemented in the Emporix Showcase project provides comprehensive coverage from unit testing through end-to-end testing. By using Jest for component and logic testing and Playwright for E2E testing, we ensure the application works correctly at all levels.

For more information about the dependency injection system used in tests, refer to the [Dependency Injection Documentation](./dependency-injection.md).

## Related Documentation

- [Documentation index](./README.md)
- [Testing Guide](./testing-guide.md)
- [Dependency Injection](./dependency-injection.md)
- [Deployment Process](./deployment-process.md)
