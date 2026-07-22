'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { APPROVALS_PER_PAGE } from '@/components/account/account-table-constants';
import { Button } from '@/components/ui/button';
import { H1 } from '@/components/ui/h';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { TableCard } from '@/components/ui/table';
import { useApprovals } from '@/hooks/approval/useApprovals';
import { useDebouncedValue } from '@/hooks/common/useDebouncedValue';
import type { Approval, ApprovalStatus } from '@/platform/services/model/approval';
import { APPROVAL_SORT_FIELD_MAP, type ApprovalSortField, ApprovalsTable } from './approvals-table';

const SEARCH_DEBOUNCE_MS = 500;
const INITIAL_PAGE_SORT = 'metadata.modifiedAt:desc';

interface ApprovalsListProps {
  initialApprovals?: Approval[];
  currentUserId?: string;
  initialTotalCount?: number;
}

export function ApprovalsList({ initialApprovals, currentUserId, initialTotalCount }: Readonly<ApprovalsListProps>) {
  const t = useTranslations('orders.Approval');
  const tStatus = useTranslations('orders.ApprovalStatus');
  const [filterStatus, setFilterStatus] = useState<ApprovalStatus | '_ALL_'>('_ALL_');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<ApprovalSortField>('modifiedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

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

  const apiSort = `${APPROVAL_SORT_FIELD_MAP[sortField]}:${sortDirection}`;

  const { approvals, loading, error, pagination, refreshApprovals } = useApprovals(initialApprovals, {
    pageNumber: currentPage,
    pageSize: APPROVALS_PER_PAGE,
    sort: apiSort,
    query: apiQuery,
    initialTotalCount,
    initialRequest: {
      pageNumber: 1,
      pageSize: APPROVALS_PER_PAGE,
      sort: INITIAL_PAGE_SORT,
      query: undefined,
    },
  });

  const handleFilter = (status: ApprovalStatus | '_ALL_') => {
    setFilterStatus(status);
    setCurrentPage(1);
  };

  const toggleSort = (field: ApprovalSortField) => {
    setCurrentPage(1);
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    const totalPages = pagination?.totalPages ?? 1;
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const hasActiveSearch = normalizedSearch.length > 0 || filterStatus !== '_ALL_';
  const isSearchLoading = loading && normalizedSearch.length > 0;

  return (
    <div className="space-y-6">
      <H1>{t('title')}</H1>

      <TableCard>
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
          <div className="flex-1 min-w-[200px] max-w-[280px]">
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

        {error ? (
          <div className="bg-surface-error border border-border-error text-text-error px-4 py-3 rounded space-y-3">
            <p>{error.message}</p>
            <Button onClick={() => refreshApprovals()}>{t('tryAgain')}</Button>
          </div>
        ) : (
          <ApprovalsTable
            approvals={approvals}
            currentUserId={currentUserId}
            loading={loading}
            currentPage={currentPage}
            totalPages={pagination?.totalPages ?? 1}
            onPreviousPage={handlePreviousPage}
            onNextPage={handleNextPage}
            sortField={sortField}
            sortDirection={sortDirection}
            onToggleSort={toggleSort}
            hasActiveSearch={hasActiveSearch}
          />
        )}
      </TableCard>
    </div>
  );
}
