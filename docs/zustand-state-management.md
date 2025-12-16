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

The `StoreProvider` in `src/providers/StoreProvider.tsx` creates and provides the Zustand store to the application:

```typescript
export const StoreProvider = ({
  children
}: StoreProviderProps) => {
  const productStoreRef = useRef<ProductStoreApi | null>(null)
  if (productStoreRef.current === null) {
    const initState = initProductStore();
    productStoreRef.current = createProductStore(initState);
  }

  return (
    <ProductStoreContext.Provider value={productStoreRef.current}>
      {children}
    </ProductStoreContext.Provider>
  )
}
```

This implementation:

- Uses `useRef` to ensure the store is only created once
- Provides the store through React Context
- Exposes a `useProductStore` hook for components to access the store

## API Layer

The `src/lib/api/products.ts` file provides a shared API layer that can be used by both server and client components:

```typescript
export const fetchProductById = cache(async (id: string): Promise<Product> => {
  try {
    const response = await fetch(`${baseUrl}/api/products/${id}`, {
      cache: 'no-store',
      next: { tags: [`product-${id}`] },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch product: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching product ${id}:`, error);
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

### ProductHydrator Component

The `src/providers/hydrator/ProductHydrator.tsx` component is responsible for hydrating server-fetched data into the client-side Zustand store:

```typescript
export default function ProductHydrator({ product, isCurrent }: ProductHydratorProps) {
  useProductHydrator({ product, isCurrent });

  return null;
}
```

The `useProductHydrator` hook:

- Takes a product object and an optional `isCurrent` flag
- Adds the product to the store
- Optionally sets it as the current product
- Runs only on the client side (marked with 'use client')

This pattern allows server components to pass data to client components without prop drilling or redundant fetching.

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

In `src/app/[locale]/product/[id]/page.tsx`, the server component:

```typescript
export default async function ProductPage({ params }: { params: Promise<{ id: string, locale: string }> }) {
  const productId = (await params).id;

  // Fetch product data server-side using our shared API layer
  const product = await fetchProductById(productId);

  // If product not found, show 404 page
  if (!product) {
    notFound();
  }

  return (
    <div className="container mx-auto py-10 px-4 sm:px-6">
      {/* Hydrator component to populate the store with prefetched data */}
      <ProductHydrator product={product} isCurrent />

      {/* Rest of the component... */}

      <CardFooter>
        {/* Client component that consumes the product signal */}
        <ProductActions id={productId} />
      </CardFooter>
    </div>
  );
}
```

This component:

1. Fetches the product data on the server
2. Uses `ProductHydrator` to hydrate the data into the client-side store
3. Passes only the product ID to the client component (`ProductActions`)

### Client Component (ProductActions)

In `src/components/product/ProductActions.tsx`, the client component:

```typescript
export default function ProductActions({ id }: { id: string }) {
  const t = useTranslations('product');
  const { product, loading, error, setAsCurrent } = useProduct(id);
  const [quantity, setQuantity] = useState(1);

  // If product is not available yet, show loading
  if (loading) {
    return {
      /* Product Loading Template... */
    };
  }

  // If there's an error, show error message
  if (error) {
    return {
      /* Product Error Template... */
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
