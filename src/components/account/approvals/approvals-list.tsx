'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, Search } from 'lucide-react';
import { APPROVALS_PER_PAGE } from '@/components/account/account-table-constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import UiLink from '@/components/ui/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { useApprovals } from '@/hooks/approval/useApprovals';
import { useDebouncedValue } from '@/hooks/common/useDebouncedValue';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { Approval, ApprovalStatus } from '@/platform/services/model/approval';
import {
  AccountListContainer,
  accountTableBadgeCellClass,
  accountTableBadgeHeadClass,
  accountTableHeadClass,
  accountTableHeadRowClass,
  accountTableRowClass,
  shortenId,
} from '../shared/account-list';
import { ApprovalStatusBadge } from './approval-status-badge';

const SEARCH_DEBOUNCE_MS = 500;

interface ApprovalsListProps {
  initialApprovals?: Approval[];
  currentUserId?: string;
}

function getApprovalModifiedAt(approval: Approval): number {
  const candidate = approval.modifiedAt ?? approval.updatedAt ?? approval.createdAt;
  const timestamp = candidate ? new Date(candidate).getTime() : 0;

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatApprovalUserName(user: {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  userId?: string;
}): string {
  if (user.fullName && user.fullName.trim() !== '') {
    return user.fullName;
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (fullName !== '') {
    return fullName;
  }

  return user.userId ?? '-';
}

function getApprovalHref(approval: Approval, currentUserId?: string): string {
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

function ListStatePanel({ children }: { children: React.ReactNode }) {
  return <div className="border border-border-primary bg-surface-page p-6">{children}</div>;
}

export function ApprovalsList({ initialApprovals, currentUserId }: ApprovalsListProps) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations('orders.Approval');
  const tStatus = useTranslations('orders.ApprovalStatus');
  const tAction = useTranslations('orders.ApprovalAction');
  const [filterStatus, setFilterStatus] = useState<ApprovalStatus | '_ALL_'>('_ALL_');
  const [currentPage, setCurrentPage] = useState(1);

  const [quickSearch, setQuickSearch] = useState('');
  const normalizedSearch = useDebouncedValue(quickSearch, SEARCH_DEBOUNCE_MS).trim();

  const apiQuery = useMemo(() => {
    const parts: string[] = [];
    if (filterStatus !== '_ALL_') {
      parts.push(`status:${filterStatus}`);
    }
    if (normalizedSearch.length > 0) {
      parts.push(
        `compoundLogicalQuery:((id:~(${normalizedSearch})) OR (status:~(${normalizedSearch.toUpperCase()})) OR (requestor.firstName:~(${normalizedSearch})) OR (requestor.lastName:~(${normalizedSearch})) OR (approver.firstName:~(${normalizedSearch})) OR (approver.lastName:~(${normalizedSearch})))`,
      );
    }
    return parts.length > 0 ? parts.join(' ') : undefined;
  }, [filterStatus, normalizedSearch]);

  const { approvals, loading, error, refreshApprovals } = useApprovals(initialApprovals, undefined, apiQuery);

  const sortedApprovals = useMemo(
    () => [...approvals].sort((left, right) => getApprovalModifiedAt(right) - getApprovalModifiedAt(left)),
    [approvals],
  );

  const totalPages = Math.max(1, Math.ceil(sortedApprovals.length / APPROVALS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const visibleApprovals = useMemo(
    () => sortedApprovals.slice((safeCurrentPage - 1) * APPROVALS_PER_PAGE, safeCurrentPage * APPROVALS_PER_PAGE),
    [safeCurrentPage, sortedApprovals],
  );

  const handleFilter = (status: ApprovalStatus | '_ALL_') => {
    setFilterStatus(status);
    setCurrentPage(1);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  if (loading && normalizedSearch.length === 0 && filterStatus === '_ALL_') {
    return (
      <ListStatePanel>
        <div className="flex flex-col items-center space-y-2 py-8">
          <Spinner color="primary" variant="md" />
          <div>{t('loading')}</div>
        </div>
      </ListStatePanel>
    );
  }

  if (error) {
    return (
      <ListStatePanel>
        <div className="bg-surface-error p-4 text-text-error">
          {t('errorLoadingApprovals')}: {error.message}
        </div>
        <Button className="mt-4" onClick={() => refreshApprovals()}>
          {t('tryAgain')}
        </Button>
      </ListStatePanel>
    );
  }

  if (approvals.length === 0 && normalizedSearch.length === 0 && filterStatus === '_ALL_') {
    return (
      <ListStatePanel>
        <p className="py-8 text-center text-text-placeholders">{t('noApprovalsFound')}</p>
      </ListStatePanel>
    );
  }

  const isSearchLoading = loading && normalizedSearch.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <div className="relative w-full max-w-[380px]">
          <Input
            value={quickSearch}
            onChange={(event) => {
              setCurrentPage(1);
              setQuickSearch(event.target.value);
            }}
            placeholder={t('searchPlaceholder')}
            className="pr-10"
            endIcon={isSearchLoading ? undefined : Search}
            aria-label={t('searchPlaceholder')}
          />
          {isSearchLoading && (
            <Spinner
              variant="sm"
              color="primary"
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
              loadingText={t('loading')}
            />
          )}
        </div>
        <div className="min-w-[200px] flex-1">
          <Select value={filterStatus} onValueChange={(value) => handleFilter(value as ApprovalStatus | '_ALL_')}>
            <SelectTrigger>
              <SelectValue placeholder={t('filterByStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_ALL_">{t('allStatuses')}</SelectItem>
              <SelectItem value="PENDING">{tStatus('PENDING')}</SelectItem>
              <SelectItem value="APPROVED">{tStatus('APPROVED')}</SelectItem>
              <SelectItem value="DECLINED">{tStatus('DECLINED')}</SelectItem>
              <SelectItem value="EXPIRED">{tStatus('EXPIRED')}</SelectItem>
              <SelectItem value="CLOSED">{tStatus('CLOSED')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!loading && approvals.length === 0 && (normalizedSearch.length > 0 || filterStatus !== '_ALL_') && (
        <div className="border border-border-primary p-4 text-sm text-text-on-disabled">{t('noMatches')}</div>
      )}

      <AccountListContainer>
        <Table>
          <TableHeader>
            <TableRow className={accountTableHeadRowClass}>
              <TableHead className={accountTableHeadClass}>{t('id')}</TableHead>
              <TableHead className={accountTableHeadClass}>{t('resourceType')}</TableHead>
              <TableHead className={accountTableHeadClass}>{t('quoteId')}</TableHead>
              <TableHead className={accountTableHeadClass}>{t('orderId')}</TableHead>
              <TableHead className={accountTableHeadClass}>{t('action')}</TableHead>
              <TableHead className={accountTableHeadClass}>{t('requestor')}</TableHead>
              <TableHead className={accountTableHeadClass}>{t('approver')}</TableHead>
              <TableHead className={accountTableHeadClass}>{t('createdAt')}</TableHead>
              <TableHead className={accountTableBadgeHeadClass}>{t('status')}</TableHead>
              <TableHead className={cn(accountTableHeadClass, 'w-[160px] text-center')}>{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleApprovals.map((approval, index) => {
              const href = getApprovalHref(approval, currentUserId);

              return (
                <TableRow
                  key={approval.id}
                  className={accountTableRowClass(index, { clickable: true })}
                  onClick={() => router.push(href)}
                >
                  <TableCell className="px-2 py-4 font-medium">
                    <span title={approval.id}>
                      <UiLink type="Link" href={href} variant="primary">
                        {shortenId(approval.id)}
                      </UiLink>
                    </span>
                  </TableCell>
                  <TableCell className="px-2 py-4">{approval.resourceType}</TableCell>
                  <TableCell className="px-2 py-4">
                    {approval.resourceType === 'QUOTE' ? (
                      <span title={approval.resource.id}>
                        <UiLink type="Link" href={`/account/quotes/${approval.resource.id}`} variant="primary">
                          {shortenId(approval.resource.id)}
                        </UiLink>
                      </span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="px-2 py-4">
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
                  <TableCell className="px-2 py-4">{formatApprovalUserName(approval.requestor)}</TableCell>
                  <TableCell className="px-2 py-4">{formatApprovalUserName(approval.approver)}</TableCell>
                  <TableCell className="px-2 py-4">{formatDate(approval.createdAt)}</TableCell>
                  <TableCell className={accountTableBadgeCellClass}>
                    <ApprovalStatusBadge status={approval.status} />
                  </TableCell>
                  <TableCell className="px-2 py-4 text-center" onClick={(event) => event.stopPropagation()}>
                    <Button
                      variant="neutral"
                      size="icon"
                      title={t('view')}
                      aria-label={t('view')}
                      onClick={() => router.push(href)}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <TablePagination
          className="px-3"
          currentPage={safeCurrentPage}
          totalPages={totalPages}
          pageIndicator={t('pageIndicator', { current: safeCurrentPage, total: totalPages })}
          previousLabel={t('previous')}
          nextLabel={t('next')}
          onPreviousPage={() => setCurrentPage((p) => Math.max(1, Math.min(p, totalPages) - 1))}
          onNextPage={() => setCurrentPage((p) => Math.min(totalPages, Math.min(p, totalPages) + 1))}
        />
      </AccountListContainer>
    </div>
  );
}
