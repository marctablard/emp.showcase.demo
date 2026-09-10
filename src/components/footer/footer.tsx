'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Mail } from 'lucide-react';
import { useNewsletterForm } from '@/hooks/newsletter/useNewsletterForm';
import { getNavigationRootCategoriesPageSize } from '@/lib/navigation/navigation-root-categories-page-size';
import { takeRootCategoryPage } from '@/lib/navigation/take-root-category-page';
import { cn } from '@/lib/utils';
import { Form, FormControl, FormField, FormItem, FormMessage } from '../ui/form';
import { InputButton } from '../ui/input';
import UiLink from '../ui/link';

/** Brand marks removed from lucide-react v1 — use public SVG assets (lucide size-4). */
function BrandSocialIcon({ src }: Readonly<{ src: string }>) {
  return <Image src={src} alt="" width={16} height={16} className="size-4" aria-hidden="true" />;
}

export default function Footer({ reduced = false }: { reduced?: boolean }) {
  const t = useTranslations('layout.footer');
  const { form } = useNewsletterForm();

  return (
    <div className="w-full text-sm grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 p-4 md:p-6">
      {!reduced && (
        <div>
          <p className="font-bold mb-2">{t('newsletterTitle')}</p>
          <div className="max-w-[560px]">
            <Form {...form}>
              <FormField
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <InputButton
                        placeholder={t('newsletterInput')}
                        {...field}
                        iconButtonAfter={Mail}
                        buttonLabel={t('newsletterButtonLabel')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Form>
          </div>
          <p className="mt-2">
            {t('beforePrivacyPolicy')}
            <UiLink type="Link" variant="text" href="/privacy-policy">
              {t('privacyPolicyLink')}
            </UiLink>
            {t('beforeTermsAndConditions')}
            <UiLink type="Link" variant="text" href="/terms-and-conditions">
              {t('termsAndConditionsLink')}
            </UiLink>
            {t('afterTermsAndConditions')}
          </p>
        </div>
      )}
      {!reduced && (
        <div>
          <p className="font-bold mb-2 sm:mb-6">{t('paymentMethodsTitle')}</p>
          <div className="flex gap-2 justify-between items-center max-w-[400px]">
            <Image src="/images/mastercard.svg" alt="Mastercard" width="88" height="20" />
            <Image src="/images/paypal.svg" alt="Paypal" width="60" height="16" />
            <Image src="/images/pci-dss-compliant.svg" alt="PCI DSS Compliant" width="50" height="20" />
            <Image src="/images/gdpr.svg" alt="GDPR" width={19} height={24} />
          </div>
        </div>
      )}
      <div className="bg-surface-action-hover-2 rounded-ss-lg p-2 sm:p-4">
        <div className="bg-[url('/images/map-pinned.svg')] bg-no-repeat bg-right-top">
          <p className="font-bold">{t('companyName')}</p>
          <p>{t('street')}</p>
          <p>{t('city')}</p>
          <p>{t('country')}</p>
        </div>
      </div>
      <div className="bg-surface-action-hover-2 rounded-ee-lg p-2 sm:p-4">
        <div className="bg-[url('/images/headset.svg')] bg-no-repeat bg-right-top flex flex-col gap-2">
          <div>
            <p className="font-bold">{t('ourServiceHours')}</p>
            <p>{t('mondayToThursday')}</p>
            <p>{t('friday')}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="font-bold">{t('serviceTechnology')}</p>
              <p>0123 987654-32</p>
            </div>
            <div>
              <p className="font-bold">{t('sales')}</p>
              <p>0123 987654-31</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export type FooterTopProductCategoryLink = { label: string; href: string };

export function FooterLinks({
  topProductCategories,
  showAllProductsBrowse = false,
  assignedProductsMode = false,
}: {
  topProductCategories?: FooterTopProductCategoryLink[];
  showAllProductsBrowse?: boolean;
  /**
   * COP-4822 (AC1): when the customer is segmented, the footer shares the header's assigned
   * category forest and the column heading reads "Assigned Products" instead of "Products".
   */
  assignedProductsMode?: boolean;
}) {
  const t = useTranslations('layout.footerLinks');
  const categoryPreviewCount = getNavigationRootCategoriesPageSize();
  const { visible: visibleTopProductCategories } = takeRootCategoryPage(
    topProductCategories ?? [],
    categoryPreviewCount,
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 md:gap-6 ml-4 mr-4 md:ml-6 md:mr-6 py-4 md:py-6 border-b border-b-border-primary">
      <div className="flex flex-col gap-2">
        <p className="text-lg mb-1">{assignedProductsMode ? t('assignedProducts') : t('products')}</p>
        {topProductCategories && topProductCategories.length > 0 ? (
          <>
            {visibleTopProductCategories.map((link) => (
              <UiLink key={link.href + link.label} type="Link" href={link.href} variant="secondary" size="s">
                {link.label}
              </UiLink>
            ))}
            {showAllProductsBrowse ? (
              <UiLink
                type="Link"
                href="/browse"
                variant="text"
                size="s"
                className="underline font-bold text-text-action p-0 h-auto justify-start"
              >
                {t('showAllCategories')}
              </UiLink>
            ) : null}
          </>
        ) : (
          <>
            <UiLink type="Link" href="#" variant="secondary" size="s">
              {t('solarPanels')}
            </UiLink>
            <UiLink type="Link" href="#" variant="secondary" size="s">
              {t('inverters')}
            </UiLink>
            <UiLink type="Link" href="#" variant="secondary" size="s">
              {t('batterySolutions')}
            </UiLink>
            <UiLink type="Link" href="#" variant="secondary" size="s">
              {t('wiringSolutions')}
            </UiLink>
            <UiLink type="Link" href="#" variant="secondary" size="s">
              {t('solarAccessories')}
            </UiLink>
          </>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-lg mb-1">{t('services')}</p>
        <UiLink type="Link" href="#" variant="secondary" size="s">
          {t('solarSolutions')}
        </UiLink>
        <UiLink type="Link" href="#" variant="secondary" size="s">
          {t('installations')}
        </UiLink>
        <UiLink type="Link" href="#" variant="secondary" size="s">
          {t('renewableEnergy')}
        </UiLink>
        <UiLink type="Link" href="#" variant="secondary" size="s">
          {t('techServices')}
        </UiLink>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-lg mb-1">{t('solutions')}</p>
        <UiLink type="Link" href="#" variant="secondary" size="s">
          {t('installationPlanning')}
        </UiLink>
        <UiLink type="Link" href="#" variant="secondary" size="s">
          {t('regularMaintenance')}
        </UiLink>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-lg mb-1">{t('onlinePlanner')}</p>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-lg mb-1">{t('aboutUs')}</p>
        <UiLink type="Link" href="#" variant="secondary" size="s">
          <BrandSocialIcon src="/images/linkedin.svg" />
          Linkedin
        </UiLink>
        <UiLink type="Link" href="#" variant="secondary" size="s">
          <BrandSocialIcon src="/images/youtube.svg" />
          Youtube
        </UiLink>
        <UiLink type="Link" href="#" variant="secondary" size="s">
          <BrandSocialIcon src="/images/instagram.svg" />
          Instagram
        </UiLink>
      </div>
    </div>
  );
}

export function FooterWrapper({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className="flex-grow">
      <div className="max-w-6xl mx-auto grid gap-x-4 sm:gap-x-6">
        <div
          data-slot="footer"
          className={cn(
            "pb-1 sm:mx-4 md:mx-9 shadow-xl rounded-ss-lg rounded-se-lg bg-[url('/images/footer-bg.svg')] bg-no-repeat bg-right-bottom",
            className,
          )}
          {...props}
        >
          {props.children}
        </div>
      </div>
    </div>
  );
}

export function LegalFooter() {
  const t = useTranslations('layout.footerLegal');

  return (
    <div className="flex-grow">
      <div className="max-w-6xl mx-auto sm:mb-4 sm:px-4 md:px-9">
        <div
          data-slot="legal-footer"
          className="px-4 pb-16 pt-2 sm:-mx-2 lg:-mx-4 sm:-mt-1 sm:px-8 sm:py-0 lg:px-10 relative z-10 bg-surface-action sm:rounded-full"
        >
          <div className="flex flex-col sm:flex-row gap-2 md:gap-6 flex-wrap text-sm/8 text-text-on-action">
            <p className="flex-grow text-center sm:text-left">{t('copyright')}</p>
            <div className="flex flex-grow gap-6 justify-between sm:justify-end">
              <UiLink type="Link" variant="footerLegal" href="/privacy-policy">
                {t('privacyPolicy')}
              </UiLink>
              <UiLink type="Link" variant="footerLegal" href="/imprint">
                {t('imprint')}
              </UiLink>
              <UiLink type="Link" variant="footerLegal" href="/terms-and-conditions">
                {t('termsAndConditions')}
              </UiLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
