# Slot-Based CMS Page Architecture

## Overview

The CMS system has been refactored to support a declarative slot-based layout where storefront implementors can define page structure using `<EmporixCmsPage>` and `<EmporixContentSlot>` components with custom styling and positioning.

## New Components

### `EmporixCmsPage`
Server component that wraps CMS page content with the necessary context.

**Usage Options:**

```tsx
// Option 1: Pre-fetch for breadcrumb/metadata
const page = await fetchCMSPage(slug, locale, site);
<EmporixCmsPage page={page}>
  <EmporixContentSlot slot="top" />
  <EmporixContentSlot slot="main" className="container mx-auto" />
  <EmporixContentSlot slot="bottom" />
</EmporixCmsPage>

// Option 2: Let component fetch internally
<EmporixCmsPage slug="home" locale={locale} site={site}>
  <EmporixContentSlot slot="top" />
  <EmporixContentSlot slot="main" />
  <EmporixContentSlot slot="bottom" />
</EmporixCmsPage>
```

### `EmporixContentSlot`
Client component that renders components for a specific slot.

**Props:**
- `slot: string` - Slot ID to render
- `renderWhenEmpty?: boolean` - Force render even when empty
- `className?: string` - Additional CSS classes
- `...htmlAttributes` - Any other HTML div attributes

**Features:**
- Automatic editor mode detection
- Visual feedback in editor mode using CSS custom properties:
  - Layout slots: `outline` with `--color-cms-slot-layout`
  - Page slots: `outline` with `--color-cms-slot-page`
  - Highlighted slot: `outline` with `--color-cms-highlight`
- Empty state placeholder in editor mode
- Component and slot highlighting support

### `fetchCMSPage`
Server-side utility function for fetching CMS page data.

```tsx
const page = await fetchCMSPage(slug, locale, site, fallbackSite, version);
```

## Editor Mode Features

### Visual Feedback

**Slot Outlines:**
- Layout slots: `outline outline-2 outline-dashed` with CSS variable `--color-cms-slot-layout`
- Page slots: `outline outline-2 outline-dashed` with CSS variable `--color-cms-slot-page`
- Highlighted slot: `outline outline-2 outline-solid` with CSS variable `--color-cms-highlight`
- Minimum height: `min-h-[50px]`

**Empty Slots:**
Display placeholder text in editor mode:
```
Layout Slot: {slotId}
or
Page Slot: {slotId}
```

### Component Highlighting

When a component is selected in the LiveEditor, it receives a highlight ring:
- Highlight styling: `ring-2 ring-offset-2` with CSS variable `--tw-ring-color: var(--color-cms-highlight)`
- All components have `data-component-id` attribute in editor mode
- Only one component highlighted at a time

### Slot Highlighting

When a slot is selected in the LiveEditor, it receives a solid outline:
- Highlight styling: `outline outline-2 outline-solid` with `--color-cms-highlight`
- Slots have `data-slot` attribute for identification

## Message Protocol

### `HIGHLIGHT_COMPONENT`

**LiveEditor sends:**
```typescript
{
  type: 'HIGHLIGHT_COMPONENT',
  componentId: 'component-123', // or null to clear
  slotId?: 'main' // optional context
}
```

**Storefront behavior:**
- Applies blue ring to highlighted component
- Clears previous highlight
- Only active in editor mode

### Other Messages
- `UPDATE_SLOT` - Update components in one or more slots
- `UPDATE_LAYOUT` - Update slot configuration
- `UPDATE_METADATA` - Update page metadata
- `REQUEST_COMPONENT_TYPES` - Request available component types
- `COMPONENT_TYPES` - Response with component types
- `IFRAME_READY` - Storefront signals ready state

## Architecture

### Context-Based State Management

```
EmporixCmsPage (Server)
  └─> EmporixCMSProvider (Client)
      └─> useCMSLiveEditor hook
      └─> EmporixCMSContext.Provider
          └─> EmporixContentSlot (Client)
              └─> EmporixCMSComponentRenderer
                  └─> Individual Components
```

### State Flow

1. **Server**: `EmporixCmsPage` fetches or receives page data
2. **Client**: `EmporixCMSProvider` initializes hook with page data
3. **Hook**: `useCMSLiveEditor` manages:
   - Slot components (`slotComponents`)
   - Slot configuration (`slotConfig`) using `CMSSlotConfig` type
   - Page metadata (`metadata`)
   - Editor mode detection (`isEditorMode`)
   - Highlighted component (`highlightedComponentId`)
   - Highlighted slot (`highlightedSlotId`)
4. **Context**: `EmporixCMSContext` provides state to all child components
5. **Slots**: `EmporixContentSlot` renders components for specific slots
6. **Renderer**: `EmporixCMSComponentRenderer` applies highlights

## Migration from Old System

### Before (Legacy - Removed)
```tsx
<CustomEntityCMSPage slug="home" locale={locale} site={site} />
```

### After (Current)
```tsx
<EmporixCmsPage slug="home" locale={locale} site={site} searchParams={searchParams}>
  <EmporixContentSlot slot="top" />
  <EmporixContentSlot slot="main" className="container mx-auto" />
  <EmporixContentSlot slot="bottom" />
</EmporixCmsPage>
```

Editor mode is now detected automatically from `searchParams.editMode === 'true'`.

### Benefits
- Full control over page layout
- Custom styling per slot
- Flexible slot positioning
- Better separation of concerns
- Improved editor mode experience

## Current File Structure

1. `context/emporix-cms-context.tsx` - Context definition (`EmporixCMSContext`)
2. `components/emporix-cms-page.tsx` - Server component wrapper
3. `components/emporix-cms-provider.tsx` - Client component provider (`EmporixCMSProvider`)
4. `components/emporix-content-slot.tsx` - Slot renderer
5. `components/emporix-cms-component-renderer.tsx` - Component renderer with highlight support
6. `components/cms-setup-missing-banner.tsx` - Fallback when DI services are missing
7. `hooks/useCMSLiveEditor.ts` - Editor postMessage bridge (singleton overlay store)
8. `lib/fetch-cms-page.ts` - Data fetching utility
9. `lib/version-utils.ts` - Version parameter validation
10. `lib/component-utils.ts` - Component type extraction from DI
