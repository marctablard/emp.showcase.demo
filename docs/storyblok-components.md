# Creating Storyblok Components

This guide explains how to create and integrate Storyblok components in the Emporix Showcase project.

## Component Structure

All Storyblok components should be created in the `src/components/cms` directory. Each component follows a specific structure to ensure proper integration with the Storyblok CMS.

### Basic Component Structure

```tsx
'use client';

import { storyblokEditable } from '@storyblok/react/rsc';

// Define the props interface with a blok property
interface MyComponentProps {
  blok: {
    // Define the properties that will be editable in Storyblok
    title?: string;
    description?: string;
    // Add other properties as needed
  };
}

// Create the component that receives the blok prop
const MyComponent = ({ blok }: MyComponentProps) => {
  return (
    <div {...storyblokEditable(blok)}>
      {blok.title && <h1>{blok.title}</h1>}
      {blok.description && <p>{blok.description}</p>}
      {/* Render other content */}
    </div>
  );
};

// Export both the props interface and the component
export type { MyComponentProps };
export default MyComponent;
```

## Key Requirements

1. **Client Component**: Use the `'use client'` directive at the top of your file to mark it as a client component.

2. **Props Interface**: Define an interface for your component props that includes a `blok` property. This property should match the structure of your Storyblok component.

3. **Storyblok Editable**: Use the `storyblokEditable` function to make your component editable in the Storyblok Visual Editor.

4. **Export Both**: Export both your component and its props interface to allow other components to reference it.

## Example: Article Component

Here's an example of the Article component:

```tsx
'use client';

import { Link } from '@/i18n/navigation';
import { H1, H2, H3 } from '@/components/ui/h';
import { renderRichText, storyblokEditable } from '@storyblok/react/rsc';

interface ArticleProps {
  blok: {
    title?: string;
    introduction?: string;
    video?: {
      url?: string;
      title?: string;
    };
    content?: any; // Rich text content
    linked_products?: Array<{
      _uid: string;
      product_id?: string;
      name?: string;
    }>;
  };
}

const Article = ({ blok }: ArticleProps) => {
  return (
    <article {...storyblokEditable(blok)} className="article max-w-4xl mx-auto py-8">
      {/* Article header */}
      <header className="mb-8">
        {blok.title && (
          <H1 variant="h5" className="mb-4">
            {blok.title}
          </H1>
        )}

        {blok.introduction && <div className="text-lg text-text-on-disabled mb-6">{blok.introduction}</div>}
      </header>

      {/* Video */}
      {blok.video?.url && (
        <div className="mb-8">
          <iframe
            src={blok.video.url}
            title={blok.video.title || 'Video'}
            className="w-full aspect-video rounded-lg"
            allowFullScreen
          ></iframe>
        </div>
      )}

      {/* Rich text content */}
      {blok.content && <div className="prose max-w-none mb-8">{renderRichText(blok.content)}</div>}

      {/* Linked products */}
      {blok.linked_products && blok.linked_products.length > 0 && (
        <div className="mt-12">
          <H2 variant="h6" className="mb-4">
            Related Products
          </H2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {blok.linked_products.map((product) => (
              <div key={product._uid} className="border rounded-lg p-4">
                <H3 variant="h6" className="mb-2">
                  {product.name}
                </H3>
                {product.product_id && (
                  <Link href={`/product/${product.product_id}`} className="text-text-action hover:underline">
                    View Product
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
};

export default Article;
```

## Component Composition

Components can reference each other by importing and using their exported props interfaces:

```tsx
import type { ArticleProps } from './article';

interface BlogPostProps {
  blok: {
    title: string;
    featured_article: ArticleProps['blok'];
    // Other properties
  };
}
```

## Creating Components in Storyblok

After creating your component in the codebase, you need to define it in Storyblok:

1. Log in to your Storyblok account
2. Navigate to the Block Library section
3. Click "Create Block"
4. Fill in the component details:
   - **Name**: The name of your component (e.g., "Article")
   - **Technical Name**: The technical identifier (e.g., "article")
   - **Schema**: Define the fields that match your component's props interface

### Schema Definition Example

For the Article component, your schema might look like:

```json
{
  "title": {
    "type": "text",
    "pos": 0
  },
  "introduction": {
    "type": "textarea",
    "pos": 1
  },
  "video": {
    "type": "object",
    "pos": 2,
    "fields": {
      "url": {
        "type": "text",
        "pos": 0
      },
      "title": {
        "type": "text",
        "pos": 1
      }
    }
  },
  "content": {
    "type": "richtext",
    "pos": 3
  },
  "linked_products": {
    "type": "blocks",
    "pos": 4,
    "blocks": [
      {
        "name": "product_reference",
        "type": "object",
        "fields": {
          "product_id": {
            "type": "text",
            "pos": 0
          },
          "name": {
            "type": "text",
            "pos": 1
          }
        }
      }
    ]
  }
}
```

For more information on creating components in Storyblok, refer to the [official documentation](https://www.storyblok.com/docs/guides/nextjs/).

## Component Registration

After creating your component, make sure to register it in the Storyblok provider configuration:

```tsx
// In your storyblok.tsx or similar file
import { storyblokInit, apiPlugin } from '@storyblok/react/rsc';
import MyComponent from '@/components/cms/my-component';
import Article from '@/components/cms/article';

storyblokInit({
  accessToken: 'your-access-token',
  use: [apiPlugin],
  components: {
    my_component: MyComponent,
    article: Article,
    // Add other components here
  },
});
```

## Best Practices

1. **Consistent Naming**: Use consistent naming conventions for your components and their props.
2. **Type Safety**: Always define proper TypeScript interfaces for your component props.
3. **Optional Properties**: Make properties optional when appropriate to avoid runtime errors.
4. **Conditional Rendering**: Use conditional rendering for optional properties.
5. **Component Documentation**: Add JSDoc comments to document your component's purpose and usage.
6. **Reusable Components**: Design components to be reusable when possible.

By following these guidelines, you'll be able to create and integrate Storyblok components effectively in your Emporix Showcase project.
