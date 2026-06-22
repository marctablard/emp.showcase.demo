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

- `Button`, `Input`, `Card`, `Dialog`, `Checkbox`, `Select`, `Tabs`, `Tooltip`, `Table`, `Accordion`, `Avatar`, `Badge`, `Breadcrumb`, `Carousel`, `DropdownMenu`, `Form`, `Label`, `Popover`, `Progress`, `RadioGroup`, `Rating`, `Separator`, `Sheet`, `Sidebar`, `Skeleton`, `Slider`, `Spinner`, `Switch`, `Textarea`, `ToastNotification`, and more.

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
