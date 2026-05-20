import type { CMSComponentEntry, CMSComponentTypeDefinition, CMSFieldType, CMSPropDefinition } from '../types';

/**
 * Wire format consumed by the Emporix CMS MCP server's
 * `list_component_types` tool (see `mcp-server/src/tools/schemas.ts` in
 * `emporix-jas-cms-plugin`).
 *
 * It is intentionally **not** identical to the in-plugin
 * {@link CMSComponentTypeDefinition} shape:
 *
 *  - `allowedTypes` covers BOTH `component` and `media` props (the
 *    plugin distinguishes `allowedComponentTypes` from `allowedTypes`).
 *  - `$ref` references are pre-resolved against `fieldDefinitions` so
 *    the consumer never has to look anything up.
 *  - Plugin-only keys (`dynamicOptionsSource`) are stripped.
 *
 * The serializer below performs that translation. Keeping the wire
 * format in its own module lets the route handler stay tiny and lets us
 * unit-test the shape conversion without booting a Next request.
 */

export type ComponentRegistryPropType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'color'
  | 'url'
  | 'media'
  | 'select'
  | 'object'
  | 'array'
  | 'component'
  | 'category'
  | 'product';

export interface ComponentRegistryPropDefinition {
  label: string;
  type: ComponentRegistryPropType;
  required?: boolean;
  defaultValue?: unknown;
  options?: { label: string; value: string }[];
  properties?: Record<string, ComponentRegistryPropDefinition>;
  items?: ComponentRegistryPropDefinition;
  allowedTypes?: string[];
  multiple?: boolean;
}

export interface ComponentRegistryTypeDefinition {
  type: string;
  label: string;
  description?: string;
  props?: Record<string, ComponentRegistryPropDefinition>;
  defaultProps?: Record<string, unknown>;
  allowedComponents?: string[];
}

export interface ComponentRegistryResponse {
  $schema: 'https://emporix.io/cms/component-registry/v1';
  components: Record<string, ComponentRegistryTypeDefinition>;
}

const COMPONENT_REGISTRY_SCHEMA = 'https://emporix.io/cms/component-registry/v1' as const;

const SUPPORTED_PROP_TYPES = new Set<CMSFieldType>([
  'text',
  'textarea',
  'number',
  'boolean',
  'color',
  'url',
  'media',
  'select',
  'object',
  'array',
  'component',
  'category',
  'product',
]);

/**
 * Translate a single in-plugin `CMSPropDefinition` to the wire shape.
 *
 * `fieldDefinitions` is the lookup table for `$ref` resolution. When a
 * prop carries `$ref`, its own keys override the referenced base — this
 * matches the storefront's existing $ref semantics (the prop layer
 * specialises label / type / required on top of the shared base).
 */
function serializeProp(
  prop: CMSPropDefinition,
  fieldDefinitions: Record<string, CMSPropDefinition> | undefined,
): ComponentRegistryPropDefinition {
  const resolved: CMSPropDefinition =
    prop.$ref && fieldDefinitions?.[prop.$ref] ? { ...fieldDefinitions[prop.$ref], ...prop, $ref: undefined } : prop;

  const type = SUPPORTED_PROP_TYPES.has(resolved.type) ? resolved.type : ('text' as const);

  const out: ComponentRegistryPropDefinition = {
    label: resolved.label,
    type: type as ComponentRegistryPropType,
  };

  if (resolved.required) out.required = true;
  if (resolved.defaultValue !== undefined) out.defaultValue = resolved.defaultValue;
  if (resolved.options) out.options = resolved.options;
  if (resolved.multiple) out.multiple = true;

  if (resolved.properties) {
    out.properties = Object.fromEntries(
      Object.entries(resolved.properties).map(([key, child]) => [key, serializeProp(child, fieldDefinitions)]),
    );
  }
  if (resolved.items) {
    out.items = serializeProp(resolved.items, fieldDefinitions);
  }

  // The wire format collapses media's `allowedTypes` and component's
  // `allowedComponentTypes` onto a single `allowedTypes` key.
  if (resolved.type === 'component') {
    if (resolved.allowedComponentTypes && resolved.allowedComponentTypes.length > 0) {
      out.allowedTypes = resolved.allowedComponentTypes;
    }
  } else if (resolved.type === 'media') {
    if (resolved.allowedTypes && resolved.allowedTypes.length > 0) {
      out.allowedTypes = resolved.allowedTypes;
    }
  }

  return out;
}

/**
 * Translate a {@link CMSComponentTypeDefinition} into the wire-format
 * `ComponentRegistryTypeDefinition`. Drops `fieldDefinitions` (resolved
 * inline above) and the renderer-only `mapProps` / `component` fields
 * (those belong on {@link CMSComponentEntry}, not the definition).
 */
export function serializeComponentDefinition(definition: CMSComponentTypeDefinition): ComponentRegistryTypeDefinition {
  const props = definition.props
    ? Object.fromEntries(
        Object.entries(definition.props).map(([key, prop]) => [key, serializeProp(prop, definition.fieldDefinitions)]),
      )
    : undefined;

  const out: ComponentRegistryTypeDefinition = {
    type: definition.type,
    label: definition.label,
  };
  if (definition.description) out.description = definition.description;
  if (props) out.props = props;
  if (definition.defaultProps) out.defaultProps = definition.defaultProps;
  if (definition.allowedComponents) out.allowedComponents = definition.allowedComponents;
  return out;
}

/**
 * Build the full registry response body from a list of component
 * entries. The caller is responsible for resolving the entries from
 * the {@link CMSComponentService} (which lets the route handler accept
 * an optional `theme` query param without this module knowing about DI).
 */
export function buildComponentRegistryResponse(entries: CMSComponentEntry[]): ComponentRegistryResponse {
  const components: Record<string, ComponentRegistryTypeDefinition> = {};
  for (const entry of entries) {
    components[entry.definition.type] = serializeComponentDefinition(entry.definition);
  }
  return {
    $schema: COMPONENT_REGISTRY_SCHEMA,
    components,
  };
}
