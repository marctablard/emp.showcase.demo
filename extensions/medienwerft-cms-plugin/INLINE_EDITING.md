# Inline Editing — CMS-System Agent Guide

Instructions for the **agent working on the Emporix CMS editor**
(`emporix-jas-cms-plugin`). The storefront extension
(`extensions/medienwerft-cms-plugin`) now lets a user edit content **directly
in the preview iframe** — clicking a headline to retype it, picking an option
from an inline dropdown, or clicking an image/product/category to open a
selector. This document defines the wire protocol the storefront emits and the
behavior the CMS must implement to complete the loop.

> The storefront side is already implemented and ships these messages. Your job
> is to **receive** them in the editor and react. No storefront changes are
> required.

---

## Mental model

The CMS is — and stays — the **single source of truth**. The storefront never
mutates its own state for an inline edit. Instead it sends an *intent*; the CMS
updates its in-memory page/layout model and re-broadcasts the affected slot with
the **existing `UPDATE_SLOT` message**. That round-trip ("loopback") is what
actually re-renders the preview.

```
              INLINE_EDIT_COMMIT  / INLINE_EDIT_REQUEST
 Storefront  ───────────────────────────────────────────▶  CMS editor
 (iframe)                                                   (parent window)
     ▲                                                          │
     │                     UPDATE_SLOT (loopback)               │
     └──────────────────────────────────────────────────────────┘
```

This is identical to how the sidebar `PropertyEditor` already works — it mutates
the model and calls `updateSlot(...)`. Inline editing just adds two new *inbound*
triggers for that same mutation path.

---

## The two new inbound messages

Both arrive on the editor's existing `window` `message` listener
(`AbstractLiveEditor.tsx` → `handleIframeMessage`). They are **storefront →
editor**, so add them to `STOREFRONT_MSG` in
`src/lib/editor/postMessageTypes.ts`:

```ts
export const STOREFRONT_MSG = {
  // …existing…
  INLINE_EDIT_COMMIT: 'INLINE_EDIT_COMMIT',
  INLINE_EDIT_REQUEST: 'INLINE_EDIT_REQUEST',
  COMPONENT_SELECTED: 'COMPONENT_SELECTED',
} as const;
```

### 1. `INLINE_EDIT_COMMIT` — value already known

Sent for **text / textarea / url / select** fields, where the storefront
already has the new value (the user typed it, or chose a declared option).

```ts
type InlineEditCommit = {
  type: 'INLINE_EDIT_COMMIT';
  componentId: string;   // matches a component's `id` in the model
  slotId: string;        // slot that component lives in
  fieldPath: string;     // dot-notation path, see "Field paths" below
  fieldType: 'text' | 'textarea' | 'url' | 'select';
  value: unknown;        // the new value (string for these types)
};
```

**Required behavior:**
1. Find the component by `componentId` within `slotId` in the current model.
2. Set `value` at `fieldPath` on that component's `props` (immutably).
3. Re-broadcast the slot via `sendToIframe({ type: IFRAME_MSG.UPDATE_SLOT, slots: [{ slotId, components }] })`.
4. Mark the editor dirty / persist exactly as the sidebar editor does on a prop change.

### 2. `INLINE_EDIT_REQUEST` — open a selector dialog

Sent for **media / product / category** fields, whose value can only be chosen
through one of the editor's own dialogs.

```ts
type InlineEditRequest = {
  type: 'INLINE_EDIT_REQUEST';
  componentId: string;
  slotId: string;
  fieldPath: string;
  fieldType: 'media' | 'product' | 'category';
  allowedTypes?: string[]; // media: e.g. ['image/*']
  multiple?: boolean;      // category (and multi-media)
  currentValue?: unknown;  // preselect / seed the dialog
};
```

**Required behavior:**
1. Select the component + field (same lookup as above). It's good UX to also
   open/scroll the sidebar to that component and flag the active field.
2. Open the **existing** dialog by `fieldType`:
   - `media` → the media selector behind `MediaUploader` (pass `allowedTypes`
     through to its `accept`).
   - `product` → `ProductSearchDialog` (seed `initialQuery`/category from
     `currentValue` if useful).
   - `category` → the category picker used in `PropertyEditor` for
     `type: 'category'` (honor `multiple`).
   These are all already wired in `src/components/fragments/PropertyEditor.tsx`
   — reuse them; do not build new ones.
3. On the user's selection, write the chosen value at `fieldPath` and
   re-broadcast `UPDATE_SLOT` exactly like `INLINE_EDIT_COMMIT` step 3.
4. If the user cancels the dialog, do nothing (no message, no model change).

There is **no dedicated response message** — the change reaches the storefront
purely through the `UPDATE_SLOT` loopback.

### 3. `COMPONENT_SELECTED` — preview click selects in the sidebar

Sent whenever the user clicks **anywhere inside a component** in the preview.
It's the mirror of the editor's own `HIGHLIGHT_COMPONENT` (which goes
editor → storefront): instead of the sidebar driving the preview highlight,
a preview click drives the sidebar selection.

```ts
type ComponentSelected = {
  type: 'COMPONENT_SELECTED';
  componentId: string; // matches a component's `id` in the model; '' = deselect
  slotId: string;      // slot that component lives in; '' = deselect
};
```

**Required behavior (non-empty payload):**
1. Select the component identified by `componentId` (within `slotId`) in the
   editor — exactly as if the user had clicked it in the sidebar tree (open the
   slot, scroll to it, mark it active, open its property panel).
2. Optionally **close the loop**: send `HIGHLIGHT_COMPONENT` back so the preview
   draws its selection ring (the storefront already handles that message). This
   keeps preview and sidebar visually in sync.

**Required behavior (empty payload — `componentId: ''`):** the user clicked
empty preview canvas. Treat it as the clean inverse of selection:
1. Clear the selected component (close its property panel).
2. Collapse all groups (no group stays highlighted).
3. Send `HIGHLIGHT_COMPONENT(null)` so the preview's selection ring clears too.

The storefront emits this for the **innermost** component under the click and
de-dupes consecutive messages (repeat clicks on the same component, or repeat
clicks on empty canvas, are not re-sent), so it's safe to treat every message
as "selection changed to this (or to nothing)".

---

## Field paths

`fieldPath` is dot notation into the component's **raw props** (the same shape
the registry's `props`/`defaultProps` describe — *before* the storefront's
`mapProps` transform). Numeric segments index into arrays:

| Definition                              | Example `fieldPath` |
| --------------------------------------- | ------------------- |
| top-level field                         | `headline`          |
| `type: 'object'` → `properties.cta.label` | `cta.label`         |
| `type: 'array'` of objects              | `items.2.title`     |

Use a small immutable setter (clone along the path, set the leaf). The same path
grammar is produced by the storefront's `flattenEditableFields` /
`getValueAtPath` helpers, so they always agree.

---

## Where to add the handler

In `AbstractLiveEditor.tsx`, inside the `handleIframeMessage` switch (alongside
the existing `COMPONENT_TYPES`, `CATEGORY_TREE_RESPONSE`, `IFRAME_READY` cases):

```ts
else if (event.data.type === STOREFRONT_MSG.INLINE_EDIT_COMMIT) {
  const { componentId, slotId, fieldPath, value } = event.data;
  applyFieldChange(slotId, componentId, fieldPath, value); // updates model + calls updateSlot()
}
else if (event.data.type === STOREFRONT_MSG.INLINE_EDIT_REQUEST) {
  const { componentId, slotId, fieldPath, fieldType, allowedTypes, multiple, currentValue } = event.data;
  openSelectorForField({ slotId, componentId, fieldPath, fieldType, allowedTypes, multiple, currentValue });
  // openSelectorForField resolves to the existing dialog and, on pick,
  // calls the same applyFieldChange(...) path.
}
```

`applyFieldChange` should be the **same** model-mutation + `updateSlot` routine
the sidebar `PropertyEditor.onChange` already funnels into — do not fork a second
write path.

---

## Activation & safety

- Inline editing is **always on whenever the preview runs with `editMode=true`**
  (no enable/disable handshake). The storefront only mounts the affordances in
  editor mode, so production rendering is unaffected.
- Messages use `postMessage(..., '*')` like the rest of the protocol. If you
  enforce an origin/API-key policy, validate it the same way you already do for
  `IFRAME_READY`.
- Treat unknown `fieldType` values defensively (ignore + log) so future field
  types from the storefront degrade gracefully.

---

## Quick test checklist

1. **Text** — click a headline in the preview, retype, click away → editor model
   updates and the preview re-renders the new text via `UPDATE_SLOT`.
2. **Select** — use the inline dropdown on a select-backed field → model updates,
   preview reflects it.
3. **Media** — click an image → media selector opens; on pick the image swaps via
   loopback.
4. **Product / Category** — click the field's toolbar chip → the existing
   product/category dialog opens; on pick the value writes back via loopback.
5. **Cancel** — cancelling any dialog leaves the model untouched.
