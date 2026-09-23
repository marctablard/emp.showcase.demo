import { EmporixMixin } from '@/platform/integrations/emporix/model';
import { Category } from '../category';
import { Availability, LocalizedString, Media, Price, TaxType } from '../common';

export interface ProductLabel {
  id: string;
  name?: string;
  image?: string;
  description?: string | LocalizedString;
  overlay?: {
    isTrue?: boolean;
    position: number;
  };
}

export interface ProductSpecification {
  key: string;
  group?: string;
  groupLabel?: LocalizedString;
  label: LocalizedString;
  value: LocalizedString;
  unit?: LocalizedString;
  highlight?: boolean;
}

export interface GroupedSpecification {
  groupName: string | LocalizedString;
  item: Array<{
    label: string | LocalizedString;
    value: string | LocalizedString;
    unit: string | LocalizedString;
    /** Template attribute key when the row comes from `product.templateAttributes`. */
    attributeKey?: string;
  }>;
}

export interface ProductDocument {
  title: LocalizedString;
  description: LocalizedString;
  url: string;
  mime: string;
  group: string;
  groupLabel: LocalizedString;
}

export interface ProductUSP {
  icon: string;
  description: LocalizedString;
}

export interface ProductVariantAttribute {
  key: string;
  name?: string | LocalizedString;
  values: { key: string; name?: string | LocalizedString; unit?: string; selected: boolean }[];
}

/** Emporix product-template attribute `type` values. */
export type ProductTemplateAttributeType = 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'DATETIME';

export interface Product {
  id: string;
  name: string | LocalizedString;
  description: string | LocalizedString;
  sku?: string;
  brand?: {
    id: string;
    name?: string | LocalizedString;
    logo?: Media;
  };
  isParentVariant?: boolean;
  variantCount?: number;
  parentVariantId?: string;
  productType?: 'BASIC' | 'VARIANT' | 'PARENT_VARIANT' | 'DYNAMIC_VARIANT';
  sellable?: boolean;
  /** Direct parent at index 0, root at the last index. Empty on root-level products. */
  parentVariantPath?: string[];
  dynamicVariantType?: string;
  primaryCategory?: Category;
  categories?: Category[];
  labels?: ProductLabel[];
  price?: ProductPrice;
  availability?: StockAvailability;
  primaryImage?: Media;
  images?: Media[];
  taxType?: TaxType;
  usp?: string | LocalizedString;
  highlights?: { [locale: string]: string[] };
  documents?: Media[];
  // Additional fields from mixins
  specifications?: ProductSpecification[];
  groupedSpecifications?: GroupedSpecification[];
  usps?: ProductUSP[];
  purchasable: boolean;
  variants?: Product[];
  /** Product template reference (`template.id` / `template.version` from Emporix). */
  template?: { id: string; version?: string };
  /** Template attribute values from mixins.productTemplateAttributes (key → raw value). */
  templateAttributes?: Record<string, string>;
  /**
   * Attribute key order from Product Templates `attributes[]` (BE definition order).
   * Used so PLP/PDP display matches the template, not alphabetical Object key order.
   */
  templateAttributeOrder?: string[];
  /**
   * Localized display names for template attribute keys, resolved from
   * `GET /product/{tenant}/product-templates/{id}` (`attributes[].name`).
   */
  templateAttributeLabels?: Record<string, LocalizedString>;
  /** Emporix template attribute types (`TEXT` | `NUMBER` | `BOOLEAN` | `DATETIME`). */
  templateAttributeTypes?: Record<string, ProductTemplateAttributeType>;
  variantAttributes?: ProductVariantAttribute[];
  variantAttributeValues?: Record<string, string>;
  /** Emporix product category roots when provided by API */
  categoryIds?: string[];
}

export interface ProductRecommendations {
  products: Product[];
}
