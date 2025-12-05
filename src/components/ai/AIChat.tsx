'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAI } from '@/hooks/ai/useAI';
import { useCart } from '@/hooks/cart/useCart';
import { useSession } from '@/hooks/session/useSession';
import { prepareAIContext } from '@/lib/client/ai';
import { useCartStore } from '@/providers/StoreProvider';

interface AIChatProps {
  className?: string;
}

export function AIChat({ className }: AIChatProps) {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const { sendMessageWithContext, loading, error } = useAI();
  const { session } = useSession();
  const { refetch: refetchCart } = useCart();
  const cartStore = useCartStore();

  const handleSendMessage = async () => {
    if (!message.trim() || !session) return;

    try {
      // Prepare AI context with fresh cart and session ID
      const context = await prepareAIContext(session, cartStore);

      // Log AI request with cart info
      const currentCart = cartStore.getCurrentCart();
      console.log(
        'AI Chat Request:',
        JSON.stringify(
          {
            userMessage: message,
            context,
            cartInfo: {
              hasCart: !!currentCart,
              cartId: context.cartId,
              cartState: currentCart ? 'exists' : 'null/undefined',
            },
          },
          null,
          2,
        ),
      );

      const aiResponse = await sendMessageWithContext(message, context);
      setResponse(aiResponse.message);

      // Refresh cart if cartRefresh is true
      if (aiResponse.cartRefresh) {
        try {
          await refetchCart();
        } catch {
          // Silently fail - cart refresh is not critical
        }
      }
    } catch (err) {
      console.error('Error sending AI message:', err);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>AI Assistant</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything about your cart or products..."
            disabled={loading}
          />
          <Button onClick={handleSendMessage} disabled={loading || !message.trim()} className="w-full">
            {loading ? 'Sending...' : 'Send Message'}
          </Button>
        </div>

        {error && <div className="text-red-600 text-sm">Error: {error.message}</div>}

        {response && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold mb-2">AI Response:</h4>
            <pre className="whitespace-pre-wrap text-sm">{response}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
