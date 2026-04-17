import type { FC } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, BookText, Building, FileText, ShieldCheck } from 'lucide-react';
import { H4 } from '@/components/ui/h';
import UiLink from '@/components/ui/link';
import { type DocumentKey, dk } from '@/i18n/dynamic-key';
import { cn } from '@/lib/utils';
import { DashboardCard } from './dashboard-card';

interface DocumentCategory {
  id: string;
  titleKey: string;
  href: string;
  icon: React.ElementType;
  highlighted?: boolean;
}

interface DocumentsCardProps {
  className?: string;
  title?: string;
}

export const DocumentsCard: FC<DocumentsCardProps> = ({ className, title, ...props }) => {
  const t = useTranslations('account.Documents');

  const documentCategories: DocumentCategory[] = [
    {
      id: 'contracts',
      titleKey: 'categories.contracts',
      href: '/account/documents/contracts',
      icon: FileText,
    },
    {
      id: 'company',
      titleKey: 'categories.company',
      href: '/account/documents/company',
      icon: Building,
    },
    {
      id: 'manuals',
      titleKey: 'categories.manuals',
      href: '/account/documents/manuals',
      icon: BookText,
      highlighted: true,
    },
    {
      id: 'warranty',
      titleKey: 'categories.warranty',
      href: '/account/documents/warranty',
      icon: ShieldCheck,
    },
  ];

  return (
    <DashboardCard
      variant="default"
      className={cn('py-4 bg-surface-action-hover-2 rounded-none shadow-none', className)}
      {...props}
    >
      <div className="flex justify-between items-center mb-4">
        <H4>{title || t('title')}</H4>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-3">
        {documentCategories.map((category, index) => (
          <UiLink
            key={category.id}
            type="A"
            variant="clean"
            href={category.href}
            className={cn(
              'flex bg-surface-page no-underline gap-4 shadow-sm overflow-hidden',
              index === 0 && 'rounded-ss-xl',
              index === documentCategories.length - 1 && 'rounded-ee-xl',
            )}
          >
            <div className="flex items-center p-4 bg-surface-action text-text-on-action h-full">
              <category.icon className="h-8 w-8" />
            </div>
            <div className="flex flex-col justify-center py-2 pe-4">
              <div className="text-text-headings font-bold">{t(dk<DocumentKey>(category.titleKey))}</div>
              <div className="flex items-center gap-1 text-text-action font-bold underline">
                {t('seeAll')} <ArrowRight className="h-6 w-6" />
              </div>
            </div>
          </UiLink>
        ))}
      </div>
    </DashboardCard>
  );
};

export default DocumentsCard;
