# Local CMS Documentation

This document explains how to use the Local CMS system and how to switch between Storyblok and Local CMS for content management.

## Table of Contents
1. [Overview](#overview)
2. [Content Structure](#content-structure)
3. [Using Local CMS](#using-local-cms)
4. [Switching Between CMS Providers](#switching-between-cms-providers)
5. [API Reference](#api-reference)

## Overview

The Local CMS system allows you to manage content using local JSON files instead of an external CMS like Storyblok. This is useful for development, testing, or when you want to run the application without external dependencies.

The system implements the same interfaces as the Storyblok integration, making it easy to switch between the two without changing your application code.

## Content Structure

Local CMS content is stored in JSON files with the following folder structure:

```
data/cms/[site]/[language]/[slug].json
```

Where:
- `[site]`: The site identifier (e.g., "us-branch", "main")
- `[language]`: The language code (e.g., "en", "de")
- `[slug]`: The page identifier (e.g., "home", "about", "products")

### Default Site Fallback

If content is not found for a specific site, the system will fall back to the `_default_` site:

```
data/cms/_default_/[language]/[slug].json
```

### Content Format

Each JSON file represents a `CMSPage` with the following structure:

```json
{
  "title": "Page Title",
  "description": "Page description",
  "url": "/page-url",
  "components": [
    {
      "id": "unique-component-id",
      "type": "component-type",
      // Component-specific properties
    }
  ]
}
```

## Using Local CMS

### Adding New Content

1. Create a JSON file in the appropriate folder: `data/cms/[site]/[language]/[slug].json`
2. Follow the `CMSPage` structure as shown above
3. Add components with the appropriate structure based on their type

### Supported Component Types

Currently, the system supports the following component types:
- `hero`: For hero sections with headline, text, button, and image/video
- `quick-entry`: For navigation entry grids with icons and links

To add support for new component types:
1. Create a React component in `src/components/cms/`
2. Update the `CMSComponentRenderer` in `src/components/cms/cms-component-renderer.tsx` to include your new component

## Switching Between CMS Providers

The application is designed to easily switch between Storyblok and Local CMS.

### Replacing CMSPageComponent

The simplest way to switch between Storyblok and Local CMS is by replacing the CMSPageComponent import in the page components:

1. In `src/app/[site]/[locale]/(no-margin)/[...slug]/page.tsx`:

```typescript
// For Storyblok CMS (current configuration)
import CMSPageComponent from '@/components/cms/storyblok/storyblok-cms-page';

// For Local CMS
import CMSPageComponent from '@/components/cms/local/local-cms-page';
```

2. In `src/app/[site]/[locale]/(no-margin)/page.tsx`:

```typescript
// For Storyblok CMS (current configuration)
import CMSPageComponent from '@/components/cms/storyblok/storyblok-cms-page';

// For Local CMS
import CMSPageComponent from '@/components/cms/local/local-cms-page';
```

By changing the import in these two files, you can switch the entire application between using Storyblok and the Local CMS system. A restart of the server (npm run dev) is required for the changes in the local CMS file system to get reflected.


For more details, refer to the implementation files:
- `src/platform/services/cms/impl/LocalCmsService.ts`
- `src/components/cms/local/cms-page.tsx`
- `src/app/api/cms/route.ts` # for client side fetching, currently not used
- `src/lib/client/cms.ts` # for client side fetching, currently not used
