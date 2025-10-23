'use client';

import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAI } from '@/hooks/ai/useAI';
import { useCart } from '@/hooks/cart/useCart';
import { useSession } from '@/hooks/session/useSession';
import { formatCurrency } from '@/lib/utils';
import { AICartSummaryData, AIParsedMessage } from '@/platform/integrations/ai/model';

interface AICartSummaryProps {
  className?: string;
}

export function AICartSummary({ className }: AICartSummaryProps) {
  const [summary, setSummary] = useState<AICartSummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const { getCartSummary } = useAI();
  const { session } = useSession();
  const { cart } = useCart();

  const fetchCartSummary = async () => {
    if (!session || !cart) return;

    setLoading(true);
    try {
      const response = await getCartSummary(cart.id, session.siteCode, session.currency, session.language || 'en');

      // Parse the response message to extract cart summary data
      const parsedMessage = JSON.parse(response.message) as AIParsedMessage;
      if (parsedMessage.data) {
        setSummary(parsedMessage.data as AICartSummaryData);
      }
    } catch (error) {
      console.error('Error fetching AI cart summary:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (cart && session) {
      fetchCartSummary();
    }
  }, [cart, session]);

  if (!cart || !session) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          AI Cart Summary
          <Button onClick={fetchCartSummary} disabled={loading} size="small">
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {summary ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Items:</span>
              <Badge variant="secondary">{summary.totalItems}</Badge>
            </div>

            {summary.shops.map((shop, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">{shop.shopName}</h4>
                  <span className="text-sm text-gray-600">{formatCurrency(shop.subtotal, shop.currency)}</span>
                </div>

                <div className="space-y-2">
                  {shop.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{item.name}</span>
                        <Badge variant="outline">Qty: {item.quantity}</Badge>
                      </div>
                      <span>{formatCurrency(item.price, item.currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="border-t pt-4">
              <div className="flex items-center justify-between font-semibold">
                <span>Grand Total:</span>
                <span>{formatCurrency(summary.grandTotal, summary.currency)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500">
            {loading ? 'Loading AI cart summary...' : 'No cart summary available'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
