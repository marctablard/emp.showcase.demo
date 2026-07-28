import type { EmporixClient } from './emporix';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EntityDefinition {
  id: string;
  name: Record<string, string>;
}

export interface SchemaAttribute {
  key: string;
  name: Record<string, string>;
  description?: Record<string, string>;
  type: string;
  metadata?: Record<string, any>;
  values?: any[];
  attributes?: SchemaAttribute[];
  arrayType?: Record<string, any>;
}

export interface SchemaDefinition {
  id: string;
  name: Record<string, string>;
  attributes: SchemaAttribute[];
  types: string[];
  metadata?: Record<string, any>;
}

export interface EntitySyncResult {
  entityId: string;
  action: 'created' | 'up-to-date' | 'updated' | 'error';
  message: string;
}

export interface SchemaSyncResult {
  schemaId: string;
  action: 'created' | 'up-to-date' | 'updated' | 'error';
  missingAttributes: string[];
  extraAttributes: string[];
  message: string;
}

// ---------------------------------------------------------------------------
// Entity helpers
// ---------------------------------------------------------------------------

export async function syncEntity(
  client: EmporixClient,
  entity: EntityDefinition,
): Promise<EntitySyncResult> {
  const resp = await client.getCustomEntity(entity.id);

  if (resp.status === 404) {
    // Entity does not exist → create
    const createResp = await client.createCustomEntity(entity);
    if (createResp.ok || createResp.status === 201) {
      return { entityId: entity.id, action: 'created', message: 'Created successfully' };
    }
    const errText = await createResp.text();
    return { entityId: entity.id, action: 'error', message: `Create failed (${createResp.status}): ${errText}` };
  }

  if (!resp.ok) {
    const errText = await resp.text();
    return { entityId: entity.id, action: 'error', message: `Check failed (${resp.status}): ${errText}` };
  }

  // Entity exists – compare name fields
  const remote = await resp.json();
  const nameChanged = JSON.stringify(remote.name) !== JSON.stringify(entity.name);

  if (!nameChanged) {
    return { entityId: entity.id, action: 'up-to-date', message: 'Already up-to-date' };
  }

  // Update with new name
  const updateResp = await client.updateCustomEntity(entity.id, entity);
  if (updateResp.ok || updateResp.status === 204) {
    return { entityId: entity.id, action: 'updated', message: 'Name updated' };
  }
  const errText = await updateResp.text();
  return { entityId: entity.id, action: 'error', message: `Update failed (${updateResp.status}): ${errText}` };
}

// ---------------------------------------------------------------------------
// Schema helpers
// ---------------------------------------------------------------------------

function compareAttributes(
  remoteAttrs: SchemaAttribute[],
  expectedAttrs: SchemaAttribute[],
): { missing: string[]; extra: string[] } {
  const remoteKeys = new Set(remoteAttrs.map((a) => a.key));
  const expectedKeys = new Set(expectedAttrs.map((a) => a.key));

  const missing = expectedAttrs
    .filter((a) => !remoteKeys.has(a.key))
    .map((a) => a.key);

  const extra = remoteAttrs
    .filter((a) => !expectedKeys.has(a.key))
    .map((a) => a.key);

  return { missing, extra };
}

function attributesMatch(
  remoteAttrs: SchemaAttribute[],
  expectedAttrs: SchemaAttribute[],
): boolean {
  if (remoteAttrs.length !== expectedAttrs.length) return false;

  const remoteMap = new Map(remoteAttrs.map((a) => [a.key, a]));

  for (const expected of expectedAttrs) {
    const remote = remoteMap.get(expected.key);
    if (!remote) return false;
    if (
      stableStringify(normalizeAttribute(remote)) !==
      stableStringify(normalizeAttribute(expected))
    ) {
      return false;
    }
  }
  return true;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeysRecursively(value));
}

function sortKeysRecursively(value: any): any {
  if (Array.isArray(value)) {
    return value.map(sortKeysRecursively);
  }
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, any>>((acc, key) => {
        acc[key] = sortKeysRecursively(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function normalizeAttribute(attribute: SchemaAttribute): Record<string, any> {
  return {
    key: attribute.key,
    name: attribute.name ?? {},
    description: attribute.description ?? {},
    type: attribute.type,
    metadata: attribute.metadata ?? {},
    values: attribute.values ?? [],
    attributes: (attribute.attributes ?? []).map(normalizeAttribute),
    arrayType: normalizeArrayType(attribute.arrayType),
  };
}

function normalizeArrayType(arrayType?: Record<string, any>): Record<string, any> | undefined {
  if (!arrayType) return undefined;

  return {
    ...arrayType,
    attributes: Array.isArray(arrayType.attributes)
      ? arrayType.attributes.map((attr: SchemaAttribute) => normalizeAttribute(attr))
      : [],
    values: Array.isArray(arrayType.values) ? arrayType.values : [],
  };
}

export async function syncSchema(
  client: EmporixClient,
  schema: SchemaDefinition,
): Promise<SchemaSyncResult> {
  const resp = await client.getSchema(schema.id);

  if (resp.status === 404) {
    // Schema does not exist → create
    const createResp = await client.createSchema(schema);
    if (createResp.ok || createResp.status === 201) {
      return {
        schemaId: schema.id,
        action: 'created',
        missingAttributes: [],
        extraAttributes: [],
        message: `Created with ${schema.attributes.length} attributes`,
      };
    }
    const errText = await createResp.text();
    return {
      schemaId: schema.id,
      action: 'error',
      missingAttributes: [],
      extraAttributes: [],
      message: `Create failed (${createResp.status}): ${errText}`,
    };
  }

  if (!resp.ok) {
    const errText = await resp.text();
    return {
      schemaId: schema.id,
      action: 'error',
      missingAttributes: [],
      extraAttributes: [],
      message: `Check failed (${resp.status}): ${errText}`,
    };
  }

  // Schema exists → compare
  const remote = await resp.json();
  const remoteAttrs: SchemaAttribute[] = remote.attributes ?? [];
  const { missing, extra } = compareAttributes(remoteAttrs, schema.attributes);
  const isMatch = attributesMatch(remoteAttrs, schema.attributes);

  if (isMatch && missing.length === 0 && extra.length === 0) {
    return {
      schemaId: schema.id,
      action: 'up-to-date',
      missingAttributes: [],
      extraAttributes: [],
      message: `All ${schema.attributes.length} attributes match`,
    };
  }

  const buildUpdatePayload = (version: any): SchemaDefinition => ({
    ...schema,
    metadata: {
      ...(schema.metadata ?? {}),
      version,
    },
  });

  const remoteVersion = remote?.metadata?.version;
  if (remoteVersion === undefined || remoteVersion === null) {
    return {
      schemaId: schema.id,
      action: 'error',
      missingAttributes: missing,
      extraAttributes: extra,
      message: 'Update skipped: remote metadata.version is missing',
    };
  }

  // Needs update → PUT with version from remote schema
  let updateResp = await client.updateSchema(schema.id, buildUpdatePayload(remoteVersion));

  // Retry once on version conflict with latest remote version
  if (updateResp.status === 409) {
    const latestResp = await client.getSchema(schema.id);
    if (!latestResp.ok) {
      const errText = await latestResp.text();
      return {
        schemaId: schema.id,
        action: 'error',
        missingAttributes: missing,
        extraAttributes: extra,
        message: `Retry fetch failed (${latestResp.status}): ${errText}`,
      };
    }

    const latestRemote = await latestResp.json();
    const latestVersion = latestRemote?.metadata?.version;
    if (latestVersion === undefined || latestVersion === null) {
      return {
        schemaId: schema.id,
        action: 'error',
        missingAttributes: missing,
        extraAttributes: extra,
        message: 'Retry update skipped: latest remote metadata.version is missing',
      };
    }

    updateResp = await client.updateSchema(schema.id, buildUpdatePayload(latestVersion));
  }

  if (updateResp.ok || updateResp.status === 204) {
    const parts: string[] = [];
    if (missing.length) parts.push(`added: ${missing.join(', ')}`);
    if (extra.length) parts.push(`removed: ${extra.join(', ')}`);
    if (!isMatch && missing.length === 0 && extra.length === 0) parts.push('attribute definitions updated');
    return {
      schemaId: schema.id,
      action: 'updated',
      missingAttributes: missing,
      extraAttributes: extra,
      message: `Updated (${parts.join('; ')})`,
    };
  }

  const errText = await updateResp.text();
  return {
    schemaId: schema.id,
    action: 'error',
    missingAttributes: missing,
    extraAttributes: extra,
    message: `Update failed (${updateResp.status}): ${errText}`,
  };
}
