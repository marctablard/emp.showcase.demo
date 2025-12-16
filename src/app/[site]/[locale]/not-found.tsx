import { getLocale, getTranslations } from 'next-intl/server';
import { HeaderCheckout } from '@/components/header/header-checkout';
import { H1 } from '@/components/ui/h';
import UiLink from '@/components/ui/link';

export default async function NotFound() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'common.NotFound' });
  return (
    <>
      <HeaderCheckout />
      <div className="flex-grow mt-17 sm:mt-36 md:mt-52 mx-auto text-center">
        <H1 className="mb-6">{t('title')}</H1>
        <UiLink href="/" type="Link" variant="buttonPrimary">
          {t('home')}
        </UiLink>
      </div>
    </>
  );
}
