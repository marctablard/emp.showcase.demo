'use client';

import React, { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowRight, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { H4 } from '@/components/ui/h';
import { Input } from '@/components/ui/input';
import UiLink from '@/components/ui/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useValidator } from '@/hooks/validation/useValidator';
import { type InvoiceStatusKey, dk } from '@/i18n/dynamic-key';
import { getPublicDefaultCurrency } from '@/lib/common/public-default-env';
import { getLogger } from '@/lib/logger/use-logger-client';
import { cn } from '@/lib/utils';
import type { DashboardCardProps } from './dashboard-card';
import { DashboardCard } from './dashboard-card';

type InvoiceSearchFormData = {
  searchQuery: string;
};

// Invoice interface for mock data
interface Invoice {
  id: string;
  invoiceNumber: string;
  status: 'OPEN' | 'OVERDUE' | 'PAID';
  invoiceDate: string;
  dueDate: string;
  billingDate: string;
  value: {
    total: number;
    currency: string;
  };
  orderReference?: string;
}

interface MyInvoicesCardProps extends Omit<DashboardCardProps, 'children'> {
  className?: string;
}

export function MyInvoicesCard({ className, title, ...props }: MyInvoicesCardProps) {
  const t = useTranslations('orders.Invoices');
  const router = useRouter();

  const { form } = useValidator('InvoiceSearchValidationService', {
    defaultValues: {
      searchQuery: '',
    },
  });

  const onSubmit = (data: InvoiceSearchFormData) => {
    getLogger().debug({ searchQuery: data.searchQuery }, 'Searching invoices with query');
    // Here would go the actual search logic
  };

  // Generate mock invoice data
  const mockInvoices: Invoice[] = useMemo(() => {
    const currency = getPublicDefaultCurrency();
    return [
      {
        id: '1',
        invoiceNumber: 'INV-2025-001',
        status: 'PAID',
        invoiceDate: '2025-05-15',
        dueDate: '2025-06-15',
        billingDate: '2025-05-15',
        value: {
          total: 256.78,
          currency,
        },
        orderReference: 'ORD-28746',
      },
      {
        id: '2',
        invoiceNumber: 'INV-2025-002',
        status: 'OPEN',
        invoiceDate: '2025-05-28',
        dueDate: '2025-06-28',
        billingDate: '2025-05-28',
        value: {
          total: 189.99,
          currency,
        },
        orderReference: 'ORD-29845',
      },
      {
        id: '3',
        invoiceNumber: 'INV-2025-003',
        status: 'OVERDUE',
        invoiceDate: '2025-04-10',
        dueDate: '2025-05-10',
        billingDate: '2025-04-10',
        value: {
          total: 534.5,
          currency,
        },
        orderReference: 'ORD-27632',
      },
      {
        id: '4',
        invoiceNumber: 'INV-2025-004',
        status: 'PAID',
        invoiceDate: '2025-05-02',
        dueDate: '2025-06-02',
        billingDate: '2025-05-02',
        value: {
          total: 99.95,
          currency,
        },
        orderReference: 'ORD-28532',
      },
      {
        id: '5',
        invoiceNumber: 'INV-2025-005',
        status: 'OPEN',
        invoiceDate: '2025-06-01',
        dueDate: '2025-07-01',
        billingDate: '2025-06-01',
        value: {
          total: 345.2,
          currency,
        },
        orderReference: 'ORD-30126',
      },
      {
        id: '6',
        invoiceNumber: 'INV-2025-006',
        status: 'PAID',
        invoiceDate: '2025-06-10',
        dueDate: '2025-07-10',
        billingDate: '2025-06-10',
        value: {
          total: 125.75,
          currency,
        },
        orderReference: 'ORD-30458',
      },
      {
        id: '7',
        invoiceNumber: 'INV-2025-007',
        status: 'OVERDUE',
        invoiceDate: '2025-03-25',
        dueDate: '2025-04-25',
        billingDate: '2025-03-25',
        value: {
          total: 420.3,
          currency,
        },
        orderReference: 'ORD-26987',
      },
    ];
  }, []);

  const invoices = mockInvoices;

  const getInvoiceStatusVariant = (status: string): BadgeVariant => {
    switch (status) {
      case 'OPEN':
        return 'outline';
      case 'OVERDUE':
        return 'warning';
      case 'PAID':
        return 'success';
      default:
        return 'outline';
    }
  };

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'dd.MM.yyyy');
  };

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const invoicesPerPage = 5;

  // Get paginated invoices
  const visibleInvoices = useMemo(() => {
    if (!invoices) return [];
    const startIndex = (currentPage - 1) * invoicesPerPage;
    const endIndex = startIndex + invoicesPerPage;
    return invoices
      .slice()
      .sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime())
      .slice(startIndex, endIndex);
  }, [invoices, currentPage, invoicesPerPage]);

  // Pagination handlers
  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    if (invoices) {
      const maxPage = Math.ceil(invoices.length / invoicesPerPage);
      setCurrentPage((prev) => Math.min(prev + 1, maxPage));
    }
  };

  return (
    <DashboardCard variant="default" className={cn('py-4 pb-0', className)} {...props}>
      <div className="flex justify-between items-center mb-4">
        <CardTitle>
          <H4>{title || t('title')}</H4>
        </CardTitle>
        <UiLink href="/account/invoices" type="Button" className="text-base flex items-center">
          {t('showAllInvoices')} <ArrowRight className="w-4 h-4 ml-1" />
        </UiLink>
      </div>
      <div className="w-[60%]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mb-4">
            <FormField
              control={form.control}
              name="searchQuery"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder={t('search.placeholder')} className="pl-8" endIcon={Search} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="text-base">
              <TableHead className="w-[120px] font-bold">{t('columns.invoiceNumber')}</TableHead>
              <TableHead className="font-bold">{t('columns.status')}</TableHead>
              <TableHead className="font-bold">{t('columns.invoiceDate')}</TableHead>
              <TableHead className="font-bold">{t('columns.dueDate')}</TableHead>
              <TableHead className="font-bold">{t('columns.billingDate')}</TableHead>
              <TableHead className="text-right font-bold">{t('columns.orderValue')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleInvoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  {t('noInvoices')}
                </TableCell>
              </TableRow>
            ) : (
              visibleInvoices.map((invoice, index) => (
                <TableRow
                  key={invoice.id}
                  className={cn(
                    'cursor-pointer text-base',
                    index % 2 === 0 ? 'bg-surface-page' : 'bg-surface-image-background',
                  )}
                  onClick={() => router.push(`/account/invoices/${invoice.id}`)}
                >
                  <TableCell className="font-medium px-2 py-4">
                    <UiLink href={`/account/invoice/${invoice.id}`} type="Button">
                      {invoice.invoiceNumber}
                    </UiLink>
                  </TableCell>
                  <TableCell className="px-2 py-4">
                    <Badge variant={getInvoiceStatusVariant(invoice.status)} size="status">
                      {t(dk<InvoiceStatusKey>(`status.${invoice.status.toLowerCase()}`))}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-2 py-4">{formatDate(invoice.invoiceDate)}</TableCell>
                  <TableCell className="px-2 py-4">{formatDate(invoice.dueDate)}</TableCell>
                  <TableCell className="px-2 py-4">{formatDate(invoice.billingDate)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {invoice.value.total} {invoice.value.currency}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end p-3">
        <div className="flex items-center justify-between mt-2">
          {invoices && invoices.length > invoicesPerPage && (
            <div className="flex items-center space-x-6">
              {currentPage > 1 && (
                <Button variant="neutral" size="small" onClick={handlePreviousPage}>
                  <ChevronLeft className="h-4 w-4" />
                  {t('previous')}
                </Button>
              )}
              <span className="text-sm">
                {currentPage * invoicesPerPage} / {invoices?.length || 0}
              </span>
              {currentPage < Math.ceil(invoices.length / invoicesPerPage) && (
                <Button variant="neutral" size="small" onClick={handleNextPage}>
                  {t('next')} <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardCard>
  );
}
