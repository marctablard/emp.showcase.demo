import { AICartSummary, AIChat } from '@/components/ai';

export default function AIDemoPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">AI Integration Demo</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h2 className="text-xl font-semibold mb-4">AI Chat Assistant</h2>
            <AIChat />
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">AI Cart Summary</h2>
            <AICartSummary />
          </div>
        </div>

        <div className="mt-8 p-6 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">How to Use</h3>
          <div className="space-y-2 text-sm text-gray-700">
            <p>
              • <strong>AI Chat:</strong> Ask questions about your cart, products, or get help with shopping
            </p>
            <p>
              • <strong>Cart Summary:</strong> Get AI-generated summaries of your current cart contents
            </p>
            <p>
              • <strong>Context Aware:</strong> The AI has access to your session, cart, and site information
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
