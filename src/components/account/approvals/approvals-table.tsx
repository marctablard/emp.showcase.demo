'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ArrowDown, ArrowRight, ArrowUp, ChevronsUpDown } from 'lucide-react';
import UiLink from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { useRouter } from '@/i18n/navigation';
import { formatDate } from '@/lib/date-utils';
import { cn, formatCurrency } from '@/lib/utils';
import type { Approval, ApprovalRequestor, ApprovalUser } from '@/platform/services/model/approval';
import { ApprovalStatusBadge } from './approval-status-badge';

/**
 * The only sortable column. `metadata.createdAt` is equally documented in
 * `resources/emporix/approval.yml`, but the Jira/product-approved contract for
 * COP-6028 only requires Modified At sorting (default descending); other columns
 * (Requestor/Approver names, Resource Type, Net Total) have no single documented
 * raw sortable field, mirroring the same approved exception used for Returns/Quotes.
 */
export type ApprovalSortField = 'modifiedAt';

export const APPROVAL_SORT_FIELD_MAP: Record<ApprovalSortField, string> = {
  modifiedAt: 'metadata.modifiedAt',
};

/**
 * Resolves the destination for the Approval ID / row / Action arrow. Preserves the
 * exact pre-existing routing semantics:
 * - A QUOTE approval where the current user is the designated approver (and not
 *   also the requestor) routes to the standalone approval review page.
 * - Other QUOTE approvals route to the quote detail page.
 * - CART (and any other non-QUOTE) approvals route to the approval detail page.
 */
export function getApprovalHref(approval: Approval, currentUserId?: string): string {
  if (
    approval.resourceType === 'QUOTE' &&
    currentUserId &&
    approval.approver.userId === currentUserId &&
    approval.requestor.userId !== currentUserId
  ) {
    return `/account/approval/${approval.id}`;
  }

  if (approval.resourceType === 'QUOTE') {
    return `/account/quotes/${approval.resource.id}`;
  }

  return `/account/approvals/${approval.id}`;
}

export function formatApprovalUserName(user: ApprovalUser | ApprovalRequestor): string {
  if (user.fullName && user.fullName.trim() !== '') {
    return user.fullName;
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (fullName !== '') {
    return fullName;
  }

  return user.userId ?? '-';
}

interface ApprovalsTableProps {
  approvals: Approval[];
  currentUserId?: string;
  loading?: boolean;
  currentPage?: number;
  totalPages?: number;
  onPreviousPage?: () => void;
  onNextPage?: () => void;
  sortField?: ApprovalSortField;
  sortDirection?: 'asc' | 'desc';
  onToggleSort?: (field: ApprovalSortField) => void;
  hasActiveSearch?: boolean;
}

const COLUMN_COUNT = 11;

export function ApprovalsTable({
  approvals,
  currentUserId,
  loading = false,
  currentPage = 1,
  totalPages = 1,
  onPreviousPage,
  onNextPage,
  sortField = 'modifiedAt',
  sortDirection = 'desc',
  onToggleSort,
  hasActiveSearch = false,
}: Readonly<ApprovalsTableProps>) {
  const t = useTranslations('orders.Approval');
  const tResourceType = useTranslations('orders.ApprovalResourceType');
  const locale = useLocale();
  const router = useRouter();

  const getSortIcon = (field: ApprovalSortField) => {
    if (sortField !== field) return <ChevronsUpDown className="h-4 w-4 text-text-on-disabled" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const getSortAriaSort = (field: ApprovalSortField): 'none' | 'ascending' | 'descending' => {
    if (sortField !== field) return 'none';
    return sortDirection === 'asc' ? 'ascending' : 'descending';
  };

  const renderSortableHead = (field: ApprovalSortField, label: string, className: string) => (
    <TableHead className={className} aria-sort={getSortAriaSort(field)}>
      <button
        type="button"
        onClick={() => onToggleSort?.(field)}
        className="flex items-center gap-2 hover:text-text-action"
      >
        {label}
        {getSortIcon(field)}
      </button>
    </TableHead>
  );

  return (
    <div>
      <Table containerClassName="pr-1">
        <TableHeader>
          <TableRow className="text-base">
            <TableHead className="!h-14 w-[160px] font-bold">{t('approvalId')}</TableHead>
            {renderSortableHead('modifiedAt', t('modifiedAt'), '!h-14 w-[160px] font-bold')}
            <TableHead className="!h-14 w-[140px] font-bold">{t('status')}</TableHead>
            <TableHead className="!h-14 w-[140px] font-bold">{t('resourceType')}</TableHead>
            <TableHead className="!h-14 w-[160px] font-bold">{t('quoteNumber')}</TableHead>
            <TableHead className="!h-14 w-[160px] font-bold">{t('orderNumber')}</TableHead>
            <TableHead className="!h-14 w-[140px] font-bold">{t('netTotal')}</TableHead>
            <TableHead className="!h-14 w-[180px] font-bold">{t('requestor')}</TableHead>
            <TableHead className="!h-14 w-[180px] font-bold">{t('approver')}</TableHead>
            <TableHead className="!h-14 w-[160px] font-bold">{t('createdAt')}</TableHead>
            <TableHead className="!h-14 w-[100px] font-bold text-center">{t('action')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(() => {
            if (loading) {
              return (
                <TableRow>
                  <TableCell colSpan={COLUMN_COUNT} className="h-24 text-center">
                    <div className="flex items-center justify-center">
                      <Spinner color="primary" variant="md" />
                    </div>
                  </TableCell>
                </TableRow>
              );
            }

            if (approvals.length === 0) {
              return (
                <TableRow>
                  <TableCell colSpan={COLUMN_COUNT} className="h-24 text-center">
                    {hasActiveSearch ? t('noMatches') : t('noApprovalsFound')}
                  </TableCell>
                </TableRow>
              );
            }

            return approvals.map((approval, index) => {
              const approvalHref = getApprovalHref(approval, currentUserId);
              const rowAriaLabel = t('viewApprovalAriaLabel', { id: approval.id });
              const isQuote = approval.resourceType === 'QUOTE';
              const netTotal = approval.resource.subtotalAggregate;

              return (
                <TableRow
                  key={approval.id}
                  className={cn(
                    'hover:bg-surface-image-background cursor-pointer text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
                    index % 2 === 0 ? 'bg-surface-page' : 'bg-surface-image-background',
                  )}
                  tabIndex={0}
                  aria-label={rowAriaLabel}
                  onClick={() => router.push(approvalHref)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) {
                      return;
                    }

                    if (event.key === 'Enter') {
                      event.preventDefault();
                      router.push(approvalHref);
                    }
                  }}
                >
                  <TableCell className="px-2 py-4 font-medium">
                    <UiLink
                      type="Link"
                      href={approvalHref}
                      variant="table"
                      className="font-bold"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {approval.id}
                    </UiLink>
                  </TableCell>
                  <TableCell className="px-2 py-4">
                    {formatDate(approval.modifiedAt ?? approval.createdAt, locale)}
                  </TableCell>
                  <TableCell className="px-2 py-4">
                    <ApprovalStatusBadge status={approval.status} />
                  </TableCell>
                  <TableCell className="px-2 py-4">{tResourceType(approval.resourceType)}</TableCell>
                  <TableCell className="px-2 py-4">
                    {isQuote ? (
                      <UiLink
                        type="Link"
                        href={`/account/quotes/${approval.resource.id}`}
                        variant="table"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {approval.resource.id}
                      </UiLink>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="px-2 py-4">{approval.resource.orderId ?? '-'}</TableCell>
                  <TableCell className="px-2 py-4 font-medium">
                    {netTotal ? formatCurrency(netTotal.netValue, netTotal.currency, locale) : '-'}
                  </TableCell>
                  <TableCell className="px-2 py-4">{formatApprovalUserName(approval.requestor)}</TableCell>
                  <TableCell className="px-2 py-4">{formatApprovalUserName(approval.approver)}</TableCell>
                  <TableCell className="px-2 py-4">{formatDate(approval.createdAt, locale)}</TableCell>
                  <TableCell className="px-2 py-4 text-center">
                    <div className="flex items-center justify-center">
                      <UiLink
                        type="Link"
                        href={approvalHref}
                        variant="table"
                        onClick={(event) => event.stopPropagation()}
                        aria-label={t('viewApprovalAriaLabel', { id: approval.id })}
                      >
                        <ArrowRight className="h-6 w-6" />
                      </UiLink>
                    </div>
                  </TableCell>
                </TableRow>
              );
            });
          })()}
        </TableBody>
      </Table>

      <TablePagination
        className="px-3"
        currentPage={currentPage}
        totalPages={totalPages}
        pageIndicator={t('pageIndicator', { current: currentPage, total: totalPages })}
        previousLabel={t('previous')}
        nextLabel={t('next')}
        onPreviousPage={onPreviousPage}
        onNextPage={onNextPage}
      />
    </div>
  );
}
