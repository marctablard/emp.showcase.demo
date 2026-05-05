import type { CMSComponentEntry } from '@extensions/medienwerft-cms-plugin/types';
import { sharedFieldDefinitions } from './_shared/field-definitions';
import ProductCarousel from './product-carousel-content';

type SlidesPerView = 2 | 3 | 4 | 5;

export default ProductCarousel;
export { ProductCarousel };

export const productCarouselEntry: CMSComponentEntry = {
  definition: {
    type: 'cms-product-carousel',
    label: 'Product carousel',
    description: 'Curated product carousel by SKU. Tiles render image, name, and price; navigates with prev/next.',
    fieldDefinitions: sharedFieldDefinitions,
    props: {
      skus: { label: 'Product SKUs', type: 'array', items: { label: 'SKU', type: 'text' } },
      headline: { label: 'Headline', type: 'text' },
      view_all_link: { $ref: 'link', label: 'View all link', type: 'object' },
      slides_per_view: {
        label: 'Slides per view',
        type: 'select',
        options: [
          { label: '2', value: '2' },
          { label: '3', value: '3' },
          { label: '4', value: '4' },
          { label: '5', value: '5' },
        ],
      },
      loop: { label: 'Loop slides', type: 'boolean' },
      show_price: { label: 'Show price', type: 'boolean' },
      show_rating: { label: 'Show rating', type: 'boolean' },
    },
    defaultProps: {
      slides_per_view: '3',
      loop: true,
      show_price: true,
      show_rating: false,
    },
  },
  mapProps: (p) => ({
    skus: p.skus ?? [],
    headline: p.headline,
    viewAllLink: p.view_all_link,
    slidesPerView: Number(p.slides_per_view) as SlidesPerView,
    loop: p.loop,
    showPrice: p.show_price,
    showRating: p.show_rating,
  }),
  component: ProductCarousel,
};
