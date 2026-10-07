'use client';

import { Fragment, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowDown, ArrowRight, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import UiLink from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { useProducts } from '@/hooks/product/useProducts';
import { useRouter } from '@/i18n/navigation';
import { cn, formatCurrency, l10n } from '@/lib/utils';
import type { Approval, ApprovalRequestor, ApprovalUser } from '@/platform/services/model/approval';
import {
  accountTableBadgeCellClass,
  accountTableBadgeHeadClass,
  accountTableHeadClass,
  accountTableHeadRowClass,
  accountTableRowClass,
  shortenId,
} from '../shared/account-list';
import { AccountProductLines } from '../shared/account-product-lines';
import { AccountProductThumbnails } from '../shared/account-product-thumbnails';
import { getApprovalHref } from './approval-routing';
import { ApprovalStatusBadge } from './approval-status-badge';

/**
 * Sortable Approval columns. Status, Approval ID, Net Total, Requestor, Approver,
 * Created At, Resource Type, and Modified At are each backed by a single documented
 * raw upstream field (see `resources/emporix/approval.yml`), so all are sortable.
 * Quote Number and Order Number are computed/joined display fields with no raw
 * sortable equivalent, and Action has no data to sort, so those stay non-sortable.
 */
export type ApprovalSortField =
  | 'status'
  | 'approvalId'
  | 'netTotal'
  | 'requestorFirstName'
  | 'approverFirstName'
  | 'createdAt'
  | 'resourceType'
  | 'modifiedAt';

/** Raw upstream Emporix Approval fields backing each sortable column. */
export const APPROVAL_SORT_FIELD_MAP: Record<ApprovalSortField, string> = {
  status: 'status',
  approvalId: 'id',
  netTotal: 'resource.subtotalAggregate.netValue',
  requestorFirstName: 'requestor.firstName',
  approverFirstName: 'approver.firstName',
  createdAt: 'metadata.createdAt',
  resourceType: 'resourceType',
  modifiedAt: 'metadata.modifiedAt',
};

/**
 * Re-exported from the server-safe `./approval-routing` module so the canonical
 * approval detail route can reuse the same routing decision. See that module for
 * the preserved routing semantics.
 */
export { getApprovalHref } from './approval-routing';

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

const COLUMN_COUNT = 13;

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
  const tAction = useTranslations('orders.ApprovalAction');
  const locale = useLocale();
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const productIds = useMemo(
    () =>
      Array.from(
        new Set(
          approvals.flatMap(
            (approval) =>
              approval.resource.items?.map((item) => item.productId).filter((id): id is string => Boolean(id)) ?? [],
          ),
        ),
      ),
    [approvals],
  );
  const { products } = useProducts(productIds);
  const productImages = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    for (const product of products) {
      map[product.id] = product.primaryImage?.url ?? product.images?.[0]?.url;
    }
    return map;
  }, [products]);

  const formatDateTime = (dateString: string) =>
    new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));

  const getSortIcon = (field: ApprovalSortField) => {
    if (loading && sortField === field) {
      return <Spinner variant="sm" color="primary" className="h-4 w-4" loadingText={t('loading')} />;
    }
    if (sortField !== field) return <ChevronsUpDown className="h-4 w-4 text-text-on-disabled" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const getSortAriaSort = (field: ApprovalSortField): 'none' | 'ascending' | 'descending' => {
    if (sortField !== field) return 'none';
    return sortDirection === 'asc' ? 'ascending' : 'descending';
  };

  const renderSortableHead = (field: ApprovalSortField, label: string, className: string, centered = false) => (
    <TableHead className={className} aria-sort={getSortAriaSort(field)}>
      <button
        type="button"
        onClick={() => onToggleSort?.(field)}
        disabled={!onToggleSort}
        className={cn('flex items-center gap-2 hover:text-text-action', centered && 'mx-auto')}
        data-testid={`approvals-sort-${field}`}
      >
        {label}
        {getSortIcon(field)}
      </button>
    </TableHead>
  );

  const renderRows = () => {
    if (!loading && approvals.length === 0) {
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
      const expanded = expandedId === approval.id;
      const netTotal = approval.resource.subtotalAggregate;

      return (
        <Fragment key={approval.id}>
          <TableRow
            className={cn(
              accountTableRowClass(index, { clickable: true }),
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
            )}
            tabIndex={0}
            aria-label={t('viewApprovalAriaLabel', { id: approval.id })}
            data-testid={`approvals-row-${approval.id}`}
            onClick={() => router.push(approvalHref)}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) {
                return;
              }

              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                router.push(approvalHref);
              }
            }}
          >
            <TableCell className="px-2 py-4 font-medium">
              <span title={approval.id}>
                <UiLink
                  type="Link"
                  href={approvalHref}
                  variant="primary"
                  onClick={(event) => event.stopPropagation()}
                  data-testid={`approvals-id-${approval.id}`}
                >
                  {shortenId(approval.id)}
                </UiLink>
              </span>
            </TableCell>
            <TableCell className="px-2 py-4">{tResourceType(approval.resourceType)}</TableCell>
            <TableCell className="px-2 py-4" onClick={(event) => event.stopPropagation()}>
              {approval.resourceType === 'QUOTE' ? (
                <span title={approval.resource.id}>
                  <UiLink
                    type="Link"
                    href={`/account/quotes/${approval.resource.id}`}
                    variant="primary"
                    data-testid={`approvals-relatedQuote-${approval.resource.id}`}
                  >
                    {shortenId(approval.resource.id)}
                  </UiLink>
                </span>
              ) : (
                '-'
              )}
            </TableCell>
            <TableCell className="px-2 py-4" onClick={(event) => event.stopPropagation()}>
              {approval.resource.orderId ? (
                <span title={approval.resource.orderId}>
                  <UiLink type="Link" href={`/account/orders/${approval.resource.orderId}`} variant="text">
                    {shortenId(approval.resource.orderId)}
                  </UiLink>
                </span>
              ) : (
                '-'
              )}
            </TableCell>
            <TableCell className="px-2 py-4">{tAction(approval.action)}</TableCell>
            <TableCell className="px-2 py-4 text-right font-medium">
              {netTotal ? formatCurrency(netTotal.netValue, netTotal.currency, locale) : '-'}
            </TableCell>
            <TableCell className="px-2 py-4">{formatApprovalUserName(approval.requestor)}</TableCell>
            <TableCell className="px-2 py-4">{formatApprovalUserName(approval.approver)}</TableCell>
            <TableCell className="px-2 py-4">{formatDateTime(approval.createdAt)}</TableCell>
            <TableCell className="px-2 py-4">{formatDateTime(approval.modifiedAt ?? approval.createdAt)}</TableCell>
            <TableCell className="px-2 py-4" onClick={(event) => event.stopPropagation()}>
              <AccountProductThumbnails
                items={(approval.resource.items ?? []).map((item) => ({
                  imageUrl: item.productId ? productImages[item.productId] : undefined,
                  name: l10n(item.productName, locale),
                }))}
                onToggle={() => setExpandedId(expanded ? null : approval.id)}
                expanded={expanded}
                toggleLabel={t('products')}
              />
            </TableCell>
            <TableCell className={accountTableBadgeCellClass}>
              <ApprovalStatusBadge status={approval.status} />
            </TableCell>
            <TableCell className="px-2 py-4 text-center" onClick={(event) => event.stopPropagation()}>
              <Button
                variant="neutral"
                size="icon"
                title={t('view')}
                aria-label={t('viewApprovalAriaLabel', { id: approval.id })}
                onClick={() => router.push(approvalHref)}
                data-testid={`approvals-view-${approval.id}`}
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
          {expanded ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={COLUMN_COUNT} className="border-t border-border-primary p-0">
                <AccountProductLines
                  lines={(approval.resource.items ?? []).map((item, itemIndex) => ({
                    id: item.productId ?? item.itemId ?? String(itemIndex),
                    imageUrl: item.productId ? productImages[item.productId] : undefined,
                    name: l10n(item.productName, locale),
                    quantity: item.quantity,
                    unitPrice: item.itemPrice?.amount,
                    currency: item.itemPrice?.currency,
                  }))}
                />
              </TableCell>
            </TableRow>
          ) : null}
        </Fragment>
      );
    });
  };

  return (
    <>
      <div className={`transition-opacity ${loading ? 'opacity-70' : 'opacity-100'}`} aria-busy={loading}>
        <Table>
          <TableHeader>
            <TableRow className={accountTableHeadRowClass}>
              {renderSortableHead('approvalId', t('id'), accountTableHeadClass)}
              {renderSortableHead('resourceType', t('resourceType'), accountTableHeadClass)}
              <TableHead className={accountTableHeadClass}>{t('quoteId')}</TableHead>
              <TableHead className={accountTableHeadClass}>{t('orderId')}</TableHead>
              <TableHead className={accountTableHeadClass}>{t('action')}</TableHead>
              {renderSortableHead('netTotal', t('netTotal'), cn(accountTableHeadClass, 'text-right'))}
              {renderSortableHead('requestorFirstName', t('requestor'), accountTableHeadClass)}
              {renderSortableHead('approverFirstName', t('approver'), accountTableHeadClass)}
              {renderSortableHead('createdAt', t('createdAt'), accountTableHeadClass)}
              {renderSortableHead('modifiedAt', t('modifiedAt'), accountTableHeadClass)}
              <TableHead className={cn(accountTableHeadClass, 'w-[160px]')}>{t('products')}</TableHead>
              {renderSortableHead('status', t('status'), accountTableBadgeHeadClass, true)}
              <TableHead className={cn(accountTableHeadClass, 'w-[160px] text-center')}>{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{renderRows()}</TableBody>
        </Table>
      </div>

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
    </>
  );
}
