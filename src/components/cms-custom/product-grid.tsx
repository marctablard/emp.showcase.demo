import type { CMSComponentEntry } from '@extensions/medienwerft-cms-plugin/types';
import { sharedFieldDefinitions } from './_shared/field-definitions';
import ProductGrid from './product-grid-content';

type Columns = 2 | 3 | 4 | 6;

export default ProductGrid;
export { ProductGrid };

export const productGridEntry: CMSComponentEntry = {
  definition: {
    type: 'cms-product-grid',
    label: 'Product grid',
    description: 'Curated product grid by SKU. Products are fetched per tile and rendered with image, name, and price.',
    fieldDefinitions: sharedFieldDefinitions,
    props: {
      skus: { label: 'Product SKUs', type: 'array', items: { label: 'SKU', type: 'product' } },
      headline: { label: 'Headline', type: 'text' },
      view_all_link: { $ref: 'link', label: 'View all link', type: 'object' },
      columns: {
        label: 'Columns',
        type: 'select',
        options: [
          { label: '2', value: '2' },
          { label: '3', value: '3' },
          { label: '4', value: '4' },
          { label: '6', value: '6' },
        ],
      },
      show_price: { label: 'Show price', type: 'boolean' },
      show_rating: { label: 'Show rating', type: 'boolean' },
      density: {
        label: 'Density',
        type: 'select',
        options: [
          { label: 'Compact', value: 'compact' },
          { label: 'Comfortable', value: 'comfortable' },
        ],
      },
    },
    defaultProps: { columns: '3', show_price: true, show_rating: false, density: 'comfortable' },
  },
  mapProps: (p) => ({
    skus: p.skus ?? [],
    headline: p.headline,
    viewAllLink: p.view_all_link,
    columns: Number(p.columns) as Columns,
    showPrice: p.show_price,
    showRating: p.show_rating,
    density: p.density,
  }),
  component: ProductGrid,
};
