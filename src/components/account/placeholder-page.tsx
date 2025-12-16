import { FC } from 'react';
import { useTranslations } from 'next-intl';
import { FileQuestion } from 'lucide-react';
import { H2 } from '@/components/ui/h';
import AccountLayout from './account-layout';

interface PlaceholderPageProps {
  title?: string;
}

export const PlaceholderPage: FC<PlaceholderPageProps> = ({ title }) => {
  const t = useTranslations('account.placeholder');

  return (
    <AccountLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 px-4">
        <FileQuestion className="w-24 h-24 text-text-placeholders" />
        <div className="space-y-3 max-w-2xl">
          <H2>{title || t('title')}</H2>
          <p className="text-lg text-text-secondary">{t('description')}</p>
          <p className="text-base text-text-placeholders">{t('details')}</p>
        </div>
      </div>
    </AccountLayout>
  );
};

export default PlaceholderPage;
