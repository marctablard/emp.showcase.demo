'use client';

import { useTranslations } from 'next-intl';
import { User, UserCheck } from 'lucide-react';
import UiLink from '@/components/ui/link';
import useAuthentication from '@/hooks/authentication/useAuthentication';

// Match HeaderCartButton's outer footprint so the action group aligns:
// - cart uses `pt-1 pb-2 sm:py-1` outer padding via `buttonPrimary`
// - cart's inner icon box is `w-[43px] h-[35px]` with a 32px icon
const buttonPadding = 'pt-1 pb-2 sm:py-1 px-3 sm:px-4';
const iconBox = 'flex items-center justify-center w-[43px] h-[35px]';

export function CmsAccountButton() {
  const t = useTranslations('layout.header');
  const { isAuthenticated, loading } = useAuthentication();

  if (loading) {
    // Reserve the same footprint while auth resolves to avoid layout shift.
    return <div className={`${buttonPadding} ${iconBox}`} aria-hidden />;
  }

  const Icon = isAuthenticated ? UserCheck : User;
  const href = isAuthenticated ? '/account' : '/login';
  const label = isAuthenticated ? t('account') : t('signIn');

  return (
    <UiLink type="Link" variant="buttonSecondary" href={href} aria-label={label} className={buttonPadding}>
      <span className={iconBox}>
        <Icon width="32" height="32" />
      </span>
    </UiLink>
  );
}

export default CmsAccountButton;
