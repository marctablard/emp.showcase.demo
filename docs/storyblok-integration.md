# Storyblok Integration

This document provides a comprehensive guide to the Storyblok integration implemented in the Emporix Showcase application. It covers the setup, available components, and how to use them effectively.

## Table of Contents

1. [Introduction](#introduction)
2. [Setup](#setup)
3. [Components](#components)
   - [Page](#page)
   - [Logo](#logo)
   - [Navigation](#navigation)
   - [ContentBlock](#contentblock)
   - [Category](#category)
   - [Segment](#segment)
   - [Article](#article)
   - [Feature](#feature)
   - [Grid](#grid)
   - [Columns](#columns)
   - [Teaser](#teaser)
4. [Usage in Next.js](#usage-in-nextjs)
5. [Visual Editor Integration](#visual-editor-integration)
6. [Best Practices](#best-practices)

## Introduction

Storyblok is a headless CMS that allows content creators to manage content through a visual editor. This integration connects Storyblok with the Emporix Showcase application, enabling content managers to create and modify content without developer intervention.

The integration uses the official Storyblok SDK for Next.js with App Router and React Server Components (RSC).

## Setup

The Storyblok integration is set up with the following key files:

- `src/lib/storyblok.ts` - Initializes the Storyblok client and registers components
- `src/providers/StoryblokProvider.tsx` - Provider component for client-side initialization
- `src/app/[site]/[locale]/(no-margin)/page.tsx` - Storyblok CMS root page
- `src/app/[site]/[locale]/(no-margin)/[...slug]/page.tsx` - Storyblok CMS dynamic pages

To use Storyblok in your application, you need to:

1. Set the Storyblok access token in your `.env` file:

   ```
   NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN=your_access_token
   ```

2. Create content types in Storyblok that match the components defined in the application

3. Create content in Storyblok and publish it

## Components

The following components are available for use in Storyblok:

### Page

A container component that renders child components in a page layout.

**Fields:**

- `title` (Text) - The page title (for navigation)
- `slug` (Text) - URL slug
- `url` (Text) - Full URL
- `body` (Blocks) - The content blocks to display on the page
- `site` (Text) - Site identifier

**Usage:**
Use this component as the main container for your pages. Add other components to the `body` field.

### Logo

Displays a logo image with alt text.

**Fields:**

- `site` (Text) - The site identifier
- `image` (Asset) - The logo image
- `alt_text` (Text) - Alternative text for the image

**Usage:**
Use this component to display your site's logo in headers or footers.

### Navigation

Displays a navigation menu with links.

**Fields:**

- `items` (Blocks) - Navigation items with title, slug, and link
- `site` (Text) - The site identifier

**Usage:**
Use this component to create navigation menus for your site.

### ContentBlock

A multi-purpose content item that can be placed on various pages.

**Fields:**

- `title` (Text) - The content block title
- `description` (Text) - The content description
- `images` (Assets) - Images to display in the content block
- `background_image` (Asset) - Background image for the content block
- `button` (Object) - Button with name and link
- `style` (Option) - Style options: full-width, vignette, teaser

**Usage:**
Use this versatile component to create various content sections on your pages.

### Category

Displays a product category with title, description, and banner.

**Fields:**

- `title` (Text) - The category title
- `description` (Text) - The category description
- `emporix_category_id` (Text) - The Emporix category ID
- `banner` (Asset) - The category banner image
- `highlight` (Boolean) - Whether to highlight the category
- `site` (Text) - The site identifier

**Usage:**
Use this component to showcase product categories on your site.

### Segment

Displays content specific to a customer segment.

**Fields:**

- `segment_name` (Text) - The segment name
- `emporix_segment_id` (Text) - The Emporix segment ID
- `content_blocks` (Blocks) - Content blocks to display for this segment
- `site` (Text) - The site identifier

**Usage:**
Use this component to display segment-specific content.

### Article

Displays an article with title, introduction, video, rich text, and linked products.

**Fields:**

- `title` (Text) - The article title
- `introduction` (Text) - The article introduction
- `video` (Object) - Video URL and title
- `content` (Rich Text) - The article content
- `linked_products` (Blocks) - Products related to the article

**Usage:**
Use this component to create blog posts or articles with rich content.

### Feature

Displays a feature with name and description.

**Fields:**

- `name` (Text) - The feature name
- `description` (Text) - The feature description

**Usage:**
Use this component to highlight features of your products or services.

### Grid

A container component that renders child components in a grid layout.

**Fields:**

- `columns` (Blocks) - The components to display in the grid

**Usage:**
Use this component to create responsive grid layouts.

### Columns

Renders a flexible column layout with nested components.

**Fields:**

- `columns` (Blocks) - The components to display in columns

**Usage:**
Use this component to create multi-column layouts.

### Teaser

Displays a simple teaser with headline.

**Fields:**

- `headline` (Text) - The teaser headline

**Usage:**
Use this component to create attention-grabbing teasers.

## Usage in Next.js

To display Storyblok content in your Next.js application, use the `StoryblokStory` component as implemented in the demo page:

```tsx
import { ISbStoriesParams, StoryblokClient, StoryblokStory } from '@storyblok/react/rsc';
import { getStoryblokApi } from '@/lib/storyblok';

/**
 * Storyblok Demo Page
 * Fetches and displays content from Storyblok using server components
 */
export default async function StoryblokPage() {
  const { data } = await fetchData();

  return (
    <div className="container mx-auto py-8">
      <h1 className="mb-6">Storyblok Demo</h1>

      {data?.story ? (
        <div>
          <StoryblokStory story={data.story} />
        </div>
      ) : (
        <div className="p-4 bg-yellow-100 border border-yellow-400 rounded">
          <p>No content found. Please make sure that:</p>
          <ul className="list-disc ml-6 mt-2">
            <li>You have a valid Storyblok Access Token in your .env file</li>
            <li>You have created a "home" story in your Storyblok Space</li>
            <li>The story is published (or in draft mode if you're in development environment)</li>
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Fetch data from Storyblok
 */
export async function fetchData() {
  let sbParams: ISbStoriesParams = {
    version: process.env.NODE_ENV === 'production' ? 'published' : 'draft',
  };

  const storyblokApi: StoryblokClient = getStoryblokApi();
  return storyblokApi.get('cdn/stories/home', sbParams);
}
```

## Visual Editor Integration

The integration supports Storyblok's Visual Editor, allowing content creators to edit content directly on your site. The Visual Editor is enabled through the `StoryblokProvider` component in the application layout.

### SSL Configuration

**Important:** The Visual Editor only works with SSL-encrypted connections (HTTPS). To use the Visual Editor locally:

1. Ensure your local development environment is configured with SSL
2. Start the application with HTTPS support by running the dedicated npm script:
   ```bash
   npm run dev:https
   ```
3. Accept the self-signed certificate in your browser if necessary

The Visual Editor also works in deployed applications (development, staging, or production environments) as long as:

1. The application is running over HTTPS
2. The domain of the deployed application is added to the allowed domains in your Storyblok space settings
3. The correct Storyblok Access Token is configured in the environment variables

To configure the domain in Storyblok:

1. Go to your Storyblok Space
2. Navigate to Settings > Visual Editor
3. Add the domain of your development system to the list of allowed domains
4. Save the settings

### Real Path Configuration

When the slug of a Storyblok story doesn't match the URL of the application (e.g., when a story with the slug `/home` is displayed at the URL `/storyblok`), you need to configure the "Real Path" in the story settings:

1. Go to the content entry in Storyblok
2. Open the entry's configuration
3. Set the "Real Path" field to the actual path of the application (e.g., `/storyblok`)
4. Save the settings

This configuration is crucial for the Visual Editor to use the correct URL for editing.

### Using the Visual Editor

To use the Visual Editor:

1. Log in to your Storyblok account
2. Navigate to the content you want to edit
3. Click the "Edit" button
4. Make your changes in the Visual Editor
5. Publish the changes

## Best Practices

1. **Component Structure**: Keep your components focused on a single responsibility
2. **Field Naming**: Use consistent field naming across components
3. **Content Types**: Create clear content types in Storyblok that match your components
4. **Reusability**: Design components to be reusable across different pages
5. **Performance**: Use appropriate caching strategies for Storyblok API calls
6. **Validation**: Add validation to your Storyblok content types to ensure data quality
7. **Localization**: Use Storyblok's localization features for multi-language support
8. **Assets**: Optimize images and other assets before uploading to Storyblok
9. **Workflow**: Establish a clear workflow for content creation and publication
10. **Testing**: Test your components with different content scenarios

By following these guidelines, you can create a robust and flexible content management system using Storyblok and Next.js.
