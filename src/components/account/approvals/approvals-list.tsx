'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { APPROVALS_PER_PAGE } from '@/components/account/account-table-constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useApprovals } from '@/hooks/approval/useApprovals';
import type { Approval, ApprovalStatus } from '@/platform/services/model/approval';
import { AccountListContainer } from '../shared/account-list';
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
  const [normalizedSearch, setNormalizedSearch] = useState('');

  useEffect(() => {
    const timeoutId = globalThis.setTimeout(() => {
      const nextNormalizedSearch = quickSearch.trim();
      if (nextNormalizedSearch === normalizedSearch) {
        return;
      }

      setCurrentPage((prev) => (prev === 1 ? prev : 1));
      setNormalizedSearch(nextNormalizedSearch);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [quickSearch, normalizedSearch]);

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

  const handleFilter = (status: ApprovalStatus | '_ALL_') => {
    setFilterStatus(status);
    setCurrentPage(1);
  };

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
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <div className="relative w-full max-w-[380px]">
          <Input
            value={quickSearch}
            onChange={(event) => {
              setQuickSearch(event.target.value);
            }}
            placeholder={t('searchPlaceholder')}
            className="pr-10"
            endIcon={isSearchLoading ? undefined : Search}
            aria-label={t('searchPlaceholder')}
            data-testid="approvals-search"
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

      {error ? (
        <div className="border border-border-error bg-surface-error px-4 py-3 text-text-error space-y-3">
          <p>{error.message}</p>
          <Button onClick={() => refreshApprovals()} data-testid="approvals-retryButton">
            {t('tryAgain')}
          </Button>
        </div>
      ) : (
        <AccountListContainer>
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
        </AccountListContainer>
      )}
    </div>
  );
}
