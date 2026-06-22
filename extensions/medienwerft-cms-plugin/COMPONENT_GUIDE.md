# How to Build Components (with great inline-editing support)

A practical guide for **developers and agents** building storefront components
that plug into the Emporix CMS editor. It covers the anatomy of a component and
— the focus of this doc — how to make every field **inline-editable** in the
live preview with the least friction.

Related docs:
- [`INSTALLATION.md`](./INSTALLATION.md) — wiring the extension, field-type reference, registration.
- [`INLINE_EDITING.md`](./INLINE_EDITING.md) — the postMessage protocol + the CMS-editor side.
- [`docs/component-definitions.md`](./docs/component-definitions.md) — the definition ↔ component bridge in depth.

---

## TL;DR — the inline-editing checklist

When you build a component, you get inline editing **for free** if you follow these rules:

1. **Declare every editable field in `props`** with the right `type` (and `options` for selects, `allowedTypes` for media). The editor can only edit what the definition describes.
2. **Render text values verbatim** — `{headline}`, not `{headline.toUpperCase()}` or `{truncate(headline)}`. Verbatim text is what lets the binder find and edit it in place.
3. **Render media as `<img src={filename}>`** so the binder can match the image to its field.
4. **Put each editable text in its own leaf element** (`<h1>{headline}</h1>`), not mixed with icons/siblings inside one node.
5. **Add `data-cms-field="<path>"`** to any element where the above isn't possible — transformed text, duplicate strings, array items, or a product/category card you want clickable. This is the precise, fool-proof binding and always wins.
6. **Keep `defaultProps` complete** so a freshly added component renders real content to click on.

Everything below explains *why* and shows the patterns.

---

## Anatomy of a component

A component is registered as a `CMSComponentEntry` — three parts that travel together:

```ts
import dynamic from 'next/dynamic';
import type { CMSComponentEntry, CMSComponentTypeDefinition } from '@extensions/medienwerft-cms-plugin/types';

// 1) DEFINITION — the schema the editor uses to build its UI and to drive inline editing.
const featureDefinition: CMSComponentTypeDefinition = {
  type: 'cms-feature',
  label: 'Feature Banner',
  description: 'Headline, body, image and a CTA.',
  props: {
    headline: { label: 'Headline', type: 'text', required: true },
    body:     { label: 'Body', type: 'textarea' },
    image:    { label: 'Image', type: 'media', allowedTypes: ['image/*'] },
    cta_label:{ label: 'CTA Label', type: 'text' },
    cta_link: { label: 'CTA Link', type: 'url' },
    variant:  { label: 'Style', type: 'select',
                options: [{ label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' }],
                defaultValue: 'light' },
  },
  defaultProps: {
    headline: 'Your headline', body: 'Some supporting copy.',
    image: { filename: '', alt: '' }, cta_label: 'Learn more', cta_link: '/', variant: 'light',
  },
};

// 2) mapProps — transforms the stored CMS props into the React component's props.
const mapFeature = (p: Record<string, any>) => ({
  headline: p.headline ?? '',
  body: p.body ?? '',
  image: p.image ? { filename: p.image.url ?? p.image.filename ?? '', alt: p.image.alt ?? '' } : undefined,
  ctaLabel: p.cta_label ?? '',
  ctaLink: p.cta_link ?? '',
  variant: p.variant ?? 'light',
});

// 3) ENTRY — definition + mapper + the React component (+ optional theme gate).
export const featureEntry: CMSComponentEntry = {
  definition: featureDefinition,
  mapProps: mapFeature,
  component: dynamic(() => import('./cms-feature')),
};
```

See real examples in [`src/components/medienwerft/definitions.ts`](../../src/components/medienwerft/definitions.ts).

> **Field-type reference** lives in [`INSTALLATION.md` §Field Types Reference](./INSTALLATION.md#3-field-types-reference). Registration (spreading entries into the `StorefrontCMSComponentService` map) is in the same file.

---

## How inline editing actually works

In editor mode (`?editMode=true`), the renderer wraps each component instance in a
generic binder (`emporix-inline-editable.tsx`). The binder does **not** require any
per-component code. It:

1. Reads the component's **raw props** (current values) and its **definition**
   (field schema), and flattens them into a list of editable leaves — descending
   into `object` (`properties`) and `array` (`items`) fields. Each leaf has a
   **field path** (see below).
2. **Anchors** each leaf to a DOM element:
   - an explicit `[data-cms-field="<path>"]` element (always preferred), else
   - for text/textarea: the element whose text equals the value, else
   - for media: the `<img>` whose `src` matches the filename, else
   - for url: the `<a>` whose `href` matches the value.
3. Attaches the affordance:
   - **text / textarea** → the element becomes editable in place; the new value commits on blur/Enter.
   - **url** → hovering the matched `<a>` shows a floating link button; clicking it opens a small URL popup (no gray chip).
   - **media / product / category** → clicking asks the editor to open its selector dialog.
   - **select** → a dropdown of the declared `options`.
4. Anything it can't anchor (a transformed value, a duplicate string, every
   `select`/`product`/`category` without a hint) is surfaced as a chip in a
   **per-component fields panel** — collapsed behind a small button (with a
   field count) in the component's top-right corner so it doesn't obstruct the
   preview; click it to reveal the chips.

The storefront never mutates its own state — it sends an intent and the CMS loops
the result back via `UPDATE_SLOT` (full protocol in [`INLINE_EDITING.md`](./INLINE_EDITING.md)).

### Why `mapProps` matters for anchoring

The binder gets **values** from the raw props and **schema** from the definition —
so introspection is always correct. But **anchoring text in place** works by
matching the *rendered* text against the value. If your component (or `mapProps`)
transforms the text before rendering, the rendered string no longer equals the
stored value and the binder can't find it — the field falls back to the toolbar.

That's not broken, just less nice. To keep in-place editing, either render
verbatim or add a `data-cms-field` hint (next section).

---

## Field paths

A field path addresses one leaf in the raw props. Dots separate keys; **numeric
segments index arrays**:

| Definition shape                              | Path examples                |
| --------------------------------------------- | ---------------------------- |
| top-level field                               | `headline`                   |
| `object` → `properties.cta.label`             | `cta.label`                  |
| `array` of objects                            | `items.0.title`, `items.3.image` |
| nested arrays                                  | `columns.1.links.2.href`     |

Use the same path in `data-cms-field` and the editor will resolve it to the same value.

---

## The `data-cms-field` hint — precise, fool-proof binding

Add `data-cms-field="<path>"` to the element that renders a field. The binder
binds that exact element, skipping all guessing. Use it whenever automatic
matching is unreliable:

```tsx
// Transformed text — render shows uppercase, value is mixed-case → hint it.
<span className="badge" data-cms-field="overline">{overline.toUpperCase()}</span>

// Duplicate strings — two fields could hold the same text → hint both.
<h2 data-cms-field="headline">{headline}</h2>

// Array items — give each rendered field the indexed path.
{items.map((item, idx) => (
  <article key={idx}>
    <h3 data-cms-field={`items.${idx}.title`}>{item.title}</h3>
    <p  data-cms-field={`items.${idx}.tags`}>{item.tags}</p>
    {item.image?.filename && (
      <img data-cms-field={`items.${idx}.image`} src={item.image.filename} alt={item.image.alt ?? ''} />
    )}
  </article>
))}

// Product/category card — make the whole visual element open the dialog.
<a data-cms-field="sku" /* product */>{/* product card markup */}</a>
```

Rules for hints:
- The path must match the **raw** prop path (pre-`mapProps`), e.g. `cta_link`, not the mapped `ctaLink`.
- For **text/textarea/url**, the hinted element should contain **only** that text (the whole element becomes editable; extra children would be edited too).
- For **media / product / category**, the hinted element becomes click-to-open — put it on the image or the card wrapper.
- **`select` ignores hints by design** — selects are always edited through the toolbar dropdown, never in place. Just declare `options` and you're done.

---

## Per-field best practices

### Text / textarea
- Render verbatim in a dedicated leaf element. Don't format inside JSX (`.toUpperCase()`, number formatting, `truncate(...)`); if you must, hint it.
- `text` commits on Enter or blur (single line); `textarea` keeps newlines and commits on blur.
- Don't wrap the text together with icons/badges in the same element — give the text its own `<span>`/`<h*>`/`<p>`.

### URL / links
- Render the value as the `href` of an `<a>`/`Link` — the binder matches the field to that anchor by href and shows a hover link button → URL popup (no gray chip). Locale-prefixed/absolute hrefs (e.g. `/en/services` for `/services`) still match.
- If the URL drives something other than an `<a href>` (e.g. a router push on click), add `data-cms-field="<path>"` to the element you want to carry the link affordance.

### Media
- Render `<img src={filename}>`. The binder matches by filename (handles Next.js `/_next/image?url=…` rewrites too). Clicking opens the CMS media selector; the new asset arrives via the `UPDATE_SLOT` loopback.
- Declare `allowedTypes` (e.g. `['image/*']`) so the editor scopes its picker.
- If the image is decorative/background (CSS `background-image`, or an icon font), add `data-cms-field="<path>"` to the element you want clickable.

### Select
- Always provide `options: [{ label, value }]`. The toolbar renders a native dropdown; choosing commits immediately.
- Selects usually control a class/variant and aren't visible as text, so they live in the toolbar — that's expected, not a fallback.

### Product / Category
- Declare `type: 'product'` / `type: 'category'` (add `multiple: true` for multi-category). These open the editor's product-search / category-picker dialog.
- Without a hint they appear as a toolbar chip. To make the rendered product card / category tile itself clickable, put `data-cms-field="<path>"` on its wrapper.

### Objects & arrays
- Fully supported by introspection — just declare `properties` / `items`. For best in-place editing inside arrays, add indexed `data-cms-field` hints as shown above (auto-matching across many similar items is ambiguous).

### Clicks are neutralized while editing
In editor mode the binder installs a capture-phase click guard so that clicking a
link or button in the preview **does not navigate or fire its action** — otherwise
clicking a CTA label to edit it would follow the link. Implications:

- Editing text that sits inside an `<a>`/`<button>` works (the caret is placed on mousedown; only the click's default/handlers are suppressed).
- Your component's own `onClick`/navigation won't run in editor mode. That's intended — the preview is for editing, not browsing.
- The inline toolbar and media/product/category anchors are exempt and work normally.

### Not yet inline-editable
- `number`, `boolean`, `color`, and nested `component` fields are edited in the **sidebar** only; they don't render an inline affordance. Everything still works — they're just not click-to-edit in the preview.

---

## Worked example — `cms-feature` with full inline support

```tsx
// cms-feature.tsx
import Image from 'next/image';
import { Link } from '@/i18n/navigation';

export interface CmsFeatureProps {
  headline: string;
  body?: string;
  image?: { filename: string; alt?: string };
  ctaLabel?: string;
  ctaLink?: string;
  variant?: 'light' | 'dark';
}

export default function CmsFeature({ headline, body, image, ctaLabel, ctaLink, variant = 'light' }: CmsFeatureProps) {
  return (
    <section className={variant === 'dark' ? 'bg-black text-white' : 'bg-white text-black'}>
      {image?.filename && (
        // matched automatically by src; hint added for robustness
        <Image data-cms-field="image" src={image.filename} alt={image.alt ?? ''} fill className="object-cover" />
      )}
      <div className="container py-20">
        {/* verbatim text → editable in place, no hint needed */}
        <h2>{headline}</h2>
        {body && <p>{body}</p>}
        {ctaLabel && ctaLink && (
          // The label is the editable text; the href is a `url` field. Hint the
          // label so editing it doesn't fight the surrounding <Link>.
          <Link href={ctaLink} className="button">
            <span data-cms-field="cta_label">{ctaLabel}</span>
          </Link>
        )}
        {/* `variant` is a select → appears in the toolbar dropdown automatically */}
      </div>
    </section>
  );
}
```

With the definition + `mapProps` from the [Anatomy](#anatomy-of-a-component) section,
this component gives you: in-place editing of `headline` and `body`, click-to-replace
on the `image`, in-place editing of the CTA label, the CTA link + style `variant` in
the toolbar — all with zero inline-editing-specific code beyond two `data-cms-field`
hints for the tricky spots.

---

## Inline-editing readiness checklist

Before you call a component done, verify in `?editMode=true`:

- [ ] Every field in `props` is editable somewhere (in place or via the toolbar).
- [ ] Headlines/body text edit **in place** (or are hinted if transformed).
- [ ] The image opens the media selector on click.
- [ ] Selects show in the toolbar with the right options.
- [ ] Product/category fields open their dialogs.
- [ ] Array items each bind to the correct item (use indexed hints).
- [ ] No duplicate-text mis-binds (hint to disambiguate).
- [ ] Production (no `editMode`) output is unchanged — `data-cms-field` is an inert attribute and the binder never mounts outside editor mode.
