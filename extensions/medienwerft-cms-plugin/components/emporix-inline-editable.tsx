'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { type EditableField, flattenEditableFields, getValueAtPath } from '../lib/inline-edit-fields';
import { postComponentSelected, postInlineEditCommit, postInlineEditRequest } from '../lib/inline-edit-messaging';
import type { CMSComponentTypeDefinition } from '../types';

interface EmporixInlineEditableProps {
  componentId: string;
  slotId: string;
  /** Raw (un-mapped) component props — the editor's canonical values. */
  props: Record<string, unknown>;
  definition: CMSComponentTypeDefinition;
  /** Whether this component is the one highlighted in the editor sidebar. */
  highlighted: boolean;
  children: React.ReactNode;
}

const STYLE_ELEMENT_ID = 'cms-inline-edit-styles';

// Injected once per document. Uses the same highlight token the rest of the
// editor styling uses, with a hard fallback for previews that don't define it.
const INLINE_EDIT_CSS = `
[data-cms-inline-text] {
  outline: 1px dashed var(--color-cms-highlight, #7c3aed);
  outline-offset: 2px;
  cursor: text;
  border-radius: 2px;
}
[data-cms-inline-text]:hover { outline-style: solid; }
[data-cms-inline-text]:focus {
  outline: 2px solid var(--color-cms-highlight, #7c3aed);
  background: color-mix(in srgb, var(--color-cms-highlight, #7c3aed) 8%, transparent);
}
[data-cms-inline-media] {
  outline: 1px dashed var(--color-cms-highlight, #7c3aed);
  outline-offset: 2px;
  cursor: pointer;
}
[data-cms-inline-media]:hover { outline-style: solid; }
[data-cms-inline-link]:hover {
  outline: 1px dashed var(--color-cms-highlight, #7c3aed);
  outline-offset: 2px;
}
`;

function ensureStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ELEMENT_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = INLINE_EDIT_CSS;
  document.head.appendChild(style);
}

/**
 * Editor chrome the binder injects (toolbar, link affordance, popup). Anchoring
 * skips these so they're never mistaken for content, and the click guard lets
 * their controls work normally.
 */
function isInsideEditorUi(el: Element | null): boolean {
  return !!el?.closest('[data-cms-inline-toolbar], [data-cms-inline-ui]');
}

// === Editor-mode click guard ===
//
// In the preview every link/button is live, so clicking a CTA label to edit
// its text would navigate or fire the button's action. While editing we
// neutralize those default actions with a single capture-phase listener. Our
// own affordances are exempt: the toolbar/link UI handle their own controls,
// and media/product/category anchors run their own capture handler (which
// already calls preventDefault), so we bow out for them and let that win.
const ACTIONABLE_SELECTOR = 'a[href], button, [role="button"], input[type="submit"], input[type="button"], summary';

// Last component reported to the editor, to avoid re-posting on repeat clicks.
let lastSelectedComponentId: string | null = null;

function onGuardedClick(e: MouseEvent) {
  const target = e.target as Element | null;
  if (!target) return;

  // A click inside a component selects it in the editor sidebar (mirror of the
  // editor's HIGHLIGHT_COMPONENT); a click on empty canvas clears the selection
  // (empty payload). Runs before the action-suppression below so it fires even
  // when the click lands on a link/button. Clicks on our own editor UI
  // (toolbar / link popup) are ignored so editing a field never deselects.
  if (!isInsideEditorUi(target)) {
    const componentEl = target.closest<HTMLElement>('[data-component-id]');
    const componentId = componentEl?.getAttribute('data-component-id') ?? '';
    if (componentId) {
      if (componentId !== lastSelectedComponentId) {
        lastSelectedComponentId = componentId;
        const slotId = componentEl?.closest<HTMLElement>('[data-slot]')?.getAttribute('data-slot') ?? '';
        postComponentSelected({ componentId, slotId });
      }
    } else if (lastSelectedComponentId !== null) {
      // Empty preview canvas → deselect (clean inverse, same message type).
      lastSelectedComponentId = null;
      postComponentSelected({ componentId: '', slotId: '' });
    }
  }

  if (isInsideEditorUi(target)) return;
  if (target.closest('[data-cms-inline-media]')) return;
  if (target.closest(ACTIONABLE_SELECTOR)) {
    // Caret placement for editable text already happened on mousedown, so
    // suppressing the click is safe — it only stops navigation / handlers.
    e.preventDefault();
    e.stopPropagation();
  }
}

let clickGuardCount = 0;

function installClickGuard(): () => void {
  if (typeof document === 'undefined') return () => {};
  clickGuardCount += 1;
  if (clickGuardCount === 1) {
    document.addEventListener('click', onGuardedClick, true);
  }
  return () => {
    clickGuardCount = Math.max(0, clickGuardCount - 1);
    if (clickGuardCount === 0) {
      document.removeEventListener('click', onGuardedClick, true);
      lastSelectedComponentId = null;
    }
  };
}

/** Find the element directly wrapping a text node equal to `value`. */
function findTextAnchor(container: HTMLElement, value: string, claimed: Set<Element>): HTMLElement | null {
  const target = value.trim();
  if (!target) return null;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || node.nodeValue.trim() !== target) return NodeFilter.FILTER_SKIP;
      const parent = node.parentElement;
      if (!parent || isInsideEditorUi(parent) || claimed.has(parent)) return NodeFilter.FILTER_SKIP;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const node = walker.nextNode();
  return node ? node.parentElement : null;
}

/** Find an `<img>` whose src corresponds to a media field's filename/url. */
function findMediaAnchor(container: HTMLElement, value: unknown, claimed: Set<Element>): HTMLElement | null {
  const filename =
    typeof value === 'string'
      ? value
      : value && typeof value === 'object'
        ? String((value as { filename?: string }).filename ?? '')
        : '';
  if (!filename) return null;
  const imgs = Array.from(container.querySelectorAll('img'));
  for (const img of imgs) {
    if (isInsideEditorUi(img) || claimed.has(img)) continue;
    const src = img.getAttribute('src') ?? '';
    // Next.js may rewrite to `/_next/image?url=<encoded>&...`.
    if (src.includes(filename) || src.includes(encodeURIComponent(filename))) return img;
  }
  return null;
}

/**
 * Find the `<a>` (or any `[href]`) that renders a `url` field's value. Matches
 * tolerantly: exact raw href, or pathname endsWith (covers locale-prefixed /
 * absolute hrefs that Next.js' Link may emit, e.g. `/en/services` for `/services`).
 */
function findHrefAnchor(container: HTMLElement, value: string, claimed: Set<Element>): HTMLElement | null {
  const target = value.trim();
  if (!target) return null;
  const anchors = Array.from(container.querySelectorAll<HTMLElement>('a[href], [href]'));
  for (const a of anchors) {
    if (isInsideEditorUi(a) || claimed.has(a)) continue;
    const raw = a.getAttribute('href') ?? '';
    if (raw === target) return a;
    if (target.startsWith('/')) {
      const pathname = a instanceof HTMLAnchorElement ? a.pathname : '';
      if (pathname && (pathname === target || pathname.endsWith(target))) return a;
    }
    if (raw && raw.endsWith(target)) return a;
  }
  return null;
}

/** Look up the explicit `data-cms-field` hint element for a path, if any. */
function findHint(container: HTMLElement, path: string): HTMLElement | null {
  if (typeof CSS === 'undefined' || !CSS.escape) return null;
  const hint = container.querySelector<HTMLElement>(`[data-cms-field="${CSS.escape(path)}"]`);
  return hint && !isInsideEditorUi(hint) ? hint : null;
}

function resolveAnchor(container: HTMLElement, field: EditableField, claimed: Set<Element>): HTMLElement | null {
  // Explicit author hint wins — but never for `select`: it's always edited via
  // the toolbar dropdown, and an in-place contentEditable anchor would corrupt
  // its value. (`media`/`product`/`category` hints are honored: the click opens
  // the editor's dialog.)
  if (field.type !== 'select') {
    const hint = findHint(container, field.path);
    if (hint && !claimed.has(hint)) return hint;
  }
  if (field.type === 'media') return findMediaAnchor(container, field.value, claimed);
  if (field.type === 'text' || field.type === 'textarea') {
    return typeof field.value === 'string' ? findTextAnchor(container, field.value, claimed) : null;
  }
  return null;
}

function rectWithin(
  container: HTMLElement,
  el: HTMLElement,
): { top: number; left: number; width: number; height: number } {
  const c = container.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { top: Math.max(0, r.top - c.top), left: Math.max(0, r.left - c.left), width: r.width, height: r.height };
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

type LinkTarget = { field: EditableField; top: number; left: number; width: number; height: number };

const LINK_ICON_SIZE = 22;

/**
 * Generic inline-editing wrapper. Mounted by the renderer **only in editor
 * mode**, once per component instance. It introspects the component's field
 * schema, binds editable affordances to the rendered DOM, and surfaces any
 * field it couldn't anchor (selects, product/category refs, transformed
 * values) in a small per-component toolbar.
 *
 * `url` fields are special-cased: rather than a chip, they bind to the rendered
 * `<a>` (matched by href) and show a floating link button on hover that opens a
 * small URL popup — keeping the overlay free of link clutter.
 *
 * It never mutates storefront state itself: text/select edits post
 * `INLINE_EDIT_COMMIT`, media/product/category clicks post
 * `INLINE_EDIT_REQUEST`, and the editor loops the result back via `UPDATE_SLOT`.
 */
export default function EmporixInlineEditable({
  componentId,
  slotId,
  props,
  definition,
  highlighted,
  children,
}: EmporixInlineEditableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [toolbarPaths, setToolbarPaths] = useState<string[]>([]);
  // Floating link button currently shown on hover, and the open URL popup.
  const [linkHover, setLinkHover] = useState<LinkTarget | null>(null);
  const [linkEditor, setLinkEditor] = useState<LinkTarget | null>(null);
  // The url-anchor currently driving `linkHover`, to avoid redundant updates.
  const hoverAnchorRef = useRef<HTMLElement | null>(null);

  // Serialize props so the binding pass re-runs after an UPDATE_SLOT loopback
  // (which replaces props with fresh objects) without depending on identity.
  const propsKey = useMemo(() => JSON.stringify(props ?? {}), [props]);
  // `propsKey` is the deep-equality signal for `props`; depending on `props`
  // directly would be redundant and noisier.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fields = useMemo(() => flattenEditableFields(definition, props), [definition, propsKey]);

  const commit = (field: EditableField, value: unknown) => {
    postInlineEditCommit({ componentId, slotId, fieldPath: field.path, fieldType: field.type, value });
  };

  const requestDialog = (field: EditableField) => {
    postInlineEditRequest({
      componentId,
      slotId,
      fieldPath: field.path,
      fieldType: field.type as 'media' | 'product' | 'category',
      ...(field.allowedTypes ? { allowedTypes: field.allowedTypes } : {}),
      ...(field.multiple ? { multiple: true } : {}),
      currentValue: field.value,
    });
  };

  // Suppress live navigation / button actions in the preview while editing.
  // Refcounted so all mounted binders share one document listener.
  useEffect(() => installClickGuard(), []);

  useEffect(() => {
    ensureStyles();
    const container = containerRef.current;
    if (!container) return;

    const cleanups: Array<() => void> = [];
    const claimed = new Set<Element>();
    const linkClaimed = new Set<Element>();
    // Map of url-anchor element → its field, resolved by a single container
    // mousemove (below) rather than per-anchor enter/leave + a hide timer.
    // That makes hover deterministic: no boundary race between the anchor and
    // the floating icon, so the cursor never flickers.
    const linkMap = new Map<HTMLElement, EditableField>();

    const toolbar: string[] = [];

    for (const field of fields) {
      // --- url → bind to its <a>, show a hover link affordance (no chip) ---
      if (field.type === 'url') {
        const anchor =
          findHint(container, field.path) ?? findHrefAnchor(container, String(field.value ?? ''), linkClaimed);
        if (!anchor) {
          toolbar.push(field.path);
          continue;
        }
        linkClaimed.add(anchor);
        anchor.setAttribute('data-cms-inline-link', '');
        linkMap.set(anchor, field);
        cleanups.push(() => anchor.removeAttribute('data-cms-inline-link'));
        continue;
      }

      const anchor = resolveAnchor(container, field, claimed);
      if (!anchor) {
        toolbar.push(field.path);
        continue;
      }
      claimed.add(anchor);

      if (field.type === 'media' || field.type === 'product' || field.type === 'category') {
        anchor.setAttribute('data-cms-inline-media', '');
        const onClick = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          if (field.type === 'media' || field.type === 'product' || field.type === 'category') {
            requestDialog(field);
          }
        };
        anchor.addEventListener('click', onClick, true);
        cleanups.push(() => {
          anchor.removeAttribute('data-cms-inline-media');
          anchor.removeEventListener('click', onClick, true);
        });
        continue;
      }

      // text / textarea → edit in place.
      anchor.setAttribute('data-cms-inline-text', '');
      anchor.setAttribute('contenteditable', 'true');
      anchor.setAttribute('spellcheck', 'false');
      let original = anchor.textContent ?? '';
      const onFocus = () => {
        original = anchor.textContent ?? '';
      };
      const onBlur = () => {
        const next = anchor.textContent ?? '';
        if (next !== original) commit(field, next);
      };
      const onKeyDown = (e: Event) => {
        const ke = e as KeyboardEvent;
        // Single-line fields commit on Enter; textarea keeps newlines.
        if (ke.key === 'Enter' && field.type !== 'textarea') {
          ke.preventDefault();
          (anchor as HTMLElement).blur();
        }
      };
      anchor.addEventListener('focus', onFocus);
      anchor.addEventListener('blur', onBlur);
      anchor.addEventListener('keydown', onKeyDown);
      cleanups.push(() => {
        anchor.removeAttribute('data-cms-inline-text');
        anchor.removeAttribute('contenteditable');
        anchor.removeAttribute('spellcheck');
        anchor.removeEventListener('focus', onFocus);
        anchor.removeEventListener('blur', onBlur);
        anchor.removeEventListener('keydown', onKeyDown);
      });
    }

    // Deterministic hover resolution for url anchors. Treats the floating icon
    // / popup (`data-cms-inline-ui`) as "still hovering", so moving from the
    // link onto the icon keeps it open without any timer or flicker.
    if (linkMap.size > 0) {
      const onMove = (e: MouseEvent) => {
        const target = e.target as Element | null;
        if (!target) return;
        if (target.closest('[data-cms-inline-ui]')) return; // over the icon/popup → keep
        const anchor = target.closest<HTMLElement>('[data-cms-inline-link]');
        if (anchor === hoverAnchorRef.current) return; // no change → no re-render
        hoverAnchorRef.current = anchor;
        const field = anchor ? linkMap.get(anchor) : undefined;
        if (anchor && field) {
          setLinkHover({ field, ...rectWithin(container, anchor) });
        } else {
          setLinkHover(null);
        }
      };
      const onLeaveContainer = () => {
        hoverAnchorRef.current = null;
        setLinkHover(null);
      };
      container.addEventListener('mousemove', onMove);
      container.addEventListener('mouseleave', onLeaveContainer);
      cleanups.push(() => {
        container.removeEventListener('mousemove', onMove);
        container.removeEventListener('mouseleave', onLeaveContainer);
      });
    }

    setToolbarPaths((prev) => (arraysEqual(prev, toolbar) ? prev : toolbar));
    hoverAnchorRef.current = null;
    setLinkHover(null);

    return () => {
      for (const fn of cleanups) fn();
    };
    // `fields` is derived from definition+propsKey; commit/request close over
    // stable ids. Re-run whenever the field set or component identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, componentId, slotId]);

  const toolbarFields = useMemo(() => fields.filter((f) => toolbarPaths.includes(f.path)), [fields, toolbarPaths]);

  const openLinkEditor = (target: LinkTarget) => {
    hoverAnchorRef.current = null;
    setLinkHover(null);
    setLinkEditor(target);
  };

  return (
    <div
      ref={containerRef}
      data-component-id={componentId}
      className={cn('relative', highlighted && 'ring-2 ring-offset-2 [--tw-ring-color:var(--color-cms-highlight)]')}
    >
      {children}

      {/* Floating link button shown while hovering a url-bound <a>. */}
      {linkHover && !linkEditor && (
        <button
          type="button"
          data-cms-inline-ui=""
          title={`Edit ${linkHover.field.label}`}
          onClick={() => openLinkEditor(linkHover)}
          style={{
            position: 'absolute',
            // Inside the anchor (right edge, vertically centered) so the icon
            // overlaps it — no gap to cross, so it stays reachable on hover.
            top: Math.max(0, linkHover.top + (linkHover.height - LINK_ICON_SIZE) / 2),
            left: Math.max(0, linkHover.left + linkHover.width - LINK_ICON_SIZE - 2),
            zIndex: 60,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: LINK_ICON_SIZE,
            height: LINK_ICON_SIZE,
            padding: 0,
            borderRadius: LINK_ICON_SIZE / 2,
            border: '1px solid rgba(255,255,255,0.3)',
            background: 'var(--color-cms-highlight, #7c3aed)',
            color: '#fff',
            cursor: 'pointer',
            boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
          }}
        >
          <LinkIcon />
        </button>
      )}

      {/* URL popup. */}
      {linkEditor && (
        <UrlPopup
          target={linkEditor}
          initialValue={String(getValueAtPath(props, linkEditor.field.path) ?? '')}
          onCancel={() => setLinkEditor(null)}
          onSave={(value) => {
            commit(linkEditor.field, value);
            setLinkEditor(null);
          }}
        />
      )}

      {toolbarFields.length > 0 && (
        <InlineEditToolbar fields={toolbarFields} props={props} onCommit={commit} onRequest={requestDialog} />
      )}
    </div>
  );
}

function LinkIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function UrlPopup({
  target,
  initialValue,
  onCancel,
  onSave,
}: {
  target: LinkTarget;
  initialValue: string;
  onCancel: () => void;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState(target.left);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Keep the popup inside the component bounds — a link near the right edge
  // would otherwise push it off-screen. Clamp once the real width is known.
  useLayoutEffect(() => {
    const el = popupRef.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (!el || !parent) return;
    const maxLeft = parent.clientWidth - el.offsetWidth - 8;
    const next = Math.max(8, Math.min(target.left, maxLeft));
    setLeft((prev) => (prev === next ? prev : next));
  }, [target.left]);

  return (
    <div
      ref={popupRef}
      data-cms-inline-ui=""
      style={{
        position: 'absolute',
        top: target.top + target.height + 4,
        left,
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: 6,
        borderRadius: 6,
        background: 'rgba(17,17,17,0.92)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      }}
    >
      <span style={{ color: '#fff', opacity: 0.7 }}>
        <LinkIcon />
      </span>
      <input
        ref={inputRef}
        type="url"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave(value);
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="/path or https://…"
        style={{
          font: '12px/1.4 system-ui, sans-serif',
          color: '#111',
          background: '#fff',
          borderRadius: 3,
          border: '1px solid rgba(0,0,0,0.2)',
          padding: '3px 6px',
          width: 220,
        }}
      />
      <button
        type="button"
        onClick={() => onSave(value)}
        style={{
          font: '12px/1.4 system-ui, sans-serif',
          color: '#fff',
          background: 'var(--color-cms-highlight, #7c3aed)',
          border: 'none',
          borderRadius: 3,
          padding: '3px 8px',
          cursor: 'pointer',
        }}
      >
        Save
      </button>
    </div>
  );
}

interface InlineEditToolbarProps {
  fields: EditableField[];
  props: Record<string, unknown>;
  onCommit: (field: EditableField, value: unknown) => void;
  onRequest: (field: EditableField) => void;
}

/**
 * Fallback affordance for fields with no stable DOM anchor (selects, product /
 * category references, and any text/media value that wasn't found in the
 * rendered output). Collapsed behind a small button so it doesn't obstruct the
 * preview; clicking the button reveals the chip panel.
 */
function InlineEditToolbar({ fields, props, onCommit, onRequest }: InlineEditToolbarProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      data-cms-inline-toolbar=""
      style={{
        position: 'absolute',
        top: 4,
        right: 4,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 4,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={open ? 'Hide fields' : `Edit ${fields.length} field${fields.length === 1 ? '' : 's'}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          height: 24,
          padding: '0 8px',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.3)',
          background: open ? 'var(--color-cms-highlight, #7c3aed)' : 'rgba(17,17,17,0.82)',
          color: '#fff',
          font: '11px/1 system-ui, sans-serif',
          cursor: 'pointer',
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }}
      >
        {open ? <CloseIcon /> : <FieldsIcon />}
        {!open && <span>{fields.length}</span>}
      </button>

      {open && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            gap: 4,
            maxWidth: 320,
            padding: 6,
            borderRadius: 6,
            background: 'rgba(17, 17, 17, 0.92)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}
        >
          {fields.map((field) => (
            <InlineEditChip key={field.path} field={field} props={props} onCommit={onCommit} onRequest={onRequest} />
          ))}
        </div>
      )}
    </div>
  );
}

function FieldsIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

const chipBaseStyle: React.CSSProperties = {
  font: '11px/1.4 system-ui, sans-serif',
  color: '#fff',
  background: 'rgba(255,255,255,0.12)',
  border: '1px solid rgba(255,255,255,0.25)',
  borderRadius: 4,
  padding: '2px 6px',
  cursor: 'pointer',
  maxWidth: 180,
};

function InlineEditChip({
  field,
  props,
  onCommit,
  onRequest,
}: {
  field: EditableField;
  props: Record<string, unknown>;
  onCommit: (field: EditableField, value: unknown) => void;
  onRequest: (field: EditableField) => void;
}) {
  const current = getValueAtPath(props, field.path);

  if (field.type === 'select') {
    return (
      <label style={{ ...chipBaseStyle, cursor: 'default', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span style={{ opacity: 0.75, lineHeight: 1, alignSelf: 'center' }}>{field.label}</span>
        <select
          value={typeof current === 'string' ? current : ''}
          onChange={(e) => onCommit(field, e.target.value)}
          style={{
            font: 'inherit',
            color: '#111',
            background: '#fff',
            border: 'none',
            borderRadius: 3,
            padding: '2px 4px',
            margin: 0,
          }}
        >
          {(field.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === 'media' || field.type === 'product' || field.type === 'category') {
    return (
      <button type="button" style={chipBaseStyle} onClick={() => onRequest(field)} title={`Edit ${field.label}`}>
        ✎ {field.label}
      </button>
    );
  }

  // Unanchored text / url — edit through a popover-less inline input.
  return (
    <label style={{ ...chipBaseStyle, cursor: 'default', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ opacity: 0.75, lineHeight: 1, alignSelf: 'center' }}>{field.label}</span>
      <input
        type={field.type === 'url' ? 'url' : 'text'}
        defaultValue={typeof current === 'string' ? current : ''}
        onBlur={(e) => {
          if (e.target.value !== (typeof current === 'string' ? current : '')) onCommit(field, e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        style={{ font: 'inherit', color: '#111', background: '#fff', borderRadius: 3, padding: '1px 4px', width: 120 }}
      />
    </label>
  );
}
