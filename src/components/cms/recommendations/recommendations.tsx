import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
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
}: RecommendationsProps) => {
  const hasProductId = !!productId;
  const hasProducts = (products?.split(',').filter((id) => id.trim().length > 0).length ?? 0) > 0;

  if (!hasProductId && !hasProducts) {
    return null;
  }

  return (
    <div className={cn('py-8 max-w-6xl mx-auto px-4 lg:px-9', className)} {...rest}>
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
