'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp, ChevronsUpDown, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import UiLink from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { useRouter } from '@/i18n/navigation';
import { formatDate } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import type { CompanyUser } from '@/platform/services/model/user-management/company-user';

/**
 * Sortable company-user columns. User Group is IAM-joined (not sortable).
 * Legal Entity Name is display-only (not sortable). Actions has no sortable data.
 * Created maps to raw `metadataCreatedAt`.
 */
export type CompanyUserSortField = 'firstName' | 'lastName' | 'contactEmail' | 'metadataCreatedAt' | 'active';

/** Raw upstream fields backing each sortable column. */
export const USER_SORT_FIELD_MAP: Record<CompanyUserSortField, string> = {
  firstName: 'firstName',
  lastName: 'lastName',
  contactEmail: 'contactEmail',
  metadataCreatedAt: 'metadataCreatedAt',
  active: 'active',
};

interface UsersTableProps {
  users: CompanyUser[];
  loading?: boolean;
  currentPage?: number;
  totalPages?: number;
  onPreviousPage?: () => void;
  onNextPage?: () => void;
  sortField?: CompanyUserSortField;
  sortDirection?: 'asc' | 'desc';
  onToggleSort?: (field: CompanyUserSortField) => void;
  hasActiveSearch?: boolean;
  onDeleteUser?: (user: CompanyUser) => void;
  /** Combined Admin-LE view: insert Legal Entity Name after Last Name. */
  showLegalEntityName?: boolean;
}

const BASE_COLUMN_COUNT = 7;
/** Wide enough for seven nowrap columns without `table-fixed` overlap. */
const TABLE_MIN_WIDTH_CLASS = 'min-w-[1124px]';
/** Extra width for the Legal Entity Name column. */
const TABLE_MIN_WIDTH_WITH_LEGAL_ENTITY_CLASS = 'min-w-[1372px]';
/** Desktop/heading/h6 via existing `text-2xl` + `font-headlines` tokens (Ubuntu 700 16/20). */
const TABLE_HEADER_TYPE_CLASS = 'font-headlines text-2xl font-bold text-text-headings';
const CELL_CLASS = 'px-2 py-4 whitespace-nowrap cursor-pointer';
const TABLE_WIDTH_TRANSITION_CLASS = 'transition-[min-width] duration-300 ease-in-out';

function isContactGroupDisplayName(displayName: string): boolean {
  const normalizedDisplayName = displayName.trim().toLowerCase();
  return normalizedDisplayName.endsWith('contact') || normalizedDisplayName.includes(' - contact');
}

function formatUserGroupNames(user: CompanyUser, contactOnlyLabel: string): string {
  const names = user.groups
    .map((group) => group.displayName.trim())
    .filter((name) => name !== '' && !isContactGroupDisplayName(name));
  if (names.length > 0) {
    return names.join(', ');
  }
  return contactOnlyLabel;
}

function getCompanyUserRowKey(user: CompanyUser): string {
  return user.legalEntityId ? `${user.id}-${user.legalEntityId}` : user.id;
}

function UserStatusBadge({ active }: Readonly<{ active: boolean }>) {
  const t = useTranslations('user-management');

  return (
    <Badge variant={active ? 'success' : 'destructive'} size="status">
      {active ? t('status.active') : t('status.inactive')}
    </Badge>
  );
}

export function UsersTable({
  users,
  loading = false,
  currentPage = 1,
  totalPages = 1,
  onPreviousPage,
  onNextPage,
  sortField = 'firstName',
  sortDirection = 'asc',
  onToggleSort,
  hasActiveSearch = false,
  onDeleteUser,
  showLegalEntityName = false,
}: Readonly<UsersTableProps>) {
  const t = useTranslations('user-management');
  const locale = useLocale();
  const router = useRouter();
  const contactOnlyLabel = t.raw('form.contactOnly');
  const columnCount = showLegalEntityName ? BASE_COLUMN_COUNT + 1 : BASE_COLUMN_COUNT;

  const getSortIcon = (field: CompanyUserSortField) => {
    if (loading && sortField === field) {
      return <Spinner variant="sm" color="primary" className="h-4 w-4" loadingText={t('loading')} />;
    }
    if (sortField !== field) return <ChevronsUpDown className="h-4 w-4 text-text-on-disabled" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const getSortAriaSort = (field: CompanyUserSortField): 'none' | 'ascending' | 'descending' => {
    if (sortField !== field) return 'none';
    return sortDirection === 'asc' ? 'ascending' : 'descending';
  };

  const renderSortableHead = (field: CompanyUserSortField, label: string, className: string) => (
    <TableHead className={cn(TABLE_HEADER_TYPE_CLASS, className)} aria-sort={getSortAriaSort(field)}>
      <button
        type="button"
        onClick={() => onToggleSort?.(field)}
        disabled={!onToggleSort}
        className={cn('flex items-center gap-2 hover:text-text-action', TABLE_HEADER_TYPE_CLASS)}
      >
        {label}
        {getSortIcon(field)}
      </button>
    </TableHead>
  );

  return (
    <>
      <div className={`transition-opacity ${loading ? 'opacity-70' : 'opacity-100'}`} aria-busy={loading}>
        <Table
          containerClassName="min-w-0 overflow-x-auto overflow-y-clip pr-1"
          className={cn(
            'w-full',
            TABLE_WIDTH_TRANSITION_CLASS,
            showLegalEntityName ? TABLE_MIN_WIDTH_WITH_LEGAL_ENTITY_CLASS : TABLE_MIN_WIDTH_CLASS,
          )}
        >
          <TableHeader>
            <TableRow className={TABLE_HEADER_TYPE_CLASS}>
              {renderSortableHead('firstName', t('columns.firstName'), '!h-14 w-[140px]')}
              {renderSortableHead('lastName', t('columns.lastName'), '!h-14 w-[140px]')}
              {showLegalEntityName ? (
                <TableHead className={cn(TABLE_HEADER_TYPE_CLASS, '!h-14')}>{t('columns.legalEntityName')}</TableHead>
              ) : null}
              {renderSortableHead('contactEmail', t('columns.email'), '!h-14')}
              {renderSortableHead('metadataCreatedAt', t('columns.created'), '!h-14')}
              <TableHead className={cn(TABLE_HEADER_TYPE_CLASS, '!h-14')}>{t('columns.userGroup')}</TableHead>
              {renderSortableHead('active', t('columns.status'), '!h-14')}
              <TableHead className={cn(TABLE_HEADER_TYPE_CLASS, '!h-14 w-[72px]')}>{t('columns.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(() => {
              if (!loading && users.length === 0) {
                return (
                  <TableRow>
                    <TableCell colSpan={columnCount} className="h-24 text-center">
                      {hasActiveSearch ? t('noResults') : t('empty')}
                    </TableCell>
                  </TableRow>
                );
              }

              return users.map((user, index) => {
                const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.id;
                const editHref = `/account/users/${user.id}`;
                const userGroupNames = formatUserGroupNames(user, contactOnlyLabel);
                const openEdit = () => {
                  router.push(editHref);
                };

                return (
                  <TableRow
                    key={getCompanyUserRowKey(user)}
                    className={cn(
                      'text-base cursor-pointer',
                      index % 2 === 0 ? 'bg-surface-page' : 'bg-surface-image-background',
                    )}
                    onClick={openEdit}
                  >
                    <TableCell className={CELL_CLASS}>{user.firstName}</TableCell>
                    <TableCell className={CELL_CLASS}>{user.lastName}</TableCell>
                    {showLegalEntityName ? <TableCell className={CELL_CLASS}>{user.legalEntityName}</TableCell> : null}
                    <TableCell className={CELL_CLASS}>{user.contactEmail}</TableCell>
                    <TableCell className={CELL_CLASS}>
                      {user.createdAt ? formatDate(user.createdAt, locale) : '-'}
                    </TableCell>
                    <TableCell className={CELL_CLASS}>{userGroupNames}</TableCell>
                    <TableCell className={CELL_CLASS}>
                      <UserStatusBadge active={user.active} />
                    </TableCell>
                    <TableCell
                      className="px-2 py-4 whitespace-nowrap"
                      onClick={(event) => {
                        event.stopPropagation();
                      }}
                    >
                      <div className="flex items-center gap-6">
                        {onDeleteUser ? (
                          <button
                            type="button"
                            className="text-icon-neutral hover:text-text-action rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                            aria-label={t('deleteAriaLabel', { name: displayName })}
                            onClick={(event) => {
                              event.stopPropagation();
                              onDeleteUser(user);
                            }}
                          >
                            <Trash2 className="size-6" aria-hidden />
                          </button>
                        ) : null}
                        <UiLink
                          type="Link"
                          href={editHref}
                          variant="clean"
                          className="text-icon-neutral hover:text-text-action"
                          aria-label={t('editAriaLabel', { name: displayName })}
                        >
                          <Pencil className="size-6" aria-hidden />
                        </UiLink>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              });
            })()}
          </TableBody>
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
