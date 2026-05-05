# Icon Selection in CMS Components

This guide explains how icon selection works in CMS components and how the editor should handle icon fields.

## Overview

Icons are managed through a centralized **Icon Registry** that provides:
- Available icon names (e.g., `"ArrowRight"`, `"ShoppingCart"`)
- Icon metadata (labels and categories)
- Type-safe icon rendering

## How It Works

### 1. Icon Registry

The storefront maintains a centralized icon registry at `src/components/cms/icon-registry.ts`:

```typescript
export const iconRegistry = {
  // Arrows & Navigation
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  // ... more icons
  
  // Actions
  ShoppingCart,
  Heart,
  Search,
  // ... more icons
} as const;
```

### 2. Icon Metadata

Each icon has metadata for the CMS editor:

```typescript
export const iconMetadata = {
  ArrowRight: { label: 'Arrow Right', category: 'Arrows & Navigation' },
  ShoppingCart: { label: 'Shopping Cart', category: 'Actions' },
  Heart: { label: 'Heart', category: 'Actions' },
  // ... more icons
};
```

### 3. Component Definition

Components that use icons define them as `select` fields with options:

```typescript
import { getIconOptions } from '@/components/cms/icon-registry';

export const definition: CMSComponentTypeDefinition = {
  type: 'button',
  props: {
    iconLeft: { 
      label: 'Icon Left', 
      type: 'select',
      options: getIconOptions(),  // Returns all available icons
    },
  },
};
```

## CMS Editor Integration

### Receiving Icon Options

When the editor requests `COMPONENT_TYPES`, it receives icon fields like this:

```json
{
  "type": "button",
  "props": {
    "iconLeft": {
      "label": "Icon Left",
      "type": "select",
      "options": [
        {
          "value": "ArrowRight",
          "label": "Arrow Right",
          "category": "Arrows & Navigation"
        },
        {
          "value": "ArrowLeft",
          "label": "Arrow Left",
          "category": "Arrows & Navigation"
        },
        {
          "value": "ShoppingCart",
          "label": "Shopping Cart",
          "category": "Actions"
        }
        // ... more options
      ]
    }
  }
}
```

### Rendering Icon Selector

The editor should render a **searchable dropdown** or **icon picker** with:

#### Option 1: Simple Dropdown (Recommended)
```tsx
<select name="iconLeft">
  <option value="">None</option>
  <optgroup label="Arrows & Navigation">
    <option value="ArrowRight">Arrow Right</option>
    <option value="ArrowLeft">Arrow Left</option>
    <option value="ChevronRight">Chevron Right</option>
  </optgroup>
  <optgroup label="Actions">
    <option value="ShoppingCart">Shopping Cart</option>
    <option value="Heart">Heart</option>
    <option value="Search">Search</option>
  </optgroup>
  <!-- ... more categories -->
</select>
```

#### Option 2: Icon Picker with Visual Preview
```tsx
<IconPicker
  value={selectedIcon}
  onChange={setSelectedIcon}
  options={iconOptions}
  groupBy="category"
  searchable={true}
  renderOption={(option) => (
    <div>
      <IconPreview name={option.value} />
      <span>{option.label}</span>
    </div>
  )}
/>
```

### Features to Implement

**✅ Must Have:**
- Dropdown/select with all available icons
- Group icons by category
- Allow empty selection (no icon)
- Store icon name as string value

**🎯 Nice to Have:**
- Search/filter icons by name
- Visual icon preview in dropdown
- Recently used icons
- Icon preview next to selected value

### Data Format

**Stored Value:**
```json
{
  "iconLeft": "ArrowRight",
  "iconRight": ""
}
```

**Sent to Storefront:**
```json
{
  "type": "UPDATE_SLOT",
  "slots": [{
    "slotId": "main",
    "components": [{
      "id": "btn-1",
      "type": "button",
      "props": {
        "title": "Shop Now",
        "link": "/shop",
        "iconLeft": "",
        "iconRight": "ArrowRight"
      }
    }]
  }]
}
```

## Available Icons

Current icon registry includes:

### Arrows & Navigation
- `ArrowRight` - Arrow Right
- `ArrowLeft` - Arrow Left
- `ChevronRight` - Chevron Right
- `ChevronLeft` - Chevron Left
- `ChevronDown` - Chevron Down
- `ChevronUp` - Chevron Up
- `ExternalLink` - External Link

### Actions
- `ShoppingCart` - Shopping Cart
- `Heart` - Heart
- `Search` - Search
- `Plus` - Plus
- `Minus` - Minus
- `Check` - Check
- `X` - Close
- `Download` - Download
- `Upload` - Upload

### User & Contact
- `User` - User
- `Mail` - Mail
- `Phone` - Phone
- `MapPin` - Map Pin

### UI Elements
- `Menu` - Menu
- `Calendar` - Calendar
- `Clock` - Clock
- `Star` - Star

### Status
- `Info` - Info
- `AlertCircle` - Alert
- `CheckCircle` - Success
- `XCircle` - Error

## Adding New Icons

To add new icons to the storefront:

1. **Import from Lucide React:**
   ```typescript
   import { NewIcon } from 'lucide-react';
   ```

2. **Add to registry:**
   ```typescript
   export const iconRegistry = {
     // ... existing icons
     NewIcon,
   };
   ```

3. **Add metadata:**
   ```typescript
   export const iconMetadata = {
     // ... existing metadata
     NewIcon: { label: 'New Icon', category: 'Category Name' },
   };
   ```

4. **Icons automatically available** in all components using `getIconOptions()`

## Best Practices

### For Storefront Developers

✅ **Use centralized registry** - Always use `icon-registry.ts`  
✅ **Use `getIcon()` helper** - Don't access registry directly  
✅ **Add metadata** - Every icon needs label and category  
✅ **Group logically** - Use meaningful categories  

### For CMS Editor Developers

✅ **Respect categories** - Group icons in UI by category  
✅ **Allow empty selection** - Icons are optional  
✅ **Store string values** - Just the icon name, e.g., `"ArrowRight"`  
✅ **Validate on save** - Check icon exists in options  
✅ **Show preview** - Visual feedback helps users  

### For Content Editors

✅ **Choose appropriate icons** - Match icon to action/context  
✅ **Be consistent** - Use same icons for same actions  
✅ **Less is more** - Not every button needs an icon  
✅ **Test visibility** - Ensure icons are visible on backgrounds  

## Example: Button with Icons

### In CMS Editor UI:
```
┌─────────────────────────────────────┐
│ Button Component                    │
├─────────────────────────────────────┤
│ Title: [Shop Now              ]     │
│ Link:  [/shop                 ]     │
│                                     │
│ Icon Left:  [None ▼]                │
│                                     │
│ Icon Right: [Arrow Right ▼]         │
│             ┌──────────────────┐    │
│             │ None             │    │
│             ├──────────────────┤    │
│             │ Arrows & Nav     │    │
│             │  → Arrow Right ✓ │    │
│             │    Arrow Left    │    │
│             │    Chevron Right │    │
│             ├──────────────────┤    │
│             │ Actions          │    │
│             │    Shopping Cart │    │
│             │    Heart         │    │
│             └──────────────────┘    │
└─────────────────────────────────────┘
```

### Rendered Result:
```
┌──────────────────┐
│ Shop Now    →    │  ← "ArrowRight" icon on the right
└──────────────────┘
```

## Troubleshooting

### Icon Not Showing

**Problem:** Icon name sent but not rendering  
**Solution:** Check icon exists in `iconRegistry`

### Wrong Icon Displayed

**Problem:** Different icon than selected  
**Solution:** Verify exact name match (case-sensitive)

### Options Not Loading

**Problem:** Icon dropdown is empty  
**Solution:** Check `getIconOptions()` is called in definition

### Icon Preview Not Working

**Problem:** Can't preview icons in editor  
**Solution:** Editor needs to implement icon preview (optional feature)

## Related Documentation

- [Component Definitions Guide](./component-definitions.md)
- [Button Component Definition](../../src/components/cms/emporix/definitions/button.ts)
- [Icon Registry](../../src/components/cms/icon-registry.ts)
- [Lucide React Icons](https://lucide.dev/icons/)
