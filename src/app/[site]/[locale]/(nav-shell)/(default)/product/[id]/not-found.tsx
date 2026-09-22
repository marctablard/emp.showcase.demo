import { getLocale, getTranslations } from 'next-intl/server';
import { H1 } from '@/components/ui/h';
import UiLink from '@/components/ui/link';

/**
 * PDP miss (missing product or out of the customer's segment, COP-4822 AC4).
 * Same not-found outcome as a missing URL — the copy does not say why the product was omitted.
 */
export default async function ProductNotFound() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'product' });
  return (
    <div className="content-container flex flex-col items-center py-16 text-center" data-testid="product-notFound">
      <H1 className="mb-4">{t('notFoundTitle')}</H1>
      <p className="mb-6 max-w-xl text-text-body">{t('notFoundBody')}</p>
      <UiLink href="/" type="Link" variant="buttonPrimary" data-testid="product-notFoundHome">
        {t('notFoundHome')}
      </UiLink>
    </div>
  );
}
