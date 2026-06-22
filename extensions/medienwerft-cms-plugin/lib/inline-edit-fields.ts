import type { CMSComponentTypeDefinition, CMSFieldType, CMSPropDefinition } from '../types';

/**
 * A single editable leaf discovered on a component instance. The inline-edit
 * binder uses these to decide what affordance to attach to which value:
 *
 *  - `text` / `textarea` / `url`  → edit in place (contentEditable),
 *  - `select`                     → inline dropdown of `options`,
 *  - `media` / `product` / `category` → ask the editor to open its dialog.
 *
 * Container types (`object`, `array`) are not editable themselves; they are
 * walked so their leaves surface with a fully-qualified `path`.
 */
export interface EditableField {
  /** Dot-notation path into the raw component props, e.g. `items.0.title`. */
  path: string;
  /** Resolved leaf field type. */
  type: Extract<CMSFieldType, 'text' | 'textarea' | 'url' | 'select' | 'media' | 'product' | 'category'>;
  /** Human label from the prop definition. */
  label: string;
  /** Current value resolved from the raw component props (may be undefined). */
  value: unknown;
  /** For `select`: the declared options. */
  options?: { label: string; value: string }[];
  /** For `media`: allowed MIME types. */
  allowedTypes?: string[];
  /** For `category` (and multi-media): whether multiple values are allowed. */
  multiple?: boolean;
}

const INLINE_EDITABLE_TYPES = new Set<CMSFieldType>([
  'text',
  'textarea',
  'url',
  'select',
  'media',
  'product',
  'category',
]);

/**
 * Resolve a `$ref` against the component's `fieldDefinitions`. The prop's own
 * keys override the referenced base — same semantics the registry serializer
 * uses (the prop layer specialises label / type on top of the shared base).
 */
function resolveProp(
  prop: CMSPropDefinition,
  fieldDefinitions: Record<string, CMSPropDefinition> | undefined,
): CMSPropDefinition {
  if (prop.$ref && fieldDefinitions?.[prop.$ref]) {
    return { ...fieldDefinitions[prop.$ref], ...prop, $ref: undefined };
  }
  return prop;
}

function walk(
  key: string,
  rawProp: CMSPropDefinition,
  value: unknown,
  parentPath: string,
  fieldDefinitions: Record<string, CMSPropDefinition> | undefined,
  out: EditableField[],
): void {
  const prop = resolveProp(rawProp, fieldDefinitions);
  const path = parentPath ? `${parentPath}.${key}` : key;

  if (prop.type === 'object' && prop.properties) {
    const obj = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
    for (const [childKey, childProp] of Object.entries(prop.properties)) {
      walk(childKey, childProp, obj[childKey], path, fieldDefinitions, out);
    }
    return;
  }

  if (prop.type === 'array' && prop.items) {
    // Drive the index range from the actual values so paths line up with the
    // editor's model (`items.0`, `items.1`, …).
    const arr = Array.isArray(value) ? value : [];
    arr.forEach((itemValue, index) => {
      walk(String(index), prop.items as CMSPropDefinition, itemValue, path, fieldDefinitions, out);
    });
    return;
  }

  if (!INLINE_EDITABLE_TYPES.has(prop.type)) return;

  out.push({
    path,
    type: prop.type as EditableField['type'],
    label: prop.label,
    value,
    ...(prop.options ? { options: prop.options } : {}),
    ...(prop.allowedTypes ? { allowedTypes: prop.allowedTypes } : {}),
    ...(prop.multiple ? { multiple: true } : {}),
  });
}

/**
 * Flatten a component definition + its raw props into the list of inline-
 * editable leaves. Returns `[]` when the definition declares no `props`
 * schema (nothing to bind), so the binder can no-op cleanly.
 */
export function flattenEditableFields(
  definition: CMSComponentTypeDefinition | undefined,
  props: Record<string, unknown> | undefined,
): EditableField[] {
  if (!definition?.props) return [];
  const out: EditableField[] = [];
  const values = props ?? {};
  for (const [key, prop] of Object.entries(definition.props)) {
    walk(key, prop, values[key], '', definition.fieldDefinitions, out);
  }
  return out;
}

/**
 * Read a dot-notation `path` (numeric segments index into arrays) out of a
 * raw props object. Used by the binder to re-read a field's current value.
 */
export function getValueAtPath(props: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, segment) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[segment];
  }, props);
}
