import { EmporixLocalizedString, EmporixMedia, EmporixMetadata, EmporixMixins } from './common';
import { EmporixMatchedPrice as EmporixPrice } from './price';

export interface EmporixLabelOverlay {
  isTrue?: boolean;
  position: number;
}

export interface EmporixLabel {
  id: string;
  name: string;
  image?: string;
  cloudinaryUrl?: string;
  mediaId?: string;
  overlay?: EmporixLabelOverlay;
  description: string | EmporixLocalizedString;
  metadata?: EmporixMetadata;
}

/** Product → template reference (`expand=template` returns id/version only). */
export interface EmporixProductTemplateRef {
  id: string;
  version?: string | number;
}

export interface EmporixProductTemplateAttribute {
  key: string;
  name: EmporixLocalizedString;
  type?: string;
  metadata?: {
    mandatory?: boolean;
    variantAttribute?: boolean;
    defaultValue?: string | boolean | number | null;
  };
  values?: Array<{ key: string | number | boolean }>;
}

/** Full product template from `GET /product/{tenant}/product-templates/{id}`. */
export interface EmporixProductTemplateDefinition {
  id: string;
  name: EmporixLocalizedString;
  attributes: EmporixProductTemplateAttribute[];
  metadata?: EmporixMetadata & {
    variantAttributesSchema?: string;
    templateAttributesSchema?: string;
  };
}

/**
 * @deprecated Prefer EmporixProductTemplateRef on products and EmporixProductTemplateDefinition from the templates API.
 * Kept as a union-friendly alias while callers migrate.
 */
export type EmporixProductTemplate = EmporixProductTemplateRef &
  Partial<Pick<EmporixProductTemplateDefinition, 'name' | 'attributes'>>;

export interface EmporixProduct {
  id?: string;
  yrn?: string;
  code: string;
  name: string | EmporixLocalizedString;
  description?: string | EmporixLocalizedString;
  media?: EmporixMedia[];
  productType?: 'BASIC' | 'VARIANT' | 'PARENT_VARIANT';
  parentVariantId?: string;
  parentVariant?: EmporixProduct;
  brandId?: string;
  labelIds?: string[];
  taxClasses?: {
    [key: string]: string;
  };
  mixins?: EmporixMixins;
  published?: boolean;
  metadata?: EmporixMetadata;
  prices?: EmporixPrice[];
  /**
   * Template ref, or expanded definition when `expand=template` is requested.
   * Expanded responses include `attributes[].name` (localized label maps).
   */
  template?: EmporixProductTemplate;
  variantAttributes?: {
    [key: string]: [{ key: string }];
  };
  /** Catalog / navigation root category ids (Product Service). */
  categoryIds?: string[];
}
