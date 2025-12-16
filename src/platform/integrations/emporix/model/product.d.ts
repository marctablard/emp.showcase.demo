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
  overlay?: EmporixLabelOverlay;
  description: string | EmporixLocalizedString;
  metadata?: EmporixMetadata;
}

export interface EmporixProductTemplate {
  id: string;
  name: EmporixLocalizedString;
  attributes: [
    {
      key: string;
      name: EmporixLocalizedString;
      metadata: {
        mandatory: true;
        variantAttribute: true;
      };
      values: [{ key: string }];
    },
  ];
  metadata: EmporixMetadata;
}

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
  template?: EmporixProductTemplate;
  variantAttributes?: {
    [key: string]: [{ key: string }];
  };
}
