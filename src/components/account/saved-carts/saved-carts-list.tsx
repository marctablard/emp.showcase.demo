'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, Search } from 'lucide-react';
import { SavedCartsTable } from '@/components/account/saved-carts/saved-carts-table';
import { CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { H4 } from '@/components/ui/h';
import { Input } from '@/components/ui/input';
import UiLink from '@/components/ui/link';
import { useCart } from '@/hooks/cart/useCart';
import { useSavedCarts } from '@/hooks/cart/useSavedCarts';
import { useToast } from '@/hooks/ui/useToast';
import { useValidator } from '@/hooks/validation/useValidator';
import { cn } from '@/lib/utils';
import { DashboardCard, DashboardCardProps } from '../dashboard/cards/dashboard-card';

type SavedCartSearchFormData = {
  searchQuery: string;
};

interface SavedCartsListProps extends Omit<DashboardCardProps, 'children'> {
  className?: string;
  isModal?: boolean;
  onClose?: () => void;
}

export function SavedCartsList({ className, title, isModal = false, onClose, ...props }: SavedCartsListProps) {
  const t = useTranslations('savedCarts');
  const { toast } = useToast();
  const { loadCart } = useCart();

  const { form } = useValidator('SavedCartSearchValidationService', {
    searchQuery: '',
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(0);
  const cartsPerPage = 5;

  // Fetch saved carts from the hook
  const { savedCarts, loading, error, fetchSavedCarts, hasNextPage, hasPreviousPage } = useSavedCarts({
    initialPageSize: cartsPerPage,
  });

  // Fetch fresh saved carts data when component mounts
  useEffect(() => {
    fetchSavedCarts(currentPage, cartsPerPage);
  }, [fetchSavedCarts, currentPage, cartsPerPage]);

  const handleSearch = (data: SavedCartSearchFormData) => {
    console.log('Searching for:', data.searchQuery);
    // Implement search functionality here
  };

  // Pagination handlers
  const handlePreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (hasNextPage) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleLoadCart = async (cartId: string) => {
    try {
      await loadCart(cartId);
      toast({
        title: 'Cart loaded successfully',
        description: 'Your saved cart has been loaded',
        variant: 'success',
      });
      if (isModal && onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Error loading cart:', error);
      toast({
        title: 'Failed to load cart',
        description: 'There was an error loading your saved cart',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteCart = async (cartId: string) => {
    // This would be implemented with a delete cart API
    console.log('Delete cart:', cartId);
    toast({
      title: 'Cart deleted',
      description: 'Your saved cart has been deleted',
      variant: 'success',
    });
    // Refresh the list
    fetchSavedCarts(currentPage, cartsPerPage);
  };

  // If there's an error, display it
  if (error) {
    return (
      <DashboardCard variant="default" className={cn('py-4', className)} {...props}>
        <div className="text-center py-4 text-text-error">{t('errorMessage')}</div>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard variant="default" className={cn('py-4', className)} {...props}>
      <div className="flex items-center justify-between mb-4">
        <CardTitle>
          <H4>{title || t('mySavedCarts')}</H4>
        </CardTitle>
        {!isModal && (
          <UiLink type="Link" href="/account/saved-carts" variant="primary" size="m" iconAfter={<ArrowRight />}>
            {t('showAllSavedCarts')}
          </UiLink>
        )}
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
        <SavedCartsTable
          carts={savedCarts?.items || []}
          currentPage={currentPage}
          cartsPerPage={cartsPerPage}
          loading={loading}
          onPreviousPage={handlePreviousPage}
          onNextPage={handleNextPage}
          onLoadCart={handleLoadCart}
          onDeleteCart={handleDeleteCart}
          hasNextPage={hasNextPage}
          hasPreviousPage={hasPreviousPage}
        />
      </div>
    </DashboardCard>
  );
}
