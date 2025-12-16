'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { AlertCircle, CheckCircle, Clock, Package, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { H3 } from '@/components/ui/h';
import { Skeleton } from '@/components/ui/skeleton';
import { useTracking } from '@/hooks/order/useTracking';
import { TrackingInfo } from '@/platform/services/model/tracking';

interface TrackingDialogProps {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog component that displays tracking information for an order
 */
export function TrackingDialog({ orderId, open, onOpenChange }: TrackingDialogProps) {
  const tTracking = useTranslations('orders.Tracking');
  // Only fetch tracking data when dialog is open to prevent unnecessary re-renders
  const { trackingInfo, loading, error, refetch } = useTracking({ orderId });

  // Fetch data when dialog opens
  useEffect(() => {
    if (orderId && open) {
      refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId]);

  // Status icon mapping
  const getStatusIcon = (status: TrackingInfo['status']) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-6 w-6 text-icon-secondary" />;
      case 'IN_TRANSIT':
        return <Truck className="h-6 w-6 text-icon-information" />;
      case 'OUT_FOR_DELIVERY':
        return <Package className="h-6 w-6 text-icon-information" />;
      case 'DELIVERED':
        return <CheckCircle className="h-6 w-6 text-icon-success" />;
      case 'EXCEPTION':
        return <AlertCircle className="h-6 w-6 text-icon-error" />;
      default:
        return <Package className="h-6 w-6" />;
    }
  };

  // Status badge color mapping
  const getStatusBadgeVariant = (status: TrackingInfo['status']) => {
    switch (status) {
      case 'PENDING':
        return 'secondary';
      case 'IN_TRANSIT':
        return 'information';
      case 'OUT_FOR_DELIVERY':
        return 'information';
      case 'DELIVERED':
        return 'success';
      case 'EXCEPTION':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  // Format date from ISO string
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'PPp');
    } catch (_e) {
      return dateString;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tTracking('trackingInformation')}</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}

        {error && (
          <div className="p-4 text-center">
            <AlertCircle className="h-10 w-10 text-text-error mx-auto mb-2" />
            <p className="text-text-error">{tTracking('errorFetchingTracking')}</p>
          </div>
        )}

        {!loading && !error && trackingInfo && (
          <div className="space-y-6">
            {/* Carrier and status information */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <p className="font-medium text-sm text-text-placeholders">{tTracking('carrier')}</p>
                <p className="font-semibold">{trackingInfo.carrier.name}</p>
                <p className="text-sm">
                  {tTracking('trackingNumber')}: {trackingInfo.carrier.trackingNumber}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(trackingInfo.status)}
                <Badge variant={getStatusBadgeVariant(trackingInfo.status) as any}>
                  {tTracking(trackingInfo.status.toLowerCase())}
                </Badge>
              </div>
            </div>

            {/* Estimated delivery */}
            {trackingInfo.estimatedDelivery && (
              <div className="bg-surface-disabled p-4 rounded-md">
                <H3 className="mb-1">{tTracking('estimatedDelivery')}</H3>
                <p>
                  {format(new Date(trackingInfo.estimatedDelivery.date), 'PPP')}
                  {trackingInfo.estimatedDelivery.timeWindow && (
                    <span className="ml-1">
                      {tTracking('between')} {trackingInfo.estimatedDelivery.timeWindow.from} -{' '}
                      {trackingInfo.estimatedDelivery.timeWindow.to}
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Tracking timeline */}
            <div>
              <H3 className="font-medium mb-3">{tTracking('trackingHistory')}</H3>
              <div className="space-y-4">
                {trackingInfo.events.map((event, index) => (
                  <div key={index} className="relative pl-6 pb-4">
                    {/* Timeline connector */}
                    {index < trackingInfo.events.length - 1 && (
                      <div className="absolute left-[9px] top-3 h-full w-[2px] bg-text-placeholders"></div>
                    )}

                    {/* Timeline dot */}
                    <div className="absolute left-0 top-1.5 h-[18px] w-[18px] rounded-full border-2 border-border-action bg-surface-page"></div>

                    {/* Event content */}
                    <div>
                      <p className="font-medium">{tTracking(event.status)}</p>
                      <p className="text-sm text-text-placeholders">{formatDate(event.timestamp)}</p>
                      <p className="text-sm">{event.location}</p>
                      {event.description && (
                        <p className="text-sm text-text-placeholders mt-1">{tTracking(event.description)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* External tracking link */}
            {trackingInfo.carrier.trackingUrl && (
              <div className="pt-2 text-center">
                <Button variant="secondary" onClick={() => window.open(trackingInfo.carrier.trackingUrl, '_blank')}>
                  {tTracking('viewOnCarrierWebsite')}
                </Button>
              </div>
            )}

            {/* Last updated timestamp */}
            <p className="text-sm text-center text-text-placeholders">
              {tTracking('lastUpdated')}: {formatDate(trackingInfo.lastUpdated)}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
