import type { EmporixMetadata, EmporixMixins, LocalizedString } from './common';

/**
 * Custom instance response
 */
export interface EmporixCustomEntity {
  id?: string;
  name?: LocalizedString;
  type: string;
  mixins?: EmporixMixins;
  metadata?: EmporixMetadata;
}

/**
 * Patch operation for custom instance
 */
export interface EmporixPatchOperation {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  value?: any;
  from?: string;
}

/**
 * Bulk response item
 */
export interface EmporixBulkResponseItem {
  index: number;
  code: number;
  status: string;
  message?: string;
}

/**
 * Schema attribute value
 */
export interface SchemaAttributeValue {
  value: string;
  name?: LocalizedString;
}

/**
 * Schema attribute array type
 */
export interface SchemaAttributeArrayType {
  type: string;
  localized?: boolean;
  values?: SchemaAttributeValue[];
}

/**
 * Schema attribute
 */
export interface SchemaAttribute {
  key: string;
  name: LocalizedString;
  description?: LocalizedString;
  type: string;
  metadata?: Record<string, any>;
  values?: SchemaAttributeValue[];
  arrayType?: SchemaAttributeArrayType;
  attributes?: SchemaAttribute[];
}

/**
 * Schema metadata
 */
export interface SchemaMetadata extends EmporixMetadata {
  version: number;
}

/**
 * Schema response
 */
export interface EmporixSchema {
  id: string;
  name: LocalizedString;
  types: string[];
  attributes: SchemaAttribute[];
  metadata: SchemaMetadata;
}
