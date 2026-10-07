'use client';

import { useTranslations } from 'next-intl';
import Recommendations from '@/components/cms/recommendations/recommendations-carousel';
import { useRecommendations } from '@/hooks/recommendations/useRecommendations';

interface ProductDetailRecommendationsProps {
  productId: string;
  locale: string;
}

export function ProductDetailRecommendations({ productId, locale }: ProductDetailRecommendationsProps) {
  const t = useTranslations('product');
  const { recommendations, loading, error } = useRecommendations(productId, locale);

  if (error) {
    return null;
  }

  if (loading) {
    return (
      <Recommendations
        loading
        locale={locale}
        overline={t('productRecommendations.overline')}
        headline={t('productRecommendations.headline')}
      />
    );
  }

  const crossSell = recommendations?.crossSell ?? [];
  const upSell = recommendations?.upSell ?? [];
  const hasTypedRecommendations = crossSell.length > 0 || upSell.length > 0;
  const generalRecommendations = recommendations?.products ?? [];

  if (!hasTypedRecommendations && generalRecommendations.length === 0) {
    return null;
  }

  if (hasTypedRecommendations) {
    return (
      <>
        {crossSell.length > 0 && (
          <Recommendations
            items={crossSell}
            locale={locale}
            overline={t('productRecommendations.crossSell.overline')}
            headline={t('productRecommendations.crossSell.headline')}
          />
        )}
        {upSell.length > 0 && (
          <Recommendations
            items={upSell}
            locale={locale}
            overline={t('productRecommendations.upSell.overline')}
            headline={t('productRecommendations.upSell.headline')}
          />
        )}
      </>
    );
  }

  return (
    <Recommendations
      items={generalRecommendations}
      locale={locale}
      overline={t('productRecommendations.overline')}
      headline={t('productRecommendations.headline')}
    />
  );
}
