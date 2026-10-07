import type { HTMLAttributes } from 'react';
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

  // Nothing configured — collapse entirely (no py-8 shell).
  if (!hasProductId && !hasProducts) {
    return null;
  }

  // Shell lives inside the client island so empty/error final states return null
  // without leaving an empty `py-8 content-container` spacer above the footer.
  return (
    <RecommendationsCarousel
      overline={overline}
      headline={headline}
      productId={productId}
      products={products}
      locale={locale}
      className={className}
      {...rest}
    />
  );
};

export default Recommendations;
