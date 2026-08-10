import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { parseProductIds } from './parse-product-ids';
import RecommendationsCarousel from './recommendations-carousel';
import type { RecommendationsData } from './schema';

export type RecommendationsProps = RecommendationsData & HTMLAttributes<HTMLDivElement>;

const Recommendations = ({
  id: _id,
  type: _type,
  overline,
  headline,
  productId,
  products,
  locale,
  className,
  ...rest
}: Readonly<RecommendationsProps>) => {
  const hasProductId = !!productId;
  const hasProducts = (products ? parseProductIds(products).length : 0) > 0;

  if (!hasProductId && !hasProducts) {
    return null;
  }

  return (
    <div className={cn('py-8 content-container', className)} {...rest}>
      <RecommendationsCarousel
        overline={overline}
        headline={headline}
        productId={productId}
        products={products}
        locale={locale}
      />
    </div>
  );
};

export default Recommendations;
