# Component Definitions: Bridging Storefront and CMS Extension

## Overview

Component definitions serve as the **critical bridge** between the storefront's React components and the Emporix CMS extension. They enable visual editing capabilities by defining how components appear in the CMS editor and how data flows between the editor and the actual rendered components.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Emporix CMS Editor                         │
│                    (Visual Editor Interface)                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ postMessage API
                             │ (REQUEST_COMPONENT_TYPES,
                             │  UPDATE_SLOT, etc.)
                             │
┌────────────────────────────▼────────────────────────────────────┐
│              @extensions/medienwerft-cms-plugin                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  cms-component-registry.ts                               │  │
│  │  • CMSComponentTypeDefinition (type system)              │  │
│  │  • CMSComponentEntry (definition + mapper + component)   │  │
│  │  • Helper functions (resolveEntries, getMapper)          │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  useCMSEditorMessages.ts (useCMSLiveEditor hook)         │  │
│  │  • Handles editor postMessage events                     │  │
│  │  • Manages live component state                          │  │
│  │  • Responds with component type definitions              │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  emporix-content-slot.tsx                                │  │
│  │  • Renders components for specific slots                │  │
│  │                                                           │  │
│  │  emporix-cms-component-renderer.tsx                      │  │
│  │  • Renders components from CMS data                      │  │
│  │  • Applies prop mapping transformations                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ via DI (EmporixCMSComponentService)
                             │
┌────────────────────────────▼────────────────────────────────────┐
│         src/components/cms/emporix/definitions/                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  index.ts                                                │  │
│  │  • Exports cmsDefinitionMap (all definitions)            │  │
│  │  • Exports cmsComponentTypes (type strings)              │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  hero.ts, quick-entry.ts, column-teaser.ts, etc.         │  │
│  │  • Component-specific definitions                        │  │
│  │  • Prop mapping functions                                │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ component props
                             │
┌────────────────────────────▼────────────────────────────────────┐
│              src/components/cms/                                │
│  • hero.tsx                                                     │
│  • quick-entry.tsx                                              │
│  • column-teaser.tsx                                            │
│  • etc. (Actual React components)                               │
└─────────────────────────────────────────────────────────────────┘
```

## The Two-Part Definition System

Each component definition consists of **two essential parts**:

### 1. Component Type Definition (`definition`)

Describes the component's metadata and prop schema for the CMS editor:

```typescript
export const definition: CMSComponentTypeDefinition = {
  type: 'hero',                    // Unique component type identifier
  label: 'Hero Section',           // Display name in CMS editor
  description: 'Large banner...',  // Help text for editors
  
  props: {
    headline: { 
      label: 'Headline', 
      type: 'text', 
      required: true 
    },
    image: {
      label: 'Image',
      type: 'media',
      allowedTypes: ['image/*']
    },
    // ... more prop definitions
  },
  
  defaultProps: {
    headline: '',
    image: { filename: '', alt: '' }
  }
};
```

**Purpose:**
- Tells the CMS editor which fields to display
- Defines field types (text, media, component, array, etc.)
- Specifies validation rules (required, allowed types)
- Provides default values for new components

### 2. Prop Mapper Function (`mapProps`)

Transforms CMS editor data into the format expected by the actual React component:

```typescript
export function mapProps(cmsProps: Record<string, any>): Record<string, any> {
  const mapped: Record<string, any> = { ...cmsProps };

  // Transform plain text into rich text structure
  if (typeof mapped.text === 'string') {
    mapped.text = {
      content: [{ 
        text: mapped.text, 
        type: 'paragraph', 
        content: [{ text: mapped.text }] 
      }],
    };
  }

  // Transform single button into array
  if (mapped.main_button && !Array.isArray(mapped.main_button)) {
    mapped.main_button = [mapped.main_button];
  }

  // Map URL field to filename field
  if (mapped.image?.url) {
    mapped.image = { ...mapped.image, filename: mapped.image.url };
  }

  return mapped;
}
```

**Purpose:**
- Bridges the gap between CMS data structure and component expectations
- Handles data format conversions (string → rich text, object → array)
- Normalizes field names (url → filename)
- Ensures type compatibility

## Data Flow

### 1. Editor → Storefront (Component Creation)

```
CMS Editor                    Definition                  React Component
─────────────────────────────────────────────────────────────────────
User adds "Hero"
  ↓
Requests component types
  ↓                          definition.props
Editor renders form    ←──── (text, media, etc.)
  ↓
User fills in fields
  ↓
Sends UPDATE_SLOT
  { headline: "Welcome",
    image: { url: "..." } }
  ↓                          mapProps()
Data transformation    ──────▶ { headline: "Welcome",
  ↓                              image: { filename: "..." } }
  ↓
Component renders      ──────▶ <Hero headline="Welcome" 
                                     image={{ filename: "..." }} />
```

### 2. Live Editing (Component Updates)

```
CMS Editor                    Hook                        React Component
─────────────────────────────────────────────────────────────────────
User edits field
  ↓
Sends UPDATE_SLOT
  ↓
useCMSLiveEditor        ──────▶ Updates component state
  ↓                              Applies mapProps()
  ↓
Re-render              ──────▶ Component updates instantly
```

## Field Types Reference

The definition system supports various field types for different data needs:

| Field Type | Description | Example Use Case |
|------------|-------------|------------------|
| `text` | Single-line text input | Headlines, labels |
| `textarea` | Multi-line text input | Descriptions, paragraphs |
| `number` | Numeric input | Counts, dimensions |
| `boolean` | Checkbox | Feature toggles |
| `color` | Color picker | Theme colors |
| `url` | URL input with validation | Links, external resources |
| `media` | Media file selector | Images, videos |
| `select` | Dropdown selection | Predefined options |
| `object` | Nested object structure | Complex configurations |
| `array` | List of items | Multiple entries |
| `component` | Nested component | Buttons within hero |

## Advanced Features

### Nested Components

Components can contain other components:

```typescript
props: {
  main_button: {
    label: 'Button',
    type: 'component',
    allowedComponentTypes: ['button'],  // Restrict to button type
    multiple: true                      // Allow multiple buttons
  }
}
```

### Reusable Field Definitions

Define fields once, reference multiple times:

```typescript
fieldDefinitions: {
  linkField: {
    label: 'Link',
    type: 'object',
    properties: {
      url: { label: 'URL', type: 'url' },
      text: { label: 'Text', type: 'text' }
    }
  }
},
props: {
  primaryLink: { $ref: 'linkField' },
  secondaryLink: { $ref: 'linkField' }
}
```

### Complex Array Structures

Define arrays of structured objects:

```typescript
props: {
  elements: {
    label: 'Elements',
    type: 'array',
    items: {
      label: 'Entry',
      type: 'object',
      properties: {
        title: { label: 'Title', type: 'text', required: true },
        link: { label: 'Link', type: 'url' },
        icon: { label: 'Icon', type: 'text' }
      }
    }
  }
}
```

## Creating New Component Definitions

### Step 1: Create the Definition File

Create a new file in `src/components/cms/emporix/definitions/`:

```typescript
// my-component.ts
import { CMSComponentTypeDefinition } from '@extensions/medienwerft-cms-plugin/cms-component-registry';

export const definition: CMSComponentTypeDefinition = {
  type: 'my-component',
  label: 'My Component',
  description: 'Description for CMS editors',
  props: {
    // Define your props here
  },
  defaultProps: {
    // Define default values
  }
};

export function mapProps(cmsProps: Record<string, any>): Record<string, any> {
  // Transform CMS props to component props
  return cmsProps;
}
```

### Step 2: Create the React Component

Create the actual component in `src/components/cms/`:

```typescript
// my-component.tsx
interface MyComponentProps {
  // Props as expected by your component
}

export function MyComponent({ ...props }: MyComponentProps) {
  return (
    // Your component implementation
  );
}
```

### Step 3: Register in the CMSComponentService

Add the entry to your `CMSComponentService` implementation (e.g. in the storefront's definition map):

```typescript
import * as myComponent from './my-component';
import dynamic from 'next/dynamic';

// In your cmsDefinitionMap or service implementation:
{
  definition: myComponent.definition,
  mapProps: myComponent.mapProps,
  component: dynamic(() => import('@/components/cms/my-component').then(m => m.MyComponent)),
}
```

The `CMSComponentEntry` includes three fields:
- `definition` — component type metadata and prop schema
- `mapProps` — transforms CMS data to component props
- `component` — the actual React component to render

## Best Practices

### 1. Keep Definitions Close to Components

Store definitions in `src/components/cms/emporix/definitions/` to maintain clear ownership and easy discovery.

### 2. Use Descriptive Labels

```typescript
// Good
{ label: 'Background Image', type: 'media' }

// Avoid
{ label: 'bg_img', type: 'media' }
```

### 3. Provide Sensible Defaults

```typescript
defaultProps: {
  headline: 'Enter headline here',
  showButton: true,
  alignment: 'center'
}
```

### 4. Document Prop Transformations

```typescript
export function mapProps(cmsProps: Record<string, any>): Record<string, any> {
  const mapped = { ...cmsProps };
  
  // The CMS stores URLs in 'url', but the component expects 'src'
  if (mapped.image?.url) {
    mapped.image = { ...mapped.image, src: mapped.image.url };
  }
  
  return mapped;
}
```

### 5. Validate Required Fields

```typescript
props: {
  headline: { 
    label: 'Headline', 
    type: 'text', 
    required: true  // CMS will enforce this
  }
}
```

### 6. Restrict Nested Components

```typescript
props: {
  cta: {
    label: 'Call to Action',
    type: 'component',
    allowedComponentTypes: ['button', 'link'],  // Only allow specific types
    multiple: false  // Only one component allowed
  }
}
```

## Serialization Boundary

**Important:** Component definitions (which include functions and React components) cannot be serialized across the Next.js server→client boundary.

The current architecture solves this via DI:
- **Server components** (`EmporixCmsPage`) fetch page data and pass it to the client provider
- **Client components** (`EmporixCMSComponentRenderer`) resolve component definitions at runtime via the DI container (`client.get<CMSComponentService>('EmporixCMSComponentService')`)
- This avoids serializing functions or React components across the boundary

## Summary

Component definitions are the **essential glue** that makes visual CMS editing possible:

1. **Define** component metadata and prop schema for the CMS editor
2. **Transform** CMS data into component-compatible props
3. **Enable** live editing and instant preview
4. **Bridge** the gap between generic CMS storage and specific component requirements

Without these definitions, the CMS editor wouldn't know:
- What components are available
- What fields to display for each component
- How to validate user input
- How to transform data for the actual components

They are **not optional** — they are the core mechanism that enables the entire visual editing experience.
