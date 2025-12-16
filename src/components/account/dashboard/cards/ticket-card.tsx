'use client';

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, CheckCheck, CircleAlert, Clock, MoveRight } from 'lucide-react';
import { Search } from 'lucide-react';
import { CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/dashboard-badge';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { H4 } from '@/components/ui/h';
import { Input } from '@/components/ui/input';
import UiLink from '@/components/ui/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useValidator } from '@/hooks/validation/useValidator';
import { RawServiceTicket, fetchServiceTickets } from '@/lib/client/servicetickets';
import { cn } from '@/lib/utils';
import { DashboardCard, DashboardCardProps } from './dashboard-card';
import { SupportTicketDialog } from './support-ticket-dialog';

// Define the ticket item structure
interface TicketItem {
  id: string;
  ticketNumber: string;
  ticketName: string;
  subject: string;
  status: 'open' | 'pending' | 'closed';
  date: string;
  priority: 'high' | 'medium' | 'low';
}

type TicketSearchFormData = {
  searchQuery: string;
};

interface TicketCardProps extends Omit<DashboardCardProps, 'children'> {
  items?: TicketItem[];
}

export function TicketCard({ className, title, items: customItems, ...props }: TicketCardProps) {
  const t = useTranslations('account.Tickets');
  const locale = useLocale();

  const { form } = useValidator('TicketSearchValidationService', {
    searchQuery: '',
  });

  const handleSearch = (data: TicketSearchFormData) => {
    console.log('Searching for:', data.searchQuery);
    // Implement search functionality here
  };

  const [items, setItems] = React.useState<TicketItem[]>(customItems || []);
  const [isLoading, setIsLoading] = React.useState<boolean>(!customItems);
  const [error, setError] = React.useState<string | null>(null);
  const [rawTickets, setRawTickets] = React.useState<RawServiceTicket[]>([]);
  const [dialogOpen, setDialogOpen] = React.useState<boolean>(false);
  const [selectedTicket, setSelectedTicket] = React.useState<RawServiceTicket | null>(null);

  const mapTickets = React.useCallback(
    (raw: RawServiceTicket[]): TicketItem[] => {
      const useGerman = locale.startsWith('de');
      const mapped = raw.map((ticket) => {
        const normalizedStatus = (ticket.Status || 'open').trim().toLowerCase();
        const status: TicketItem['status'] =
          normalizedStatus === 'open'
            ? 'open'
            : normalizedStatus === 'in progress' || normalizedStatus === 'pending'
              ? 'pending'
              : normalizedStatus === 'closed' || normalizedStatus === 'resolved'
                ? 'closed'
                : 'open';
        const subject = useGerman
          ? ticket.SubjectName.de || ticket.Description.de || ticket.SubjectName.en || ticket.Description.en || '—'
          : ticket.SubjectName.en || ticket.Description.en || ticket.SubjectName.de || ticket.Description.de || '—';
        const preferredName = ticket.TicketName || ticket.TicketID;
        const priority: TicketItem['priority'] = status === 'open' ? 'high' : status === 'pending' ? 'medium' : 'low';
        const date = ticket.CreatedAt || new Date().toISOString();
        return {
          id: ticket.TicketID,
          ticketNumber: ticket.TicketID,
          ticketName: preferredName,
          subject,
          status,
          date,
          priority,
        };
      });
      mapped.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return mapped;
    },
    [locale],
  );

  React.useEffect(() => {
    if (customItems && customItems.length > 0) return;
    let cancelled = false;
    setIsLoading(true);
    fetchServiceTickets()
      .then((data) => {
        if (cancelled) return;
        setRawTickets(data);
        setItems(mapTickets(data));
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message || 'Failed to load tickets');
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshTickets = React.useCallback(async () => {
    if (customItems && customItems.length > 0) return;
    try {
      setIsLoading(true);
      const data = await fetchServiceTickets();
      setRawTickets(data);
      setItems(mapTickets(data));
    } catch (e: any) {
      setError(e?.message || 'Failed to load tickets');
    } finally {
      setIsLoading(false);
    }
  }, [customItems, mapTickets]);

  // Get the appropriate status badge variant
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return { variant: 'default' as const, icon: <CircleAlert className="h-3 w-3" /> };
      case 'pending':
        return { variant: 'warning' as const, icon: <Clock className="h-3 w-3" /> };
      case 'closed':
        return { variant: 'success' as const, icon: <CheckCheck className="h-3 w-3" /> };
      default:
        return { variant: 'default' as const, icon: <CircleAlert className="h-3 w-3" /> };
    }
  };

  // Function to format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  };

  return (
    <DashboardCard variant="default" className={cn('py-4 pb-0', className)} {...props}>
      <div className="flex items-center justify-between mb-4">
        <CardTitle>
          <H4>{title || t('title')}</H4>
        </CardTitle>
        <UiLink type="Link" href="/account/tickets" variant="primary" size="m" iconAfter={<ArrowRight />}>
          {t('viewAll')}
        </UiLink>
      </div>
      {/* search */}
      <div className="mb-4 w-[60%]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSearch)} className="w-full">
            <FormField
              control={form.control}
              name="searchQuery"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder={t('search.placeholder')} endIcon={Search} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </div>
      <div className="flex flex-col">
        {error && <div className="text-sm text-red-600 px-2 py-1">{error}</div>}
        <Table>
          <TableHeader>
            <TableRow className="text-base ">
              <TableHead className="w-[120px] font-bold">{t('columns.status')}</TableHead>
              <TableHead className="w-[120px] font-bold">{t('columns.ticketNumber')}</TableHead>
              <TableHead className="w-[120px] font-bold">{t('columns.date')}</TableHead>
              <TableHead className="font-bold">{t('columns.subject')}</TableHead>
              <TableHead className="w-[40px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(isLoading ? [] : items).map((item, index) => (
              <TableRow
                key={item.id}
                className={cn(
                  'hover:bg-surface-image-background cursor-pointer text-base',
                  index % 2 === 0 ? 'bg-surface-page' : 'bg-surface-image-background',
                )}
                onClick={() => {
                  const ticket = rawTickets.find((rt) => rt.TicketID === item.id) || null;
                  setSelectedTicket(ticket);
                  setDialogOpen(true);
                }}
              >
                <TableCell className="px-2 py-4">
                  <Badge variant={getStatusBadge(item.status).variant} className="flex items-center gap-1">
                    {t(`status.${item.status}`)}
                  </Badge>
                </TableCell>
                <TableCell className="px-2 py-4 font-medium">
                  <UiLink
                    type="Button"
                    href="#"
                    variant="primary"
                    size="m"
                    onClick={() => {
                      const ticket = rawTickets.find((rt) => rt.TicketID === item.id) || null;
                      setSelectedTicket(ticket);
                      setDialogOpen(true);
                    }}
                  >
                    {item.ticketName || item.ticketNumber}
                  </UiLink>
                </TableCell>
                <TableCell className="px-2 py-4">{formatDate(item.date)}</TableCell>
                <TableCell className="px-2 py-4">{item.subject}</TableCell>
                <TableCell className="px-2 py-4">
                  <MoveRight className="h-4 w-4" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end  p-2">
        <div className="flex items-center gap-1 text-sm font-medium">
          {isLoading ? 0 : items.length} / {isLoading ? 0 : items.length} Tickets
        </div>
      </div>
      <SupportTicketDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        ticket={selectedTicket}
        showTriggerButton={false}
      />
      {/* Always show a separate "New Service Ticket" button below the list */}
      <div className="mt-2 flex justify-end">
        <SupportTicketDialog
          ticket={null}
          onSubmit={() => {
            void refreshTickets();
          }}
        />
      </div>
    </DashboardCard>
  );
}

export default TicketCard;
