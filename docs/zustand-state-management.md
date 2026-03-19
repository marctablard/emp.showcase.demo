# Zustand State Management in Emporix Showcase

This document outlines how Zustand is implemented for state management in the Emporix Showcase project, focusing on product data management and the hydration pattern between server and client components.

## Overview

The Emporix Showcase project uses [Zustand](https://github.com/pmndrs/zustand), a lightweight state management library, to handle product data across the application. The implementation follows a pattern that:

1. Allows server components to fetch data
2. Hydrates this data into the client-side store
3. Provides hooks for client components to access and manipulate the data

## Store Implementation

As an example we illustrate how we handle state-management for products.

### Product Store

The product store is implemented in `src/stores/products-store.ts` and provides the following functionality:

```typescript
export type ProductState = {
  currentProductId: string | null;
  products: {
    [id: string]: Product;
  };
};

export type ProductActions = {
  getProduct: (id: string) => Product | null;
  getCurrentProduct: () => Product | null;
  setCurrentProduct: (product: Product) => void;
  addProduct: (product: Product) => void;
};
```

The store maintains:

- A cache of products indexed by their IDs
- A reference to the currently selected product
- Actions to get, add, and set products

### Store Provider

The `StoreProvider` in `src/providers/StoreProvider.tsx` creates and provides the Zustand stores to the application:

```typescript
export const StoreProvider = ({ children, shopSession, site, availableSites }: StoreProviderProps) => {
  const [productStore] = useState<ProductStoreApi>(() => createProductStore());
  const [cartStore] = useState<CartStoreApi>(() => createCartStore());
  const [siteStore] = useState<SiteStoreApi>(() =>
    createSiteStore({ site, availableSites, loading: false, error: null }),
  );
  const [sessionStore] = useState<SessionStoreApi>(() => createSessionStore({ session: shopSession, loading: false }));

  useEffect(() => {
    const unsubscribers = setupStoreSynchronization({ sessionStore, cartStore, siteStore });
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [sessionStore, cartStore, siteStore]);

  return (
    <SiteStoreContext.Provider value={siteStore}>
      <ProductStoreContext.Provider value={productStore}>
        <CartStoreContext.Provider value={cartStore}>
          <SessionStoreContext.Provider value={sessionStore}>
            {children}
          </SessionStoreContext.Provider>
        </CartStoreContext.Provider>
      </ProductStoreContext.Provider>
    </SiteStoreContext.Provider>
  );
};
```

This implementation:

- Uses `useState` to create store instances once per provider
- Provides stores through React Context
- Sets up cross-store synchronization (session ↔ cart) via `setupStoreSynchronization`
- Exposes store hooks (e.g., `useProductStore`) for components to access state

## API Layer

The product data API is split by execution context:

- `src/lib/client/products.ts` for client-side data fetching (via `/api/products/...`)
- `src/lib/ssr/products.ts` for server components (SSR container)

```typescript
import { getLogger } from '@/lib/logger/use-logger-client';

export const fetchProductById = cache(async (id: string, options?: ProductFetchOptions): Promise<Product | null> => {
  try {
    const response = await fetch(`/api/products/${id}`, {
      cache: 'no-store',
      next: { tags: [`product-${id}`] },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch product: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    getLogger().error({ err: error, productId: id }, 'Error fetching product');
    throw error;
  }
});
```

Key features:

- Uses React's `cache()` function to deduplicate requests within the same render cycle on serverside
- Works in both client and server environments
- Includes proper error handling
- Supports Next.js cache tags for revalidation

## Hydration Pattern

### ProductDetail and useProduct Pattern

Server components fetch product data when SSR is enabled and pass it into the client component. The client component (`ProductDetail`) accepts either a full product or an ID; the `useProduct` hook then hydrates the store and manages fetches when needed.

```typescript
// Server component
const product = await getProductById(id, options);
return <ProductDetail product={product} options={options} />;
```

`useProduct` behavior:

- If a product object is provided, it is added to the store immediately
- If only an ID is provided, it fetches via `fetchProductById` and hydrates the store
- The hook keeps `loading` and `error` state in sync for client components

## Custom Hooks

### useProduct Hook

The `src/hooks/product/useProduct.ts` hook encapsulates the Zustand store usage and provides a more convenient API for client components:

```typescript
export const useProduct = (id?: string): UseProductResult => {
  const { getProduct, setCurrentProduct, addProduct } = useProductStore();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [product, setProduct] = useState<Product | null>(id ? getProduct(id) : null);

  // Implementation details...

  return {
    product,
    loading,
    error,
    refetch: fetchProduct,
    setAsCurrent,
  };
};
```

This hook:

- Checks the store first for cached data
- Falls back to API fetching if the product isn't in the store
- Handles loading and error states
- Provides a refetch method for manual refreshing
- Includes a method to set the product as the current product

## Usage Examples

### Server Component (Product Page)

In `src/app/[site]/[locale]/(default)/product/[id]/page.tsx`, the server component:

```typescript
export default async function ProductPage({ params }: { params: Promise<{ id: string; locale: string; site: string }> }) {
  const { id, locale, site } = await params;
  const { ssr, options } = createProductOptions(PUBLIC_PRODUCT_OPTIONS, false, site);

  // Fetch product data server-side when SSR is enabled
  const product = ssr ? await getProductById(id, options) : null;

  if (ssr && !product) {
    notFound();
  }

  return <ProductDetail product={product ?? id} options={options} />;
}
```

This component:

1. Optionally fetches the product server-side when SSR is enabled
2. Passes either the full product or the product ID to the client component
3. Lets `useProduct` handle client-side hydration and refetching as needed

### Client Component (ProductDetail)

In `src/components/product/product-detail.tsx`, the client component:

```typescript
export default function ProductDetail({ product: initialProduct, options }: ProductDetailProps) {
  const { product, loading, setAsCurrent } = useProduct(initialProduct, options);

  if (loading) {
    return {
      /* Loading Template... */
    };
  }

  // If no product, show not found
  if (!product) {
    return {
      /* Product Not Found Template... */
    };
  }

  return {
    /* Regular Product Template... */
  };
}
```

This component:

1. Uses the `useProduct` hook to access the product data
2. Handles loading and error states
3. Renders UI based on the product data

## Benefits of This Approach

1. **Server-Side Rendering**: Data is fetched on the server for better performance and SEO
2. **Efficient Hydration**: Only the necessary data is passed to the client
3. **Shared State**: The Zustand store provides a single source of truth
4. **Type Safety**: TypeScript ensures type safety across the application
5. **Separation of Concerns**: Clear separation between data fetching, state management, and UI rendering
6. **Reusability**: The hooks and components can be reused across the application
7. **Performance**: Caching and deduplication prevent redundant fetches

## Conclusion

The Zustand implementation in the Emporix Showcase project demonstrates a clean and efficient approach to state management in a Next.js application. By combining server-side data fetching with client-side state management, the application achieves optimal performance while maintaining a great developer experience.

## TODO

- Store Limitation (Threshold to reduce memory-usage)
- Improved handling for multiple Stores
- Store-Invalidation after TTL
