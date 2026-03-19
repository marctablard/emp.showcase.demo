# Internationalization (i18n) with next-intl

## Overview

Our application uses [next-intl](https://next-intl-docs.vercel.app/) to provide a robust internationalization solution that works seamlessly with Next.js 14+ and React Server Components. This documentation explains our implementation approach, configuration, and usage patterns.

## Why next-intl?

We chose next-intl for several key reasons:

1. **Server Component Support**: Full compatibility with React Server Components
2. **Type Safety**: Strong TypeScript integration for translation keys
3. **Performance**: Optimized for both server and client rendering
4. **Routing Integration**: Built-in locale-aware routing
5. **Flexibility**: Support for both static and dynamic content translation

## Configuration

Our i18n setup consists of three main configuration files:

### 1. Routing Configuration (`src/i18n/routing.ts`)

```typescript
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ['en', 'de'],
  // Used when no locale matches
  defaultLocale: 'en',
  // Used for routing
  localePrefix: 'as-needed',
});
```

This defines our supported locales and routing behavior. The `localePrefix: 'as-needed'` setting means that the default locale won't show in the URL, but other locales will.

### 2. Navigation Helpers (`src/i18n/navigation.ts`)

```typescript
import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

// Lightweight wrappers around Next.js' navigation
// APIs that consider the routing configuration
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
```

This provides locale-aware navigation utilities that respect our routing configuration.

### 3. Request Configuration (`src/i18n/request.ts`)

```typescript
import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
import { loadI18nTranslations } from 'next-intl-split/load';

export default getRequestConfig(async ({ requestLocale }) => {
  // Typically corresponds to the `[locale]` segment within `[site]/[locale]`
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: loadI18nTranslations('src/i18n/translations', locale, true),
  };
});
```

This handles loading the correct translation messages based on the requested locale.

## Translation Files

Our translations are organized in a structured directory hierarchy by locale and namespace:

```
src/i18n/translations/
├── en/
│   ├── account/
│   │   └── index.json
│   ├── auth/
│   │   └── index.json
│   ├── cart/
│   │   └── index.json
│   ├── checkout/
│   │   └── index.json
│   ├── common/
│   │   └── index.json
│   ├── layout/
│   │   └── index.json
│   ├── orders/
│   │   └── index.json
│   ├── product/
│   │   └── index.json
│   ├── search/
│   │   └── index.json
│   ├── seo/
│   │   └── index.json
│   └── validation/
│       └── index.json
└── de/
    └── (similar structure)
```

Example translation file structure (e.g., `src/i18n/translations/en/account/index.json`):

```json
{
  "title": "Service Portal",
  "welcomeBack": "Welcome, {name}",
  "dashboard": "Dashboard",
  "profile": {
    "title": "User Profile",
    "description": "View and edit your personal details"
  }
}
```

## Implementation in App Router

### Directory Structure

We use Next.js App Router with `[site]/[locale]` dynamic segments to handle multi-tenant routing and languages:

```
src/
  app/
    [site]/[locale]/
      layout.tsx             # Root layout with site + locale handling
      (default)/page.tsx     # Home page
      (default)/hello/       # Example feature directory
        page.tsx             # Feature-specific page
```

### Root Layout (`src/app/[site]/[locale]/layout.tsx`)

The root layout handles locale validation and setup:

```tsx
import { ReactNode } from 'react';
import { Locale, NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import '../globals.css';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: Locale; site: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale, site: defaultSiteCode }));
}

export async function generateMetadata(props: Omit<Props, 'children'>) {
  const { locale } = await props.params;

  const t = await getTranslations({ locale, namespace: 'hello' });

  return {
    title: t('world'),
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  // Ensure that the incoming `locale` is valid
  const { locale, site } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enable static rendering
  setRequestSite(site);
  setRequestLocale(locale);

  return (
    <html className="h-full" lang={locale}>
      <body className="flex h-full flex-col">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
```

Key features:

- `generateStaticParams()` pre-renders pages for all supported locales
- `generateMetadata()` creates dynamic, localized page metadata
- `setRequestLocale()` enables static rendering with the correct locale
- `NextIntlClientProvider` makes translations available to client components

### Page Component (`src/app/[site]/[locale]/(default)/page.tsx`)

```tsx
import { useTranslations } from 'next-intl';

export default function Home() {
  const t = useTranslations('common');
  return (
    <div className="container mx-auto py-8">
      <h1>{t('storeName')}</h1>
    </div>
  );
}
```

This demonstrates using the `useTranslations` hook to access translations in a server component.

## Usage Patterns

### 1. Server Components

For server components, use the `useTranslations` hook:

```tsx
import { useTranslations } from 'next-intl';

export default function ServerComponent() {
  const t = useTranslations('namespace');
  return <h1>{t('key')}</h1>;
}
```

### 2. Client Components

For client components, use the same `useTranslations` hook:

```tsx
'use client';

import { useTranslations } from 'next-intl';

export default function ClientComponent() {
  const t = useTranslations('namespace');
  return <button>{t('button.label')}</button>;
}
```

The `NextIntlClientProvider` in the root layout makes this possible.

### 3. Dynamic Metadata

Use `getTranslations` to create localized metadata:

```tsx
export async function generateMetadata(props: Props) {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'meta' });

  return {
    title: t('title'),
    description: t('description'),
  };
}
```

### 4. Locale-Aware Navigation

Use the provided navigation utilities for locale-aware links:

```tsx
import { Link } from '@/i18n/navigation';

export default function Navigation() {
  return (
    <nav>
      <Link href="/">Home</Link>
      <Link href="/about">About</Link>
    </nav>
  );
}
```

### 5. Integration with Services

When working with our service layer, translations should be handled at the UI level, not in the services themselves. This keeps the service layer focused on business logic rather than presentation concerns:

```tsx
// ProductSummary.tsx
import ssr from '@/platform/ssr';
import { ProductService } from '@/platform/services/product/ProductService';

export async function ProductSummary({ productId }: { productId: string }) {
  const productService = ssr.get<ProductService>('ProductService');
  const product = await productService.getProductById(productId);
  return (
    <div>
      <p>{product?.name}</p>
    </div>
  );
}
```

The service layer returns raw data that can be translated or formatted at the UI layer if needed.

## Best Practices

1. **Namespace Organization**: Organize translations by feature or domain (e.g., `hello`, `product`, `checkout`)

2. **Keep Keys Simple**: Use descriptive but concise keys that reflect the content's purpose

3. **Avoid String Concatenation**: Use message formatting instead of concatenating strings

4. **Separate UI and Business Logic**: Handle translations at the UI layer, not in services or APIs

5. **Prerender for Performance**: Use `generateStaticParams` to prerender pages for all supported locales

6. **Type Safety**: Leverage TypeScript to ensure translation keys are valid

## Conclusion

Our next-intl implementation provides a robust, type-safe, and performant solution for internationalization. By following the patterns and practices outlined in this documentation, we can create a consistent multilingual experience across our application.
