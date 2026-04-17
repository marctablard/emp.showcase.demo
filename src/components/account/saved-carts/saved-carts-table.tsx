'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import type { Cart } from '@/platform/services/model/cart/cart';

interface SavedCartsTableProps {
  carts: Cart[];
  currentPage: number;
  cartsPerPage: number;
  loading: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onLoadCart: (cartId: string) => void;
  onDeleteCart: (cartId: string) => void;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export function SavedCartsTable({
  carts,
  loading,
  onPreviousPage,
  onNextPage,
  onLoadCart,
  onDeleteCart,
  hasNextPage,
  hasPreviousPage,
}: SavedCartsTableProps) {
  const t = useTranslations('cart.savedCarts');

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-text-action" />
        <span className="ml-2">{t('loadingMessage')}</span>
      </div>
    );
  }

  if (!carts || carts.length === 0) {
    return <div className="text-center py-8">{t('empty')}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('table.id')}</TableHead>
              <TableHead>{t('table.items')}</TableHead>
              <TableHead>{t('table.total')}</TableHead>
              <TableHead className="text-right">{t('table.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {carts.map((cart) => (
              <TableRow key={cart.id}>
                <TableCell className="font-medium">{cart.id}</TableCell>
                <TableCell>{cart.items.length}</TableCell>
                <TableCell>
                  {cart.totalPrice ? formatCurrency(cart.totalPrice.amount, cart.totalPrice.currency) : '-'}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="primary" size="default" onClick={() => onLoadCart(cart.id)}>
                    {t('loadCart')}
                  </Button>
                  <Button variant="red" size="default" onClick={() => onDeleteCart(cart.id)}>
                    {t('deleteCart')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end space-x-2">
        <Button variant="neutral" size="default" onClick={onPreviousPage} disabled={!hasPreviousPage}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>
        <Button variant="neutral" size="default" onClick={onNextPage} disabled={!hasNextPage}>
          Next
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
