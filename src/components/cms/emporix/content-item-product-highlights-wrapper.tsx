'use client';

import Recommendations from '../recommendations';

/**
 * Client wrapper component for Recommendations
 */
export function RecommendationsWrapper({ products, locale }: { products: string; locale: string }) {
  return <Recommendations products={products} locale={locale} />;
}
