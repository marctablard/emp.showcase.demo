'use client';

import { type FormEvent, useEffect, useLayoutEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Search } from 'lucide-react';
import { USERS_PER_PAGE } from '@/components/account/account-table-constants';
import { Button } from '@/components/ui/button';
import { H1 } from '@/components/ui/h';
import { Input } from '@/components/ui/input';
import UiLink from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import { TableCard } from '@/components/ui/table';
import { releaseNavigationWaitCursorLease, useGlobalCursor } from '@/hooks/common/useGlobalCursor';
import { usePersistedState } from '@/hooks/common/usePersistedState';
import { useSession } from '@/hooks/session/useSession';
import { useCompanyUsers, useOtherCompanyUsers } from '@/hooks/user-management/useCompanyUsers';
import { isAuthenticatedSessionCustomerId } from '@/lib/common/customer-identity';
import type { CompanyUser } from '@/platform/services/model/user-management/company-user';
import { CompanyScopeToggle } from './company-scope-toggle';
import { DeleteUserDialog } from './delete-user-dialog';
import { type CompanyUserSortField, USER_SORT_FIELD_MAP, UsersTable } from './users-table';

const INITIAL_PAGE_SORT = 'firstName:asc';
const SHOW_OTHER_COMPANY_USERS_PENDING_OWNER_ID = 'pending';
const COMPANY_USER_SORT_FIELDS = new Set<CompanyUserSortField>([
  'firstName',
  'lastName',
  'contactEmail',
  'metadataCreatedAt',
  'active',
]);

export type UsersListSortState = {
  field: CompanyUserSortField;
  direction: 'asc' | 'desc';
};

export const DEFAULT_USERS_LIST_SORT: UsersListSortState = {
  field: 'firstName',
  direction: 'asc',
};

export function showOtherCompanyUsersStorageKey(ownerId: string): string {
  return `user-management.v1:${encodeURIComponent(ownerId)}:showOtherCompanyUsers`;
}

export function usersListSortStorageKey(ownerId: string): string {
  return `user-management.v1:${encodeURIComponent(ownerId)}:sort`;
}

export function deserializeShowOtherCompanyUsers(raw: string): boolean {
  try {
    return JSON.parse(raw) === true;
  } catch {
    return false;
  }
}

export function canManageSelectedCompanyUsers(
  adminLegalEntityIds: string[] | undefined,
  legalEntityId: string | undefined,
): boolean {
  if (adminLegalEntityIds === undefined) {
    return true;
  }
  const sessionLegalEntityId = typeof legalEntityId === 'string' ? legalEntityId.trim() : '';
  return sessionLegalEntityId.length > 0 && adminLegalEntityIds.includes(sessionLegalEntityId);
}

/**
 * Current / All companies is Admin-LE scope only. Hide it when the session
 * company is not an Admin LE, or when the customer is Admin of only one LE.
 * `showOtherCompaniesToggle` is the fallback when admin ids are not passed.
 */
export function canShowCompanyScopeToggle(
  adminLegalEntityIds: string[] | undefined,
  canManageSelectedCompany: boolean,
  showOtherCompaniesToggle: boolean,
): boolean {
  if (!canManageSelectedCompany) {
    return false;
  }
  if (adminLegalEntityIds === undefined) {
    return showOtherCompaniesToggle;
  }
  return adminLegalEntityIds.length > 1;
}

export function deserializeUsersListSort(raw: string): UsersListSortState {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return DEFAULT_USERS_LIST_SORT;
    }
    const { field, direction } = parsed as Record<string, unknown>;
    if (
      typeof field === 'string' &&
      COMPANY_USER_SORT_FIELDS.has(field as CompanyUserSortField) &&
      (direction === 'asc' || direction === 'desc')
    ) {
      return { field: field as CompanyUserSortField, direction };
    }
    return DEFAULT_USERS_LIST_SORT;
  } catch {
    return DEFAULT_USERS_LIST_SORT;
  }
}

interface CompanyUsersListView {
  users: CompanyUser[];
  loading: boolean;
  error: Error | null;
  pagination?: {
    pageNumber: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
  };
  refreshUsers: () => Promise<void>;
}

function toCompanyUsersListView(
  users: CompanyUser[],
  loading: boolean,
  error: Error | null,
  pagination: CompanyUsersListView['pagination'],
  refreshUsers: () => Promise<void>,
): CompanyUsersListView {
  return { users, loading, error, pagination, refreshUsers };
}

interface UsersListProps {
  initialUsers?: CompanyUser[];
  initialTotalCount?: number;
  onDeleteUser?: (user: CompanyUser) => void;
  showOtherCompaniesToggle?: boolean;
  selectedCompanyName?: string;
  headerCompanies?: Array<{ id: string; name: string }>;
  adminLegalEntityIds?: string[];
}

export function UsersList({
  initialUsers,
  initialTotalCount,
  onDeleteUser,
  showOtherCompaniesToggle = false,
  selectedCompanyName: selectedCompanyNameProp,
  headerCompanies = [],
  adminLegalEntityIds,
}: Readonly<UsersListProps>) {
  const t = useTranslations('user-management');
  const { session } = useSession();
  const sessionLegalEntityId = typeof session?.legalEntityId === 'string' ? session.legalEntityId.trim() : '';
  const canManageSelectedCompany = canManageSelectedCompanyUsers(adminLegalEntityIds, sessionLegalEntityId);
  const selectedCompanyName =
    headerCompanies.find((company) => company.id === sessionLegalEntityId)?.name ?? selectedCompanyNameProp;
  const showScopeToggle = canShowCompanyScopeToggle(
    adminLegalEntityIds,
    canManageSelectedCompany,
    showOtherCompaniesToggle,
  );
  const [isClient, setIsClient] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [quickSearch, setQuickSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [userToDelete, setUserToDelete] = useState<CompanyUser | null>(null);

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
  const [sort, setSort] = usePersistedState<UsersListSortState>({
    key: usersListSortStorageKey(ownerId ?? SHOW_OTHER_COMPANY_USERS_PENDING_OWNER_ID),
    defaultValue: DEFAULT_USERS_LIST_SORT,
    storage: 'sessionStorage',
    enabled: persistEnabled,
    deserialize: deserializeUsersListSort,
  });
  const { field: sortField, direction: sortDirection } = sort;

  const apiQuery = submittedSearch.length > 0 ? submittedSearch : undefined;
  const apiSort = `${USER_SORT_FIELD_MAP[sortField]}:${sortDirection}`;
  const otherCompanyUsersEnabled = showScopeToggle && showOtherCompanyUsers;

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
    enabled: !otherCompanyUsersEnabled && canManageSelectedCompany,
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

  const selectedLegalEntityView = toCompanyUsersListView(
    selectedLegalEntityUsers,
    selectedLegalEntityLoading,
    selectedLegalEntityError,
    selectedLegalEntityPagination,
    refreshSelectedLegalEntityUsers,
  );
  const otherCompanyView = toCompanyUsersListView(
    otherCompanyUsers,
    otherCompanyUsersLoading,
    otherCompanyUsersError,
    otherCompanyPagination,
    refreshOtherCompanyUsers,
  );
  const {
    users,
    loading,
    error,
    pagination,
    refreshUsers: refreshActiveUsers,
  } = otherCompanyUsersEnabled ? otherCompanyView : selectedLegalEntityView;
  useGlobalCursor(loading);
  useLayoutEffect(() => {
    if (!loading) {
      releaseNavigationWaitCursorLease({ force: true });
    }
  }, [loading]);

  const applySubmittedSearch = (rawQuery: string) => {
    const nextSubmittedSearch = rawQuery.trim();
    setCurrentPage(1);
    setSubmittedSearch(nextSubmittedSearch);
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    applySubmittedSearch(quickSearch);
  };

  const handleSearchBlur = () => {
    applySubmittedSearch(quickSearch);
  };

  const handleDeleteUser = (user: CompanyUser) => {
    if (onDeleteUser) {
      onDeleteUser(user);
      return;
    }
    setUserToDelete(user);
  };

  const toggleSort = (field: CompanyUserSortField) => {
    setCurrentPage(1);
    setSort((prev) => {
      if (prev.field === field) {
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: 'asc' };
    });
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

  const handleShowAllCompaniesChange = (showAllCompanies: boolean) => {
    setShowOtherCompanyUsers(showAllCompanies);
    if (showAllCompanies) {
      setCurrentPage(1);
    }
  };

  const notAdminInCompanyMessage = t('notifications.notAdminInCompany', {
    company: selectedCompanyName?.trim() || t('currentCompany'),
  });

  return (
    <div className="flex flex-col gap-6 lg:gap-12">
      <div className="flex min-w-0 flex-col items-start gap-4 md:flex-row md:flex-wrap md:items-start md:justify-between">
        <div className="flex min-w-0 max-w-full flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-center md:flex-1">
          <H1 className="min-w-0">{t('heading')}</H1>
          {showScopeToggle ? (
            <CompanyScopeToggle
              currentCompanyName={selectedCompanyName}
              showAllCompanies={showOtherCompanyUsers}
              onShowAllCompaniesChange={handleShowAllCompaniesChange}
            />
          ) : null}
        </div>
        {canManageSelectedCompany ? (
          <UiLink
            type="Link"
            href="/account/users/new"
            variant="buttonPrimary"
            className="font-headlines text-action-button tracking-[var(--desktop-spacing-action-button)] h-12 w-auto shrink-0 self-start whitespace-nowrap md:ml-auto"
            iconBefore={<Plus className="size-6" aria-hidden />}
          >
            {t('createButton')}
          </UiLink>
        ) : null}
      </div>

      {!canManageSelectedCompany ? (
        <p role="status" className="text-text-secondary">
          {notAdminInCompanyMessage}
        </p>
      ) : (
        <TableCard className="overflow-hidden p-4 min-[768px]:p-4">
          <form className="mb-4 flex flex-wrap gap-4" onSubmit={submitSearch}>
            <div className="relative w-[380px] max-w-full">
              <Input
                type="search"
                value={quickSearch}
                onChange={(event) => {
                  setQuickSearch(event.target.value);
                }}
                onBlur={handleSearchBlur}
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
              <Button
                onClick={() => {
                  Promise.resolve(refreshActiveUsers()).catch(() => undefined);
                }}
              >
                {t('tryAgain')}
              </Button>
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
              onDeleteUser={otherCompanyUsersEnabled ? undefined : handleDeleteUser}
              showLegalEntityName={otherCompanyUsersEnabled}
            />
          )}
        </TableCard>
      )}
      {canManageSelectedCompany && !otherCompanyUsersEnabled && !onDeleteUser ? (
        <DeleteUserDialog
          user={userToDelete}
          open={userToDelete !== null}
          onOpenChange={(open) => {
            if (!open) setUserToDelete(null);
          }}
          onDeleted={() => {
            setUserToDelete(null);
            refreshActiveUsers().catch(() => undefined);
          }}
        />
      ) : null}
    </div>
  );
}

export function AccountUsersList(props: Readonly<Omit<UsersListProps, 'onDeleteUser'>>) {
  return <UsersList {...props} />;
}
