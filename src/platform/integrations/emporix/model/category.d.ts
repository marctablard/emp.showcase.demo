import { EmporixLocalizedString, EmporixMedia, EmporixMetadata, EmporixMixins } from './common';

export interface EmporixCategory {
  id: string;
  code?: string;
  /** Plain string name (e.g. "ProductRoot") or localized map from some endpoints */
  name?: string | EmporixLocalizedString;
  /** Localized name map returned by the /category-trees endpoint — preferred over name */
  localizedName?: EmporixLocalizedString;
  description?: string | EmporixLocalizedString;
  localizedDescription?: EmporixLocalizedString;
  shortDescription?: EmporixLocalizedString;
  slug?: string | EmporixLocalizedString;
  localizedSlug?: EmporixLocalizedString;
  published?: boolean;
  visible?: boolean;
  position?: number;
  parentId?: string;
  supercategoriesIds?: string[];
  /** Nested categories from the /category-trees endpoint */
  subcategories?: EmporixCategory[];
  /** Nested categories from other tree endpoints */
  children?: EmporixCategory[];
  media?: EmporixMedia[];
  metadata?: EmporixMetadata;
  mixins?: EmporixMixins;
  customAttributes?: {
    [key: string]: any;
  };
}

export interface EmporixCategoryParent extends EmporixCategory {
  level?: number;
}

export type EmporixCategoryAssignmentType = 'product';

export interface EmporixCategoryAssignment {
  id: string;
  categoryId: string;
  ref: {
    id: string;
    type: EmporixCategoryAssignmentType;
    localizedName?: EmporixLocalizedString;
  };
  metadata?: EmporixMetadata;
}

export interface EmporixCategoryAssignmentQuery {
  assignmentType?: EmporixCategoryAssignmentType;
  showUnpublished?: boolean;
  withSubcategories?: boolean;
  segmentsIds?: string;
  hideUnpublishedProducts?: boolean;
}
