'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, Inbox, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { type ServiceTicketPriorityKey, dk } from '@/i18n/dynamic-key';
import { Link } from '@/i18n/navigation';
import { useRouter } from '@/i18n/navigation';
import { fetchServiceTickets } from '@/lib/client/servicetickets';
import { getLogger } from '@/lib/logger/use-logger-client';
import { cn } from '@/lib/utils';
import type { ServiceTicket, ServiceTicketType } from '@/platform/services/model/serviceticket';
import {
  AccountListContainer,
  accountTableBadgeCellClass,
  accountTableBadgeHeadClass,
  accountTableHeadClass,
  accountTableHeadRowClass,
  accountTableRowClass,
  shortenId,
} from '../shared/account-list';
import { AccountPageHeader } from '../shared/account-page-header';
import { CreateTicketDialog } from './create-ticket-dialog';
import { formatTicketDate, getPriorityBadgeVariant, isElevatedPriority } from './helpers';
import { TicketStatusBadge } from './ticket-status-badge';

type StatusFilter = 'all' | 'open' | 'closed';
const TICKETS_PER_PAGE = 6;

interface TicketsListProps {
  initialTickets: ServiceTicket[];
  types: ServiceTicketType[];
}

export function TicketsList({ initialTickets, types }: TicketsListProps) {
  const t = useTranslations('account.serviceTickets');
  const tGroups = useTranslations('account.sidebar.groups');
  const locale = useLocale();
  const router = useRouter();

  const [tickets, setTickets] = useState<ServiceTicket[]>(initialTickets);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const fresh = await fetchServiceTickets(locale);
      setTickets(fresh);
    } catch (error) {
      getLogger().error({ err: error }, 'Failed to refresh service tickets');
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, search]);

  const filteredTickets = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (statusFilter === 'open' && ticket.isTerminal) {
        return false;
      }
      if (statusFilter === 'closed' && !ticket.isTerminal) {
        return false;
      }
      if (normalizedSearch.length === 0) {
        return true;
      }
      return (
        ticket.id.toLowerCase().includes(normalizedSearch) ||
        ticket.subject.toLowerCase().includes(normalizedSearch) ||
        (ticket.typeName ?? '').toLowerCase().includes(normalizedSearch)
      );
    });
  }, [tickets, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / TICKETS_PER_PAGE));
  const pageTickets = filteredTickets.slice((currentPage - 1) * TICKETS_PER_PAGE, currentPage * TICKETS_PER_PAGE);

  const statusFilters: StatusFilter[] = ['all', 'open', 'closed'];

  const handleCreated = () => {
    void refresh();
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <AccountPageHeader
        eyebrow={tGroups('selfService')}
        title={t('title')}
        description={t('description')}
        actions={<CreateTicketDialog types={types} onCreated={handleCreated} />}
      />

      <div className="flex flex-col gap-3 min-[768px]:flex-row min-[768px]:items-center min-[768px]:justify-between">
        <div className="inline-flex gap-1 rounded-md bg-surface-image-background p-1">
          {statusFilters.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              className={cn(
                'rounded-sm px-4 py-1.5 text-sm font-medium transition-colors',
                statusFilter === filter
                  ? 'bg-ticket-accent text-ticket-accent-contrast shadow-sm'
                  : 'text-text-on-disabled hover:text-text-headings',
              )}
            >
              {t(`filters.${filter}`)}
            </button>
          ))}
        </div>
        <div className="relative w-full min-[768px]:max-w-[320px]">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('searchPlaceholder')}
            endIcon={loading ? undefined : Search}
            aria-label={t('searchPlaceholder')}
          />
          {loading && (
            <Spinner
              variant="sm"
              color="primary"
              className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
            />
          )}
        </div>
      </div>

      {pageTickets.length === 0 ? (
        <AccountListContainer className="flex flex-col items-center gap-3 border-dashed px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ticket-accent-soft text-ticket-accent">
            <Inbox className="h-6 w-6" />
          </span>
          <p className="text-text-on-disabled">{tickets.length === 0 ? t('empty') : t('noMatches')}</p>
        </AccountListContainer>
      ) : (
        <AccountListContainer>
          <Table>
            <TableHeader>
              <TableRow className={accountTableHeadRowClass}>
                <TableHead className={accountTableHeadClass}>{t('columns.id')}</TableHead>
                <TableHead className={accountTableHeadClass}>{t('columns.subject')}</TableHead>
                <TableHead className={accountTableHeadClass}>{t('columns.type')}</TableHead>
                <TableHead className={accountTableHeadClass}>{t('columns.updated')}</TableHead>
                <TableHead className={accountTableBadgeHeadClass}>{t('columns.priority')}</TableHead>
                <TableHead className={accountTableBadgeHeadClass}>{t('columns.status')}</TableHead>
                <TableHead className={cn(accountTableHeadClass, 'w-[80px] text-center')}>
                  {t('columns.action')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageTickets.map((ticket, index) => {
                const priorityKey = ticket.priority
                  ? dk<ServiceTicketPriorityKey>(`priorities.${ticket.priority.toLowerCase()}`)
                  : null;
                return (
                  <TableRow
                    key={ticket.id}
                    className={accountTableRowClass(index, { clickable: true })}
                    onClick={() => router.push(`/account/tickets/${ticket.id}`)}
                  >
                    <TableCell className="px-2 py-4 font-medium">
                      <span title={ticket.id}>
                        <Link
                          href={`/account/tickets/${ticket.id}`}
                          className="font-bold text-text-action underline hover:text-text-action-hover"
                          onClick={(event) => event.stopPropagation()}
                        >
                          #{shortenId(ticket.id, 4, 4)}
                        </Link>
                      </span>
                    </TableCell>
                    <TableCell className="px-2 py-4 text-text-headings">{ticket.subject}</TableCell>
                    <TableCell className="px-2 py-4">{ticket.typeName || '–'}</TableCell>
                    <TableCell className="whitespace-nowrap px-2 py-4">
                      {formatTicketDate(ticket.updatedAt ?? ticket.createdAt, locale)}
                    </TableCell>
                    <TableCell className={accountTableBadgeCellClass}>
                      {ticket.priority && isElevatedPriority(ticket.priority) && priorityKey ? (
                        <Badge variant={getPriorityBadgeVariant(ticket.priority)} size="status">
                          {t.has(priorityKey) ? t(priorityKey) : ticket.priority}
                        </Badge>
                      ) : (
                        <span className="text-text-placeholders">–</span>
                      )}
                    </TableCell>
                    <TableCell className={accountTableBadgeCellClass}>
                      <TicketStatusBadge ticket={ticket} />
                    </TableCell>
                    <TableCell className="px-2 py-4 text-center" onClick={(event) => event.stopPropagation()}>
                      <Button
                        variant="neutral"
                        size="icon"
                        title={t('columns.action')}
                        aria-label={t('columns.action')}
                        onClick={() => router.push(`/account/tickets/${ticket.id}`)}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {filteredTickets.length > TICKETS_PER_PAGE && (
            <TablePagination
              className="border-t border-border-primary px-4 py-3 sm:px-6"
              currentPage={currentPage}
              totalPages={totalPages}
              pageIndicator={t('pageIndicator', { current: currentPage, total: totalPages })}
              previousLabel={t('previous')}
              nextLabel={t('next')}
              onPreviousPage={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              onNextPage={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            />
          )}
        </AccountListContainer>
      )}
    </div>
  );
}

export default TicketsList;
