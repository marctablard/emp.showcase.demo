import type { FC } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import AccountLayout from '../account-layout';
import { AccountListContainer, accountTableHeadClass } from '../shared/account-list';
import { AccountPageHeader } from '../shared/account-page-header';
import { PREVIEW_CONFIGS, type PreviewCategory } from './preview-configs';

interface AccountPreviewPageProps {
  category?: PreviewCategory;
}

/**
 * Renders a fully styled, on-brand account section using realistic domain data.
 * Used for sections that are part of the reference storefront's navigation but
 * not yet wired to a live backend. The content intentionally reads as real data
 * so the section looks production-ready rather than a stub.
 */
export const AccountPreviewPage: FC<AccountPreviewPageProps> = ({ category = 'default' }) => {
  const t = useTranslations('account');
  const config = PREVIEW_CONFIGS[category] ?? PREVIEW_CONFIGS.default;

  return (
    <AccountLayout>
      <div className="space-y-6">
        <AccountPageHeader
          eyebrow={t(config.eyebrowKey)}
          title={t(config.titleKey)}
          description={t(config.descriptionKey)}
        />

        {config.stats?.length ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {config.stats.map((stat) => (
              <Card key={stat.labelKey} variant="stat" className="gap-1 py-4">
                <div className="px-6">
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-text-placeholders">
                    {t(`previews.stats.${stat.labelKey}`)}
                  </p>
                  <p className="mt-1 text-3xl font-bold text-text-headings">{stat.value}</p>
                </div>
              </Card>
            ))}
          </div>
        ) : null}

        <AccountListContainer>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {config.columns.map((column) => (
                  <TableHead
                    key={column.key}
                    className={cn(accountTableHeadClass, column.align === 'right' && 'text-right')}
                  >
                    {t(`previews.columns.${column.labelKey}`)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {config.rows.map((row, index) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    'border-t border-border-primary',
                    index % 2 === 0 ? 'bg-surface-page' : 'bg-surface-image-background',
                  )}
                >
                  {config.columns.map((column) => {
                    if (column.kind === 'status') {
                      return (
                        <TableCell key={column.key} className="px-2 py-4">
                          <Badge variant={row.statusVariant} size="status">
                            {t(`previews.status.${row.statusKey}`)}
                          </Badge>
                        </TableCell>
                      );
                    }

                    return (
                      <TableCell
                        key={column.key}
                        className={cn(
                          'px-2 py-4 text-sm xl:text-base',
                          column.kind === 'primary' ? 'font-medium text-text-headings' : 'text-text-body',
                          column.align === 'right' && 'text-right tabular-nums',
                        )}
                      >
                        {row.cells[column.key] ?? '–'}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AccountListContainer>
      </div>
    </AccountLayout>
  );
};

export default AccountPreviewPage;
