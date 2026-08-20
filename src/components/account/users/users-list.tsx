'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Search } from 'lucide-react';
import { USERS_PER_PAGE } from '@/components/account/account-table-constants';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { H1 } from '@/components/ui/h';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import UiLink from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import { TableCard } from '@/components/ui/table';
import { usePersistedState } from '@/hooks/common/usePersistedState';
import { useSession } from '@/hooks/session/useSession';
import { useCompanyUsers, useOtherCompanyUsers } from '@/hooks/user-management/useCompanyUsers';
import { isAuthenticatedSessionCustomerId } from '@/lib/common/customer-identity';
import type { CompanyUser } from '@/platform/services/model/user-management/company-user';
import { type CompanyUserSortField, USER_SORT_FIELD_MAP, UsersTable } from './users-table';

const INITIAL_PAGE_SORT = 'firstName:asc';
const SHOW_OTHER_COMPANY_USERS_CHECKBOX_ID = 'show-other-company-users';
const SHOW_OTHER_COMPANY_USERS_LABEL_ID = 'show-other-company-users-label';
const SHOW_OTHER_COMPANY_USERS_PENDING_OWNER_ID = 'pending';

export function showOtherCompanyUsersStorageKey(ownerId: string): string {
  return `user-management.v1:${encodeURIComponent(ownerId)}:showOtherCompanyUsers`;
}

function deserializeShowOtherCompanyUsers(raw: string): boolean {
  return JSON.parse(raw) === true;
}

interface UsersListProps {
  initialUsers?: CompanyUser[];
  initialTotalCount?: number;
  onDeleteUser?: (user: CompanyUser) => void;
  showOtherCompaniesToggle?: boolean;
}

export function UsersList({
  initialUsers,
  initialTotalCount,
  onDeleteUser,
  showOtherCompaniesToggle = false,
}: Readonly<UsersListProps>) {
  const t = useTranslations('user-management');
  const { session } = useSession();
  const [isClient, setIsClient] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<CompanyUserSortField>('firstName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [quickSearch, setQuickSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');

  useEffect(() => {
    // @see https://react.dev/reference/react-dom/client/hydrateRoot#handling-different-client-and-server-content
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsClient(true);
  }, []);

  const sessionCustomerId = session?.customerId;
  const ownerId = isAuthenticatedSessionCustomerId(sessionCustomerId) ? sessionCustomerId : undefined;
  const persistEnabled = isClient && Boolean(ownerId);
  const [showOtherCompanyUsers, setShowOtherCompanyUsers] = usePersistedState({
    key: showOtherCompanyUsersStorageKey(ownerId ?? SHOW_OTHER_COMPANY_USERS_PENDING_OWNER_ID),
    defaultValue: false,
    enabled: persistEnabled,
    deserialize: deserializeShowOtherCompanyUsers,
  });

  const apiQuery = submittedSearch.length > 0 ? submittedSearch : undefined;
  const apiSort = `${USER_SORT_FIELD_MAP[sortField]}:${sortDirection}`;
  const otherCompanyUsersEnabled = showOtherCompaniesToggle && showOtherCompanyUsers;

  const {
    users: selectedLegalEntityUsers,
    loading: selectedLegalEntityLoading,
    error: selectedLegalEntityError,
    pagination: selectedLegalEntityPagination,
    refreshUsers: refreshSelectedLegalEntityUsers,
  } = useCompanyUsers(initialUsers, {
    pageNumber: currentPage,
    pageSize: USERS_PER_PAGE,
    sort: apiSort,
    query: apiQuery,
    initialTotalCount,
    initialRequest: {
      pageNumber: 1,
      pageSize: USERS_PER_PAGE,
      sort: INITIAL_PAGE_SORT,
      query: undefined,
    },
    enabled: !otherCompanyUsersEnabled,
  });

  const {
    users: otherCompanyUsers,
    loading: otherCompanyUsersLoading,
    error: otherCompanyUsersError,
    pagination: otherCompanyPagination,
    refreshUsers: refreshOtherCompanyUsers,
  } = useOtherCompanyUsers({
    enabled: otherCompanyUsersEnabled,
    pageNumber: currentPage,
    pageSize: USERS_PER_PAGE,
    sort: apiSort,
    query: apiQuery,
  });

  const users = otherCompanyUsersEnabled ? otherCompanyUsers : selectedLegalEntityUsers;
  const loading = otherCompanyUsersEnabled ? otherCompanyUsersLoading : selectedLegalEntityLoading;
  const error = otherCompanyUsersEnabled ? otherCompanyUsersError : selectedLegalEntityError;
  const pagination = otherCompanyUsersEnabled ? otherCompanyPagination : selectedLegalEntityPagination;
  const refreshActiveUsers = otherCompanyUsersEnabled ? refreshOtherCompanyUsers : refreshSelectedLegalEntityUsers;

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextSubmittedSearch = quickSearch.trim();
    setCurrentPage(1);
    setSubmittedSearch(nextSubmittedSearch);
  };

  const toggleSort = (field: CompanyUserSortField) => {
    setCurrentPage(1);
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    const totalPages = pagination?.totalPages ?? 1;
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const hasActiveSearch = submittedSearch.length > 0;
  const isSearchLoading = loading && hasActiveSearch;

  const handleOtherCompaniesCheckedChange = (checked: boolean | 'indeterminate') => {
    const nextChecked = checked === true;
    setShowOtherCompanyUsers(nextChecked);
    if (nextChecked) {
      setCurrentPage(1);
    }
  };

  return (
    <div className="flex flex-col gap-6 lg:gap-12">
      <div className="flex flex-col items-start gap-6 md:flex-row md:flex-nowrap md:justify-between">
        <H1 className="min-w-0 w-full whitespace-nowrap md:w-auto md:flex-1">{t('heading')}</H1>
        <div className="flex max-w-full shrink-0 flex-nowrap items-center gap-6">
          {showOtherCompaniesToggle ? (
            <span className="flex items-center gap-3">
              <Checkbox
                id={SHOW_OTHER_COMPANY_USERS_CHECKBOX_ID}
                checked={showOtherCompanyUsers}
                onCheckedChange={handleOtherCompaniesCheckedChange}
              />
              <Label
                id={SHOW_OTHER_COMPANY_USERS_LABEL_ID}
                htmlFor={SHOW_OTHER_COMPANY_USERS_CHECKBOX_ID}
                className="text-base leading-6 font-bold text-text-body"
              >
                {t('showOtherCompanies')}
              </Label>
            </span>
          ) : null}
          <UiLink
            type="Link"
            href="/account/users/new"
            variant="buttonPrimary"
            className="font-headlines text-action-button tracking-[var(--desktop-spacing-action-button)] h-12 w-auto shrink-0 whitespace-nowrap"
            iconBefore={<Plus className="size-6" aria-hidden />}
          >
            {t('createButton')}
          </UiLink>
        </div>
      </div>

      <TableCard className="overflow-hidden p-4 min-[768px]:p-4">
        <form className="mb-4 flex flex-wrap gap-4" onSubmit={submitSearch}>
          <div className="relative w-[380px] max-w-full">
            <Input
              type="search"
              value={quickSearch}
              onChange={(event) => {
                setQuickSearch(event.target.value);
              }}
              placeholder={t('searchPlaceholder')}
              className="h-12 appearance-none bg-surface-primary border-border-primary pr-10 [&::-webkit-search-cancel-button]:hidden"
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
        </form>

        {error ? (
          <div className="bg-surface-error border border-border-error text-text-error px-4 py-3 rounded space-y-3">
            <p>{error.message}</p>
            <Button onClick={() => refreshActiveUsers()}>{t('tryAgain')}</Button>
          </div>
        ) : (
          <UsersTable
            users={users}
            loading={loading}
            currentPage={currentPage}
            totalPages={pagination?.totalPages ?? 1}
            onPreviousPage={handlePreviousPage}
            onNextPage={handleNextPage}
            sortField={sortField}
            sortDirection={sortDirection}
            onToggleSort={toggleSort}
            hasActiveSearch={hasActiveSearch}
            onDeleteUser={otherCompanyUsersEnabled ? undefined : onDeleteUser}
            showLegalEntityName={otherCompanyUsersEnabled}
          />
        )}
      </TableCard>
    </div>
  );
}
