# Comprehensive Testing Guide for Emporix Showcase

## Table of Contents

1. [Overview](#overview)
2. [Testing Frameworks](#testing-frameworks)
   - [Jest](#jest)
   - [Playwright](#playwright)
3. [Test Structure](#test-structure)
   - [Unit and Integration Tests](#unit-and-integration-tests-jest)
   - [End-to-End Tests](#end-to-end-tests-playwright)
4. [Dependency Injection in Tests](#dependency-injection-in-tests)
5. [Platform Testing with InversifyJS](#platform-testing-with-inversifyjs)
6. [React Testing Best Practices](#react-testing-best-practices)
   - [Context Sharing Between Test Renders](#context-sharing-between-test-renders)
   - [Proper Use of `act()`](#proper-use-of-act)
   - [Handling Asynchronous Operations](#handling-asynchronous-operations)
   - [Testing State Management](#testing-state-management)
   - [Mocking Dependencies](#mocking-dependencies)
7. [Sample Tests](#sample-tests)
   - [Jest Example: Testing a Hook](#jest-example-testing-a-hook)
   - [Playwright Example: Testing Locale Redirects](#playwright-example-testing-locale-redirects)
8. [Running Tests](#running-tests)
9. [Best Practices](#best-practices)
10. [Continuous Integration](#continuous-integration)
11. [Troubleshooting Common Issues](#troubleshooting-common-issues)
12. [Conclusion](#conclusion)

## Overview

The Emporix Showcase project implements a comprehensive testing strategy using both Jest and Playwright. This document outlines how these testing frameworks are integrated, what types of tests are supported, how to run them, and best practices to follow.

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

E2E tests are located in the `/e2e` directory at the root of the project. Each test file focuses on a specific feature or user flow:

- `e2e/homepage.spec.ts` - Tests for homepage functionality and locale redirects

## Dependency Injection in Tests

The Emporix Showcase project uses InversifyJS for dependency injection, which makes testing services and APIs much easier. For detailed information about the dependency injection system, see [Dependency Injection Documentation](./dependency-injection.md).

### Mocking Dependencies with InversifyJS

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

## Platform Testing with InversifyJS

The Emporix Showcase platform layer consists of various services and APIs that interact with external systems. Testing these components effectively requires proper dependency isolation and mocking. InversifyJS provides powerful capabilities for creating test-specific implementations.

### Setting Up a Test Container

For platform testing, it's recommended to create a dedicated test container with mock implementations:

```typescript
// test-utils/test-container.ts
import { Container } from 'inversify';
import { CartApi } from '@/platform/api/CartApi';
import { ProductApi } from '@/platform/api/ProductApi';
import { TYPES } from '@/platform/types';

// Mock implementations
class MockProductApi implements ProductApi {
  getProduct = jest.fn().mockResolvedValue({ id: 'test-product', name: 'Test Product' });
  searchProducts = jest.fn().mockResolvedValue({ items: [] });
}

class MockCartApi implements CartApi {
  getCart = jest.fn().mockResolvedValue({ id: 'test-cart', items: [] });
  addToCart = jest.fn().mockResolvedValue({ success: true });
}

export function createTestContainer() {
  const container = new Container();

  // Bind mock implementations
  container.bind<ProductApi>(TYPES.ProductApi).to(MockProductApi).inSingletonScope();
  container.bind<CartApi>(TYPES.CartApi).to(MockCartApi).inSingletonScope();

  return container;
}
```

### Testing Services with Mocked Dependencies

With the test container in place, you can easily test services that depend on platform APIs:

```typescript
// services/ProductService.test.ts
import { ProductApi } from '@/platform/api/ProductApi';
import { TYPES } from '@/platform/types';
import { createTestContainer } from '../test-utils/test-container';
import { ProductService } from './ProductService';

describe('ProductService', () => {
  let container;
  let productService;
  let mockProductApi;

  beforeEach(() => {
    // Create a fresh container for each test
    container = createTestContainer();

    // Get the service and its dependencies
    productService = container.get<ProductService>(TYPES.ProductService);
    mockProductApi = container.get<ProductApi>(TYPES.ProductApi);
  });

  test('getProductDetails should return enhanced product data', async () => {
    // Setup mock response
    mockProductApi.getProduct.mockResolvedValueOnce({
      id: 'test-123',
      name: 'Test Product',
      price: { value: 99.99, currencyCode: 'USD' },
    });

    // Call the service method
    const result = await productService.getProductDetails('test-123');

    // Verify the result
    expect(result).toEqual(
      expect.objectContaining({
        id: 'test-123',
        name: 'Test Product',
        formattedPrice: '$99.99',
      }),
    );

    // Verify the dependency was called correctly
    expect(mockProductApi.getProduct).toHaveBeenCalledWith('test-123');
  });
});
```

### Testing API Implementations

You can also test API implementations by mocking their HTTP client dependencies:

```typescript
// platform/integrations/emporix/product/impl/EmporixProductApi.test.ts
import { Container } from 'inversify';
import { HttpClient } from '@/platform/http/HttpClient';
import { TYPES } from '@/platform/types';
import { EmporixProductApi } from './EmporixProductApi';

describe('EmporixProductApi', () => {
  let container;
  let productApi;
  let mockHttpClient;

  beforeEach(() => {
    // Create a container
    container = new Container();

    // Create mock HTTP client
    mockHttpClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    };

    // Bind dependencies
    container.bind<HttpClient>(TYPES.HttpClient).toConstantValue(mockHttpClient);
    container.bind<EmporixProductApi>(TYPES.ProductApi).to(EmporixProductApi);

    // Get the API implementation
    productApi = container.get<EmporixProductApi>(TYPES.ProductApi);
  });

  test('getProduct should call correct endpoint and transform response', async () => {
    // Setup mock response
    const mockResponse = {
      id: 'prod123',
      name: 'Test Product',
      attributes: [
        { name: 'color', value: 'red' },
        { name: 'size', value: 'medium' },
      ],
    };
    mockHttpClient.get.mockResolvedValueOnce({ data: mockResponse });

    // Call the API method
    const result = await productApi.getProduct('prod123');

    // Verify the HTTP client was called correctly
    expect(mockHttpClient.get).toHaveBeenCalledWith(expect.stringContaining('/products/prod123'), expect.any(Object));

    // Verify the response was transformed correctly
    expect(result).toEqual({
      id: 'prod123',
      name: 'Test Product',
      attributes: {
        color: 'red',
        size: 'medium',
      },
    });
  });
});
```

### Best Practices for Platform Testing

1. **Create reusable test containers**: Maintain a set of test containers with common mock implementations
2. **Test at the interface level**: Test against the interface, not the implementation
3. **Mock external dependencies**: Always mock HTTP clients, database connections, etc.
4. **Verify interaction patterns**: Check that dependencies are called with the correct parameters
5. **Test error handling**: Verify that API errors are properly handled and transformed
6. **Use factory functions**: Create helper functions that set up test containers with specific configurations

## React Testing Best Practices

### Context Sharing Between Test Renders

#### Problem

When testing components or hooks that rely on context providers (like Redux, Zustand, or custom React contexts), each call to `renderHook()` or `render()` creates a new instance of the provider, resulting in isolated contexts that don't share state.

```tsx
// ❌ BAD: Each render gets a different store instance
const { result: hookResult } = renderHook(() => useMyHook(), { wrapper });
const { result: storeResult } = renderHook(() => useStore(), { wrapper });
```

#### Solution

Create a shared store/context instance and use it in a custom wrapper for all renders:

```tsx
// ✅ GOOD: Create a shared store
const sharedStore = createStore();
const customWrapper = ({ children }) => <StoreContext.Provider value={sharedStore}>{children}</StoreContext.Provider>;

// Both renders use the same store instance
const { result: hookResult } = renderHook(() => useMyHook(), { wrapper: customWrapper });
const { result: storeResult } = renderHook(() => useStore(), { wrapper: customWrapper });
```

#### Best Practices

1. Create store/context instances outside of test renders
2. Use a custom wrapper that references the shared instance
3. Reuse the same wrapper for all renders in a test
4. Reset the store state between tests in `beforeEach` if needed

### Proper Use of `act()`

#### Problem

React's `act()` function ensures that all updates related to state changes are processed and applied before making assertions. Common issues include:

1. Wrapping `renderHook()` in `act()` unnecessarily
2. Not wrapping state-changing operations in `act()`
3. Making assertions inside `act()` that depend on state updates

```tsx
// ❌ BAD: Wrapping renderHook in act
await act(async () => {
  const { result } = renderHook(() => useMyHook());
});

// ❌ BAD: Making assertions inside act that depend on state updates
await act(async () => {
  result.current.updateState();
  expect(result.current.state).toBe('updated'); // Might fail
});
```

#### Solution

Use `act()` only for operations that cause state changes, and make assertions after the `act()` call completes:

```tsx
// ✅ GOOD: Render hook without act
const { result } = renderHook(() => useMyHook());

// ✅ GOOD: Wrap state changes in act
await act(async () => {
  result.current.updateState();
});

// ✅ GOOD: Assert after act completes
expect(result.current.state).toBe('updated');
```

#### Best Practices

1. Don't wrap `renderHook()` or `render()` in `act()`
2. Always wrap state-changing operations in `act()`
3. Make assertions after `act()` completes
4. Use `waitFor()` for async operations that update state

### Handling Asynchronous Operations

#### Problem

Asynchronous operations (like API calls) can lead to test flakiness or false negatives if not properly handled:

```tsx
// ❌ BAD: Not waiting for async operations
const { result } = renderHook(() => useDataFetching());
expect(result.current.data).not.toBeNull(); // Might fail if data isn't loaded yet
```

#### Solution

Use `waitFor()` to wait for expected conditions before making assertions:

```tsx
// ✅ GOOD: Wait for loading to complete
const { result } = renderHook(() => useDataFetching());
await waitFor(() => {
  expect(result.current.loading).toBe(false);
});
expect(result.current.data).not.toBeNull();
```

#### Best Practices

1. Use `waitFor()` to wait for async operations to complete
2. Check for loading states before making assertions about data
3. Set reasonable timeouts for async operations
4. Mock API calls to make tests deterministic

### Testing State Management

#### Problem

When testing hooks or components that use state management libraries (Redux, Zustand, etc.), it's easy to encounter issues with:

1. Store initialization
2. Action dispatching
3. Selector memoization
4. Store updates not being reflected in tests

#### Solution

Create a testable store factory and use it consistently:

```tsx
// ✅ GOOD: Create a test store with initial state
const createTestStore = (initialState = {}) => {
  return createProductStore({
    ...defaultState,
    ...initialState,
  });
};

test('should update state', async () => {
  // Create store with test data
  const store = createTestStore({ user: { name: 'Test' } });
  const wrapper = ({ children }) => (
    <ProductStoreContext.Provider value={store}>{children}</ProductStoreContext.Provider>
  );

  const { result } = renderHook(() => useUser(), { wrapper });
  expect(result.current.name).toBe('Test');

  // Update store
  await act(async () => {
    store.getState().updateUser({ name: 'Updated' });
  });

  expect(result.current.name).toBe('Updated');
});
```

#### Best Practices

1. Create test stores with predictable initial states
2. Access store state directly for setup and verification when needed
3. Reset store state between tests
4. Test selectors and actions separately from components when possible

### Mocking Dependencies

#### Problem

External dependencies can make tests unpredictable or slow:

```tsx
// ❌ BAD: Using real API in tests
const { result } = renderHook(() => useProductApi());
await act(async () => {
  await result.current.fetchProduct('123');
});
```

#### Solution

Mock dependencies at the module level:

```tsx
// ✅ GOOD: Mock API module
jest.mock('@/lib/client/products', () => ({
  fetchProductById: jest.fn().mockResolvedValue({ id: '123', name: 'Test Product' }),
}));

test('should fetch product', async () => {
  const { result } = renderHook(() => useProductApi());

  await act(async () => {
    await result.current.fetchProduct('123');
  });

  expect(result.current.product).toEqual({ id: '123', name: 'Test Product' });
});
```

#### Best Practices

1. Mock external dependencies at the module level
2. Use `jest.mock()` at the top of test files
3. Reset mocks between tests with `jest.clearAllMocks()`
4. Provide predictable mock implementations

## Sample Tests

### Jest Example: Testing a Hook

The project includes a sample test for the `useProduct` hook that demonstrates:

- Testing loading states
- Testing error handling
- Verifying store integration
- Mocking API responses

```typescript
// src/hooks/product/useProduct.test.tsx
import { renderHook, act, waitFor } from '@testing-library/react';
import { useProduct } from './useProduct';
import { fetchProductById } from '@/lib/client/products';
import { ProductStoreContext } from '@/providers/StoreProvider';
import { createProductStore } from '@/stores/products-store';
import { ReactNode } from 'react';

// Mock the API module
jest.mock('@/lib/client/products', () => ({
  fetchProductById: jest.fn(),
}));

const mockProduct = { id: '123', name: 'Test Product' };

describe('useProduct hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should fetch and store product', async () => {
    // Setup shared store
    const sharedStore = createProductStore();
    const wrapper = ({ children }) => (
      <ProductStoreContext.Provider value={sharedStore}>
        {children}
      </ProductStoreContext.Provider>
    );

    // Setup mock
    (fetchProductById).mockResolvedValue(mockProduct);

    // Render hook
    const { result } = renderHook(() => useProduct('123'), { wrapper });

    // Initial state
    expect(result.current.loading).toBe(true);

    // Wait for loading to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Verify final state
    expect(result.current.product).toEqual(mockProduct);

    // Verify store was updated
    expect(sharedStore.getState().products['123']).toEqual(mockProduct);
  });
});
```

### Playwright Example: Testing Locale Redirects

The project includes a sample E2E test that verifies locale handling:

```typescript
// e2e/homepage.spec.ts
import { expect, test } from '@playwright/test';

test('German homepage (/de) loads correctly', async ({ page }) => {
  // Navigate to the German homepage
  await page.goto('/de');

  await page.waitForLoadState('networkidle');
  await expect(page.locator('header > div').first()).toBeVisible();

  // Check that we're on the German version by looking for German Locale
  const htmlLang = await page.getAttribute('html', 'lang');
  expect(htmlLang).toBe('de');
});

test('Default locale (/en) redirects to root (/)', async ({ page }) => {
  // Navigate to the English homepage
  await page.goto('/en');

  // Wait for any redirects to complete
  await page.waitForURL('/');

  // Verify we've been redirected to the root URL
  expect(page.url()).toContain('/');
});
```

## Running Tests

### Jest Tests

To run Jest tests, use the following npm scripts:

```bash
# Run all Jest tests
npm run test

# Run tests in watch mode (re-runs when files change)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run a specific test file
npm run test -- path/to/test.ts

# Run tests matching a specific name
npm run test -- -t="test name pattern"
```

### Playwright Tests

To run Playwright tests, use the following commands:

```bash
# Run all Playwright tests
npx playwright test

# Run tests in a specific browser
npx playwright test --project=chromium

# Run tests with UI mode for debugging
npx playwright test --ui

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
6. **Share context properly**: Ensure store instances are shared between renders when needed
7. **Use act() correctly**: Only wrap state-changing operations, not renders
8. **Wait for async operations**: Use waitFor() to ensure state is settled before assertions

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

## Troubleshooting Common Issues

### "Warning: An update to Component inside a test was not wrapped in act(...)"

This warning occurs when React state updates happen outside of an `act()` wrapper. To fix:

1. Wrap state-changing operations in `act()`
2. Use `waitFor()` for async operations
3. Don't make assertions inside `act()` that depend on state updates

```tsx
// ✅ GOOD: Proper handling of async state updates
const { result } = renderHook(() => useMyHook());

// Trigger state change
await act(async () => {
  result.current.updateState();
});

// Wait for any async effects to complete
await waitFor(() => {
  expect(result.current.loading).toBe(false);
});

// Make assertions
expect(result.current.data).toBe('expected value');
```

### "Store is undefined" or "Cannot read properties of null (reading 'getState')"

This typically happens when context is not properly shared between renders. To fix:

1. Create a shared store instance outside of renders
2. Use a custom wrapper with the shared store
3. Use the same wrapper for all renders in the test

```tsx
// ✅ GOOD: Shared store between renders
const sharedStore = createStore();
const wrapper = ({ children }) => <StoreContext.Provider value={sharedStore}>{children}</StoreContext.Provider>;

const { result: hook1 } = renderHook(() => useHook1(), { wrapper });
const { result: hook2 } = renderHook(() => useHook2(), { wrapper });
```

### "Test timed out" in Playwright Tests

This usually happens when a condition the test is waiting for never occurs. To fix:

1. Check that selectors are correct
2. Ensure the application is in the expected state
3. Add explicit waits for dynamic content
4. Increase the timeout for complex operations

```typescript
// ✅ GOOD: Explicit waiting with appropriate timeout
await page.waitForSelector('.dynamic-content', { timeout: 10000 });
```

## Conclusion

The testing strategy implemented in the Emporix Showcase project provides comprehensive coverage from unit testing through end-to-end testing. By using Jest for component and logic testing and Playwright for E2E testing, we ensure the application works correctly at all levels.

By following the best practices outlined in this guide, particularly around context sharing, proper use of `act()`, and handling asynchronous operations, you can create reliable, maintainable tests that accurately verify your application's behavior.

For more information about the dependency injection system used in tests, refer to the [Dependency Injection Documentation](./dependency-injection.md).
