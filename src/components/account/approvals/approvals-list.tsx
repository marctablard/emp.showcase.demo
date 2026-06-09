'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { APPROVALS_PER_PAGE } from '@/components/account/account-table-constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { useApprovals } from '@/hooks/approval/useApprovals';
import { useDebouncedValue } from '@/hooks/common/useDebouncedValue';
import { Link } from '@/i18n/navigation';
import type { Approval, ApprovalStatus } from '@/platform/services/model/approval';
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

export function ApprovalsList({ initialApprovals, currentUserId }: ApprovalsListProps) {
  const locale = useLocale();
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
      <Card>
        <CardHeader>
          <CardTitle>{t('approvalsList')}</CardTitle>
          <CardDescription>{t('approvalsListDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <div className="flex flex-col items-center space-y-2">
            <Spinner color="primary" variant="md" />
            <div>{t('loading')}</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('approvalsList')}</CardTitle>
          <CardDescription>{t('approvalsListDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-surface-error p-4 rounded-md text-text-error">
            {t('errorLoadingApprovals')}: {error.message}
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={() => refreshApprovals()}>{t('tryAgain')}</Button>
        </CardFooter>
      </Card>
    );
  }

  if (approvals.length === 0 && normalizedSearch.length === 0 && filterStatus === '_ALL_') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('approvalsList')}</CardTitle>
          <CardDescription>{t('approvalsListDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-text-placeholders">{t('noApprovalsFound')}</p>
        </CardContent>
      </Card>
    );
  }

  const isSearchLoading = loading && normalizedSearch.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('approvalsList')}</CardTitle>
        <CardDescription>{t('approvalsListDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-4">
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
          <div className="flex-1 min-w-[200px]">
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
          <div className="rounded-md border border-border-primary p-4 text-sm text-text-on-disabled">
            {t('noMatches')}
          </div>
        )}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('id')}</TableHead>
                <TableHead>{t('resourceType')}</TableHead>
                <TableHead>{t('quoteId')}</TableHead>
                <TableHead>{t('orderId')}</TableHead>
                <TableHead>{t('action')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead>{t('requestor')}</TableHead>
                <TableHead>{t('approver')}</TableHead>
                <TableHead>{t('createdAt')}</TableHead>
                <TableHead>{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleApprovals.map((approval) => (
                <TableRow key={approval.id}>
                  <TableCell className="font-medium">{approval.id}</TableCell>
                  <TableCell>{approval.resourceType}</TableCell>
                  <TableCell>
                    {approval.resourceType === 'QUOTE' ? (
                      <Link href={`/account/quotes/${approval.resource.id}`} className="underline">
                        {approval.resource.id}
                      </Link>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>{approval.resource.orderId ?? '-'}</TableCell>
                  <TableCell>{tAction(approval.action)}</TableCell>
                  <TableCell>
                    <ApprovalStatusBadge status={approval.status} />
                  </TableCell>
                  <TableCell>{formatApprovalUserName(approval.requestor)}</TableCell>
                  <TableCell>{formatApprovalUserName(approval.approver)}</TableCell>
                  <TableCell>{formatDate(approval.createdAt)}</TableCell>
                  <TableCell>
                    <Link href={getApprovalHref(approval, currentUserId)}>
                      <Button variant="link" size="default">
                        {t('view')}
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
      </CardContent>
    </Card>
  );
}
