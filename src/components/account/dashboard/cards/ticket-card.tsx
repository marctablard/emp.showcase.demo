'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
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
import { cn } from '@/lib/utils';
import { DashboardCard, DashboardCardProps } from './dashboard-card';

// Define the ticket item structure
interface TicketItem {
  id: string;
  ticketNumber: string;
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
  const router = useRouter();

  const { form } = useValidator('TicketSearchValidationService', {
    searchQuery: '',
  });

  const handleSearch = (data: TicketSearchFormData) => {
    console.log('Searching for:', data.searchQuery);
    // Implement search functionality here
  };

  // Default ticket items if none provided
  const defaultItems: TicketItem[] = [
    {
      id: '1',
      ticketNumber: 'EPX-1',
      subject: t('sampleTicketSubjects.delivery'),
      status: 'open',
      date: '2025-06-20',
      priority: 'high',
    },
    {
      id: '2',
      ticketNumber: 'EPX-2',
      subject: t('sampleTicketSubjects.invoice'),
      status: 'pending',
      date: '2025-06-18',
      priority: 'medium',
    },
    {
      id: '3',
      ticketNumber: 'EPX-3',
      subject: t('sampleTicketSubjects.product'),
      status: 'closed',
      date: '2025-06-15',
      priority: 'low',
    },
    {
      id: '4',
      ticketNumber: 'EPX-4',
      subject: t('sampleTicketSubjects.return'),
      status: 'open',
      date: '2025-06-22',
      priority: 'high',
    },
  ];

  const items = customItems || defaultItems;

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
            {items.map((item, index) => (
              <TableRow
                key={item.id}
                className={cn(
                  'hover:bg-surface-image-background cursor-pointer text-base',
                  index % 2 === 0 ? 'bg-surface-page' : 'bg-surface-image-background',
                )}
                onClick={() => router.push(`/account/tickets/${item.id}`)}
              >
                <TableCell className="px-2 py-4">
                  <Badge variant={getStatusBadge(item.status).variant} className="flex items-center gap-1">
                    {t(`status.${item.status}`)}
                  </Badge>
                </TableCell>
                <TableCell className="px-2 py-4 font-medium">
                  <UiLink type="Link" href={`/account/tickets/${item.id}`} variant="primary" size="m">
                    {item.ticketNumber}
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
          {items.length} / {items.length} Tickets
        </div>
      </div>
    </DashboardCard>
  );
}

export default TicketCard;
