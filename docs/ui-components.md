# UI Components Documentation

This project provides a set of reusable UI components located in `src/components/ui`. These components are designed for consistency, accessibility, and rapid development. They are inspired by the [shadcn/ui](https://ui.shadcn.com/) library and leverage modern frontend technologies.

## Technology Stack

- **Tailwind CSS**: All components use [Tailwind CSS](https://tailwindcss.com/) utility classes for styling, ensuring a consistent and customizable design system.
- **shadcn/ui Patterns**: The architecture and many implementations are inspired by shadcn/ui, promoting composability and accessibility.
- **Radix UI**: Some components use primitives from [Radix UI](https://www.radix-ui.com/) for accessibility and behavior.
- **Lucide Icons**: [Lucide](https://lucide.dev/) icons are used for consistent, beautiful icons across components (`lucide-react` package).
- **cva (class-variance-authority)**: Components use [cva](https://cva.style/) to manage style variants (e.g., size, color, intent), making them highly extensible and customizable.

## Component List

The following are some of the available components:

- `Button`, `Input`, `Card`, `Dialog`, `Checkbox`, `Select`, `Tabs`, `Tooltip`, `Table`, `Accordion`, `Avatar`, `Badge`, `Breadcrumb`, `Carousel`, `DropdownMenu`, `Form`, `Label`, `Popover`, `Progress`, `RadioGroup`, `Rating`, `Separator`, `Sheet`, `Sidebar`, `Skeleton`, `SkeletonFrame`, `Slider`, `Spinner`, `Switch`, `Textarea`, `ToastNotification`, and more.

## Usage Example

### Importing a Component
```tsx
import { Button } from '@/components/ui/button';

<Button variant="primary" size="default">Click me</Button>
```

### Using Variants (cva)
Most components support variants for easy customization. For example, the `Button` component supports `variant` (primary, secondary, etc.) and `size` props:

```tsx
<Button variant="secondary" size="small">Secondary</Button>
```

### Using Lucide Icons
Icons from `lucide-react` can be used directly or as props in components:

```tsx
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

<Input startIcon={Search} placeholder="Search..." />
```

## Extending Components
Thanks to cva and Tailwind, you can easily extend or customize components by passing additional class names or by creating new variants in the component source.

## Best Practices
- Prefer using these components over raw HTML elements for consistency.
- Use the variant system instead of custom classes when possible.
- Refer to the source code for advanced usage or to add new variants.

## Product Detail Page (PDP)

Domain composition for the basic-product PDP lives outside `src/components/ui` but depends on the same tokens and primitives:

| Component | Path | Role |
|---|---|---|
| `ProductDetail` | `src/components/product/product-detail.tsx` | Page shell: media, title block, key specs / highlights, purchase column, technical information |
| `ProductPriceComponent` | `src/components/product/product-price.tsx` | Net-first price row (B2B): large net, small gross + VAT; COP-6239 qty-aware Your Price (`Your price (items {min} - {max})` / `{min}+`) via `GET /api/products/{id}/price` with the current quantity (embedded unit price is not reused when quantity changes); discount badge wording; inline list price |
| `ProductTierPrices` | `src/components/product/product-tier-prices.tsx` | Figma Tier Prices Table (`12799:113152`): Quantity / Price per unit; hidden when fewer than 2 tiers; active row by PDP quantity; net-first unit prices; trailing unit copy from `price.priceModelType` (`TIERED` → for units min–max / min+; `VOLUME` → for each unit) |
| `ProductTile` | `src/components/product/product-tile.tsx` | PLP card: parent tiles show up to 6 **label-only** variant-axis badges (`+N` overflow); sellable variants show up to 3 value+label pairs (`+N` overflow). Order follows `templateAttributeOrder`. Badge max width is 75% of the image chip stack (`max-w-3/4`). |
| `ProductVariantSelector` | `src/components/product/product-variant-selector.tsx` | Fetches the family for the **opened** `product.id` (`GET /api/products/{id}/variants`). Dual contract: classic `PARENT_VARIANT` / `VARIANT` via Product search `criteria: { parentVariantId }`; `DYNAMIC_VARIANT` via the root `variants` map. Composes interactive chips + always-shown sellable carousel. |
| `ProductVariantAttributeGroups` | `src/components/product/product-variant-attribute-groups.tsx` | Figma Variant Selection (`12799:113082`): every attribute value stays clickable. Black border = shopper filter (several values on one axis are OR; different axes are AND). Thin blue border = attributes of the opened variant. Clear all filters. COP-6384 display names (`attribute.name` / `value.name` / Product Templates), not beautified mixin keys. |
| `ProductVariantCarousel` | `src/components/product/product-variant-carousel.tsx` | Figma Sellable variants (`12799:113107`): always-shown horizontal cards (image, unselected-attribute call-outs, net-first unit price). Click navigates to `/product/{id}`. Dynamic families list `sellable === true` plus a disabled current non-sellable node. Truncated attribute values expose the full string in a hover tooltip; keyboard focus on the card unwraps the text (the card is already a button, so values are not nested focus targets). |
| `ProductShippingInfo` | `src/components/product/product-shipping-info.tsx` | Delivery details + USP card |
| `ProductDescription` | `src/components/product/product-description.tsx` | Sanitized, 3-line-clamped description with animated Show more / Show less |
| `ProductLabels` | `src/components/product/product-labels.tsx` | Tenant product labels: icon image + name tooltip when `image` URL exists, else text badge |

**Variant family (classic and dynamic):** `GET /api/products/[id]/variants` always takes the opened product id. Classic: `ProductService.getVariantProducts` GETs first, then searches `parentVariantId` (opened id for `PARENT_VARIANT`, the parent id for `VARIANT` so siblings match). Dynamic: resolve the root from `parentVariantPath` (last index) and GET-walk until a `variants` map exists; do not use `ownVariantAttributes` as the selector source. In assigned mode the opened dynamic id must be in segment scope before that walk, otherwise the family is empty. When the opened product is already the root, that GET is reused. The sellable list is always shown. Last-seen fly-out (`src/components/product/product-tile-fly-out.tsx`) uses the same COP-6384 display names as PDP chips.

**Key specifications vs Technical Information:** Key specifications shows only `highlight: true` specs (group label + HR when 2+ groups) plus `templateAttributes` as “Basic Specifications”. Technical Information shows all `groupedSpecifications`, with `templateAttributes` as the first “Basic Attributes” column. Template and variant-attribute labels come from Product Templates `attributes[].name` via service-scoped `GET /product/{tenant}/product-templates/{id}` (`product.product_template_read`), using the product’s `template.id` / `template.version`. `expand=template` may echo the attribute key into `name` and is not treated as the storefront label. Display uses `l10n`: current locale → site fallback language (if present) → default locale → `-`. Not i18n keys. DATETIME / ISO and NUMBER values use the shared locale formatters (`formatDate` / `Intl.NumberFormat`). Variant badges and PDP chips follow `templateAttributeOrder`. PDP chips and last-seen fly-out labels use COP-6384 display names (localized `name` on the attribute/value, else Product Templates), never beautified camelCase keys or leaked `filters.mixins…` keys.

**Delivery card columns (decision D3):** `ProductShippingInfo` uses one column from 0–1023px and two columns from `md` (1024px) upward (`grid-cols-1 md:grid-cols-2`). This is an intentional ticket-driven override of the Figma tablet frame that shows two columns at 768.

## References
- [shadcn/ui Documentation](https://ui.shadcn.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Lucide Icons](https://lucide.dev/)
- [cva (class-variance-authority)](https://cva.style/)

---

For more details, explore the source files in `src/components/ui` or reach out to the maintainers.

## Related Documentation

- [Documentation index](./README.md)
- [Styling & Theming](./styling-and-theming.md)
- [Project Structure](./project-structure.md)
- [Testing Guide](./testing-guide.md)
