'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FormProvider } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import AiStarsIcon from '@/components/icons/ai-stars';
import { Button } from '@/components/ui/button';
import { CardTitle } from '@/components/ui/card';
import { FormControl, FormField, FormItem } from '@/components/ui/form';
import { InputButton } from '@/components/ui/input';
import { useAI } from '@/hooks/ai/useAI';
import { useCart } from '@/hooks/cart/useCart';
import { useSession } from '@/hooks/session/useSession';
import { useValidator } from '@/hooks/validation/useValidator';
import { cn } from '@/lib/utils';
import { AIChatContext } from '@/platform/integrations/ai/model';
import { DashboardCardProps } from './dashboard-card';

type AiHelperFormData = {
  question: string;
};

interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  data?: any;
  type?: string;
}

// Modern Product Card Component
const ProductCard = ({
  product,
  onAddToCart,
}: {
  product: any;
  onAddToCart: (productId: string, quantity: number) => void;
}) => {
  const [quantity, setQuantity] = useState(1);

  const handleAddToCart = () => {
    onAddToCart(product.productId, quantity);
  };

  const incrementQuantity = () => {
    setQuantity((prev) => prev + 1);
  };

  const decrementQuantity = () => {
    setQuantity((prev) => Math.max(1, prev - 1));
  };

  return (
    <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex items-start space-x-4">
        {product.image && (
          <img
            src={product.image}
            alt={product.name}
            className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 text-base mb-1">{product.name}</div>
          {product.brand && <div className="text-sm text-gray-600 mb-2">{product.brand}</div>}
          {product.description && <div className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</div>}
          <div className="flex items-center space-x-3 mb-3">
            {product.price ? (
              <span className="font-semibold text-gray-900 text-base">
                {product.price} {product.currency}
              </span>
            ) : (
              <span className="text-base text-gray-500">Price on request</span>
            )}
            {product.originalPrice && (
              <span className="text-sm text-gray-400 line-through">
                {product.originalPrice} {product.currency}
              </span>
            )}
          </div>
          {product.rating && (
            <div className="text-sm text-gray-500 mb-3">
              ⭐ {product.rating} ({product.reviewCount} reviews)
            </div>
          )}
          <div className="flex items-center space-x-3">
            <div className="flex items-center border border-gray-300 rounded-lg">
              <button
                onClick={decrementQuantity}
                className="px-3 py-2 text-sm hover:bg-gray-100 rounded-l-lg transition-colors"
                disabled={quantity <= 1}
              >
                −
              </button>
              <span className="px-4 py-2 text-sm border-x border-gray-300 bg-gray-50">{quantity}</span>
              <button
                onClick={incrementQuantity}
                className="px-3 py-2 text-sm hover:bg-gray-100 rounded-r-lg transition-colors"
              >
                +
              </button>
            </div>
            <button
              onClick={handleAddToCart}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Product Selection Component
const ProductSelectionComponent = ({
  data,
  setQuestionValue,
  handleQuestionSubmit,
}: {
  data: any;
  setQuestionValue: (question: string) => void;
  handleQuestionSubmit: (data: any) => void;
}) => {
  const [selections, setSelections] = useState<Record<string, { selected: boolean; quantity: number }>>({});

  const handleSelectionChange = (itemId: string, selected: boolean, quantity: number) => {
    setSelections((prev) => ({
      ...prev,
      [itemId]: { selected, quantity },
    }));
  };

  const handleAddSelectedToCart = () => {
    const selectedItems = Object.entries(selections)
      .filter(([_, selection]) => selection.selected)
      .map(([itemId, selection]) => `Add product: ${itemId} with quantity ${selection.quantity} to the cart`)
      .join('; ');

    if (selectedItems) {
      setQuestionValue(selectedItems);
      setTimeout(() => {
        handleQuestionSubmit({ question: selectedItems });
      }, 100);
    }
  };

  return (
    <div>
      <div className="text-sm font-semibold text-gray-700 mb-3">Product Selection:</div>
      <div className="text-sm space-y-4">
        {data.message && <div className="text-gray-600 mb-3">{data.message}</div>}
        {data.product && (
          <div className="p-3 bg-gray-50 rounded border mb-4">
            <div className="font-medium text-gray-800 text-base mb-1">{data.product.name}</div>
            {data.product.description && <div className="text-sm text-gray-600">{data.product.description}</div>}
          </div>
        )}
        {data.variantGroups &&
          data.variantGroups.map((group: any, groupIndex: number) => (
            <div key={groupIndex} className="p-3 bg-white rounded border">
              <div className="font-medium text-gray-800 text-base mb-2">{group.message}</div>
              {group.description && <div className="text-sm text-gray-600 mb-3">{group.description}</div>}
              <div className="space-y-3">
                {group.items &&
                  group.items.map((item: any, itemIndex: number) => (
                    <ProductSelectionItem key={itemIndex} item={item} onSelectionChange={handleSelectionChange} />
                  ))}
              </div>
            </div>
          ))}
        {data.instructions && (
          <div className="text-sm text-gray-600 mt-4 p-3 bg-blue-50 rounded border">{data.instructions}</div>
        )}
        <div className="mt-4">
          <button
            onClick={handleAddSelectedToCart}
            disabled={Object.values(selections).filter((s) => s.selected).length === 0}
            className="w-full px-4 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Add Selected to Cart ({Object.values(selections).filter((s) => s.selected).length} items)
          </button>
        </div>
      </div>
    </div>
  );
};

// Product Selection Item Component
const ProductSelectionItem = ({
  item,
  onSelectionChange,
}: {
  item: any;
  onSelectionChange: (itemId: string, selected: boolean, quantity: number) => void;
}) => {
  const [selected, setSelected] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const handleSelectionChange = (checked: boolean) => {
    setSelected(checked);
    onSelectionChange(item.itemId, checked, quantity);
  };

  const handleQuantityChange = (newQuantity: number) => {
    setQuantity(newQuantity);
    if (selected) {
      onSelectionChange(item.itemId, selected, newQuantity);
    }
  };

  const incrementQuantity = () => {
    handleQuantityChange(quantity + 1);
  };

  const decrementQuantity = () => {
    handleQuantityChange(Math.max(1, quantity - 1));
  };

  return (
    <div className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg">
      <div className="flex-shrink-0 pt-1">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => handleSelectionChange(e.target.checked)}
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start space-x-3">
          {item.image && (
            <img
              src={item.image}
              alt={item.name}
              className="w-16 h-16 object-cover rounded"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-800 text-base mb-1">{item.name}</div>
            {item.description && <div className="text-sm text-gray-600 mb-2">{item.description}</div>}
            <div className="flex items-center space-x-2 mb-2">
              {item.price ? (
                <span className="font-medium text-sm">
                  {item.price} {item.currency}
                </span>
              ) : (
                <span className="text-sm text-gray-500">Price on request</span>
              )}
              {item.availability && (
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    item.availability === 'in_stock' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}
                >
                  {item.availability}
                </span>
              )}
            </div>
            {item.attributes && (
              <div className="text-xs text-gray-500">
                {Object.entries(item.attributes).map(([key, value]) => (
                  <span key={key} className="mr-2">
                    <strong>{key}:</strong> {String(value)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-shrink-0">
        <div className="flex items-center border border-gray-300 rounded">
          <button onClick={decrementQuantity} className="px-2 py-1 text-sm hover:bg-gray-100" disabled={quantity <= 1}>
            -
          </button>
          <span className="px-3 py-1 text-sm border-x border-gray-300">{quantity}</span>
          <button onClick={incrementQuantity} className="px-2 py-1 text-sm hover:bg-gray-100">
            +
          </button>
        </div>
      </div>
    </div>
  );
};

// Render structured data based on response type
const renderStructuredData = (
  type: string,
  data: any,
  setQuestionValue: (question: string) => void,
  handleQuestionSubmit: (data: any) => void,
) => {
  switch (type) {
    case 'cart_summary':
      return (
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="text-base font-semibold text-blue-900 mb-2">Cart Summary</div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="text-blue-700">
                <strong>Total Items:</strong> {data.totalItems}
              </div>
              <div className="text-blue-700">
                <strong>Net Total:</strong> {data.finalNetValue || data.grandTotal} {data.currency}
              </div>
              {data.finalTaxValue && (
                <div className="text-blue-700">
                  <strong>Tax:</strong> {data.finalTaxValue} {data.currency}
                </div>
              )}
              <div className="text-lg font-bold text-blue-900">
                <strong>Grand Total:</strong> {data.finalGrossValue || data.grandTotal} {data.currency}
              </div>
            </div>
          </div>

          {/* Handle new format with items array */}
          {data.items && data.items.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {data.items.map((item: any, itemIndex: number) => (
                <div key={itemIndex}>
                  <div className="p-4 flex items-start space-x-4">
                    {item.image && (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 text-base mb-1">{item.name}</div>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="text-sm text-gray-600 mb-1">
                            Quantity: <span className="font-medium">{item.quantity}</span>
                          </div>
                          <div className="text-sm text-gray-600">
                            Unit:{' '}
                            <span className="font-medium">
                              {item.unitNetValue || item.price} {data.currency}
                            </span>
                            {item.unitGrossValue && item.unitGrossValue !== item.unitNetValue && (
                              <span className="ml-2 text-gray-500">
                                (Gross: {item.unitGrossValue} {data.currency})
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-600 mb-1">
                            Net:{' '}
                            <span className="font-medium">
                              {item.finalNetValue || (item.price * item.quantity).toFixed(2)} {data.currency}
                            </span>
                          </div>
                          <div className="text-lg font-bold text-blue-600">
                            Total: {item.finalGrossValue || (item.price * item.quantity).toFixed(2)} {data.currency}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {itemIndex < data.items.length - 1 && <div className="border-t border-gray-100"></div>}
                </div>
              ))}
            </div>
          )}

          {/* Handle old format with shops array */}
          {data.shops && data.shops.length > 0 && (
            <div className="space-y-4">
              {data.shops.map((shop: any, shopIndex: number) => (
                <div key={shopIndex} className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border">
                    <div className="font-semibold text-gray-800 text-base">{shop.shopName}</div>
                    <div className="text-sm font-medium text-gray-600">
                      Subtotal: {shop.subtotal} {shop.currency}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    {shop.items &&
                      shop.items.map((item: any, itemIndex: number) => (
                        <div key={itemIndex}>
                          <div className="p-4 flex items-start space-x-4">
                            {item.image && (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-gray-900 text-base mb-1">{item.name}</div>
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="text-sm text-gray-600 mb-1">
                                    Quantity: <span className="font-medium">{item.quantity}</span>
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    Unit:{' '}
                                    <span className="font-medium">
                                      {item.unitNetValue || item.price} {item.currency}
                                    </span>
                                    {item.unitGrossValue && item.unitGrossValue !== item.unitNetValue && (
                                      <span className="ml-2 text-gray-500">
                                        (Gross: {item.unitGrossValue} {item.currency})
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm text-gray-600 mb-1">
                                    Net:{' '}
                                    <span className="font-medium">
                                      {(item.price * item.quantity).toFixed(2)} {item.currency}
                                    </span>
                                  </div>
                                  <div className="text-lg font-bold text-blue-600">
                                    Total: {(item.price * item.quantity).toFixed(2)} {item.currency}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          {itemIndex < shop.items.length - 1 && <div className="border-t border-gray-100"></div>}
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Checkout Button */}
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => (window.location.href = '/cart')}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm hover:shadow-md"
            >
              Go to Checkout
            </button>
          </div>
        </div>
      );

    case 'account_details':
      return (
        <div className="space-y-4">
          {data.personalInfo && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center space-x-2 mb-4">
                <h3 className="text-base font-semibold text-gray-900">Account Information</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 text-gray-600">👤</div>
                  <div>
                    <div className="text-xs text-gray-600">Name</div>
                    <div className="text-sm font-medium text-gray-900">{data.personalInfo.name}</div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 text-gray-600">✉️</div>
                  <div>
                    <div className="text-xs text-gray-600">Email</div>
                    <div className="text-sm font-medium text-gray-900">{data.personalInfo.email}</div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 text-gray-600">🏢</div>
                  <div>
                    <div className="text-xs text-gray-600">Company</div>
                    <div className="text-sm font-medium text-gray-900">{data.personalInfo.company}</div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 text-gray-600">💳</div>
                  <div>
                    <div className="text-xs text-gray-600">Customer Number</div>
                    <div className="text-sm font-medium text-gray-900">{data.personalInfo.customerNumber}</div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 text-gray-600">🌐</div>
                  <div>
                    <div className="text-xs text-gray-600">Business Model</div>
                    <div className="text-sm font-medium text-gray-900">{data.personalInfo.businessModel}</div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 text-gray-600">Az</div>
                  <div>
                    <div className="text-xs text-gray-600">Preferred Language</div>
                    <div className="text-sm font-medium text-gray-900">{data.personalInfo.preferredLanguage}</div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 text-gray-600">$</div>
                  <div>
                    <div className="text-xs text-gray-600">Preferred Currency</div>
                    <div className="text-sm font-medium text-gray-900">{data.personalInfo.preferredCurrency}</div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 text-gray-600">📍</div>
                  <div>
                    <div className="text-xs text-gray-600">Preferred Site</div>
                    <div className="text-sm font-medium text-gray-900">{data.personalInfo.preferredSite || 'main'}</div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 text-gray-600">🕐</div>
                  <div>
                    <div className="text-xs text-gray-600">Last Login</div>
                    <div className="text-sm font-medium text-gray-900">
                      {new Date(data.personalInfo.lastLogin).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {data.addresses && data.addresses.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center space-x-2 mb-4">
                <h3 className="text-base font-semibold text-gray-900">Saved Addresses</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.addresses.map((address: any, index: number) => (
                  <div key={index} className="bg-gray-50 rounded-lg border border-gray-200 p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900">{address.name}</h4>
                      </div>
                      {address.isDefault && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Default
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-sm text-gray-700">
                      <div>{address.addressLine1}</div>
                      {address.addressLine2 && <div>{address.addressLine2}</div>}
                      <div>
                        {address.city}, {address.state} {address.postalCode}
                      </div>
                      <div>{address.country}</div>
                    </div>

                    {address.tags && address.tags.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <div className="flex items-center space-x-1">
                          <span className="text-gray-600 text-xs">🔖</span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            {address.tags.join(', ')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );

    case 'order_list':
      return (
        <div className="space-y-4">
          {data.orders &&
            data.orders.map((order: any, index: number) => (
              <div
                key={index}
                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200"
              >
                {/* Order Header */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <a
                          href={`/account/orders/${order.orderId || order.orderNumber}`}
                          className="text-blue-600 hover:text-blue-800 font-semibold text-lg underline"
                        >
                          #{order.orderNumber}
                        </a>
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                            order.status?.toUpperCase() === 'COMPLETED'
                              ? 'bg-green-100 text-green-800'
                              : order.status?.toUpperCase() === 'CONFIRMED'
                                ? 'bg-orange-100 text-orange-800'
                                : order.status?.toUpperCase() === 'CREATED'
                                  ? 'bg-gray-100 text-gray-800'
                                  : order.status?.toUpperCase() === 'PENDING'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : order.status?.toUpperCase() === 'CANCELLED'
                                      ? 'bg-red-100 text-red-800'
                                      : order.status?.toUpperCase() === 'IN_CHECKOUT'
                                        ? 'bg-gray-100 text-gray-800'
                                        : order.status?.toUpperCase() === 'PROCESSING'
                                          ? 'bg-orange-100 text-orange-800'
                                          : order.status?.toUpperCase() === 'READY_FOR_PICKUP'
                                            ? 'bg-orange-100 text-orange-800'
                                            : order.status?.toUpperCase() === 'READY_FOR_SHIPPING'
                                              ? 'bg-orange-100 text-orange-800'
                                              : order.status?.toUpperCase() === 'SHIPPED'
                                                ? 'bg-green-100 text-green-800'
                                                : order.status?.toUpperCase() === 'DELIVERED'
                                                  ? 'bg-green-100 text-green-800'
                                                  : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-500">📅</span>
                          <span className="font-medium">{new Date(order.date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-500">📦</span>
                          <span className="font-medium">{order.itemCount} items</span>
                        </div>
                        {order.shopName && (
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-500">🏪</span>
                            <span className="font-medium">{order.shopName}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">
                        {order.finalGrossValue} {order.currency}
                      </div>
                      <div className="text-sm text-gray-600">
                        Net: {order.finalNetValue} {order.currency} | Tax: {order.finalTaxValue} {order.currency}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                {order.items && order.items.length > 0 && (
                  <div className="p-4">
                    <div className="text-sm font-semibold text-gray-700 mb-3">Order Items:</div>
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      {order.items.map((item: any, itemIndex: number) => (
                        <div key={itemIndex}>
                          <div className="p-4 flex items-start space-x-4">
                            {item.image && (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <a
                                href={`/product/${item.id}`}
                                className="font-semibold text-gray-900 text-base hover:text-blue-600 transition-colors"
                              >
                                {item.name}
                              </a>
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="text-sm text-gray-600 mb-1">
                                    Quantity: <span className="font-medium">{item.quantity}</span>
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    Unit:{' '}
                                    <span className="font-medium">
                                      {item.unitNetValue || item.price} {order.currency}
                                    </span>
                                    {item.unitGrossValue && item.unitGrossValue !== item.unitNetValue && (
                                      <span className="ml-2 text-gray-500">
                                        (Gross: {item.unitGrossValue} {order.currency})
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm text-gray-600 mb-1">
                                    Net:{' '}
                                    <span className="font-medium">
                                      {item.finalNetValue || (item.price * item.quantity).toFixed(2)} {order.currency}
                                    </span>
                                  </div>
                                  <div className="text-lg font-bold text-blue-600">
                                    Total: {item.finalGrossValue || (item.price * item.quantity).toFixed(2)}{' '}
                                    {order.currency}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          {itemIndex < order.items.length - 1 && <div className="border-t border-gray-100"></div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
        </div>
      );

    case 'product_list':
      return (
        <div className="space-y-4">
          {data.context && <div className="text-gray-600 mb-4 text-base">{data.context}</div>}
          {data.products &&
            data.products.map((product: any, index: number) => (
              <ProductCard
                key={index}
                product={product}
                onAddToCart={(productId: string, quantity: number) => {
                  // Set the input value and trigger the submit handler directly
                  const message = `Add product: ${productId} with quantity ${quantity} to the cart`;
                  setQuestionValue(message);

                  // Call the submit handler directly instead of submitting the form
                  setTimeout(() => {
                    handleQuestionSubmit({ question: message });
                  }, 100);
                }}
              />
            ))}
        </div>
      );

    case 'product_selection':
      return (
        <ProductSelectionComponent
          data={data}
          setQuestionValue={setQuestionValue}
          handleQuestionSubmit={handleQuestionSubmit}
        />
      );

    case 'address_list':
      return (
        <div className="text-sm space-y-3">
          {data.message && <div className="text-gray-600 mb-3">{data.message}</div>}
          {data.addresses &&
            data.addresses.map((address: any, index: number) => (
              <div key={index} className="p-3 bg-white rounded border">
                <div className="font-medium text-gray-800 text-base">{address.name}</div>
                {address.company && <div className="text-sm text-gray-600">{address.company}</div>}
                <div className="text-sm">
                  <div>{address.addressLine1}</div>
                  {address.addressLine2 && <div>{address.addressLine2}</div>}
                  <div>
                    {address.city}, {address.state} {address.postalCode}
                  </div>
                  <div>{address.country}</div>
                </div>
                {address.tags && address.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {address.tags.map((tag: string, tagIndex: number) => (
                      <span key={tagIndex} className="text-sm px-2 py-1 bg-blue-100 text-blue-800 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      );

    case 'action_buttons':
      return (
        <div className="text-sm space-y-3">
          {data.message && <div className="text-gray-600 mb-3">{data.message}</div>}
          <div className="flex flex-wrap gap-2">
            {data.buttons &&
              data.buttons.map((button: any, index: number) => (
                <button
                  key={index}
                  className={`px-4 py-2 text-sm rounded ${
                    button.style === 'primary'
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : button.style === 'danger'
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  onClick={() => {
                    if (button.action === 'send_message') {
                      // Handle sending message
                      console.log('Send message:', button.message);
                    } else if (button.action === 'link') {
                      // Handle link navigation
                      window.open(button.url, '_blank');
                    }
                  }}
                >
                  {button.label}
                </button>
              ))}
          </div>
        </div>
      );

    case 'error':
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-red-600 text-sm">⚠️</span>
              </div>
            </div>
            <div className="flex-1">
              <div className="font-semibold text-red-900 text-base mb-1">{data.errorCode || 'Error'}</div>
              <div className="text-red-700 text-sm mb-2">{data.message}</div>
              {data.details && <div className="text-red-600 text-sm mb-3">{data.details}</div>}
              {data.canRetry && (
                <button
                  onClick={() => {
                    const retryMessage = 'Please try again';
                    setQuestionValue(retryMessage);
                    setTimeout(() => {
                      handleQuestionSubmit({ question: retryMessage });
                    }, 100);
                  }}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        </div>
      );

    default:
      return (
        <div className="text-sm text-gray-600">
          <pre className="text-sm bg-white p-3 rounded border overflow-x-auto">{JSON.stringify(data, null, 2)}</pre>
        </div>
      );
  }
};

/**
 * AI Helper Card component
 * Shows AI-assisted helper prompts for common questions
 */
function AiHelperCard({ className, title, ...props }: Omit<DashboardCardProps, 'children'>) {
  const t = useTranslations('account.AiHelper');
  const { form } = useValidator('AiHelperValidationService', {
    question: '',
  });

  // AI and session hooks
  const { sendMessageWithContext, loading, error } = useAI();
  const { session } = useSession();
  const { cart, refetch: refetchCart } = useCart();

  // Chat state with persistence
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('ai-helper-chat-messages');
        if (saved) {
          const parsedMessages = JSON.parse(saved);
          // Ensure it's an array and convert timestamp strings back to Date objects
          if (Array.isArray(parsedMessages)) {
            return parsedMessages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp),
            }));
          }
        }
      } catch (error) {
        console.error('Error loading chat messages from localStorage:', error);
        // Clear corrupted data
        localStorage.removeItem('ai-helper-chat-messages');
      }
      return [];
    }
    return [];
  });
  const [isChatMode, setIsChatMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ai-helper-chat-mode');
      return saved === 'true';
    }
    return false;
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Persist messages to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai-helper-chat-messages', JSON.stringify(messages));
    }
  }, [messages]);

  // Persist chat mode to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai-helper-chat-mode', isChatMode.toString());
    }
  }, [isChatMode]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollContainerRef.current && isChatMode) {
      // Use a small delay to ensure the DOM has updated
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [messages, isChatMode]);

  const handleQuestionSubmit = async (data: AiHelperFormData) => {
    if (!data.question.trim() || !session) return;

    // Add user message to chat
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: data.question,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsChatMode(true);

    try {
      // Get or create AI-specific session ID
      let aiSessionId = '';
      if (typeof window !== 'undefined') {
        aiSessionId = localStorage.getItem('ai-helper-session-id') || crypto.randomUUID();
        localStorage.setItem('ai-helper-session-id', aiSessionId);
        console.log('AI Helper Session ID:', aiSessionId);
      }

      // Create AI context
      const context: AIChatContext = {
        siteId: session.siteCode,
        currency: session.currency,
        language: session.language || 'en',
        sessionId: aiSessionId,
        cartId: cart?.id,
      };

      // Send message to AI
      const aiResponse = await sendMessageWithContext(data.question, context);

      // Parse the AI response
      let responseContent = aiResponse.message;
      let responseData = null;
      let responseType = 'text';

      try {
        // Remove markdown code block wrappers if present
        let messageToParse = aiResponse.message;
        if (messageToParse.startsWith('```json\n') && messageToParse.endsWith('\n```')) {
          messageToParse = messageToParse.slice(7, -4); // Remove ```json\n and \n```
        } else if (messageToParse.startsWith('```\n') && messageToParse.endsWith('\n```')) {
          messageToParse = messageToParse.slice(4, -4); // Remove ```\n and \n```
        }

        const parsedMessage = JSON.parse(messageToParse);
        if (parsedMessage.message) {
          responseContent = parsedMessage.message;
        }
        if (parsedMessage.data) {
          responseData = parsedMessage.data;
        }
        if (parsedMessage.type) {
          responseType = parsedMessage.type;
        }
      } catch {
        // If parsing fails, use the raw message
      }

      // Add AI response to chat
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: responseContent,
        isUser: false,
        timestamp: new Date(),
        data: responseData,
        type: responseType,
      };

      setMessages((prev) => [...prev, aiMessage]);

      // Refresh cart if the response is a cart summary
      if (responseType === 'cart_summary') {
        try {
          await refetchCart();
        } catch (error) {
          console.error('Error refreshing cart after AI response:', error);
        }
      }
    } catch (err) {
      console.error('Error sending AI message:', err);
      // Add error message to chat
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I encountered an error. Please try again.',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }

    form.reset();
  };

  const setQuestionValue = (question: string) => {
    form.setValue('question', question);
  };

  const clearChat = () => {
    setMessages([]);
    setIsChatMode(false);
    // Clear localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ai-helper-chat-messages');
      localStorage.removeItem('ai-helper-chat-mode');
      // Generate a new session ID for the next conversation
      localStorage.setItem('ai-helper-session-id', crypto.randomUUID());
    }
  };

  return (
    <div
      className={cn('flex flex-col h-96 bg-white rounded-xl border shadow-sm overflow-hidden', className)}
      {...props}
    >
      <div className="p-4 pb-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <AiStarsIcon className="flex-shrink-0" />
            <CardTitle
              className="text-4xl font-bold"
              style={{
                background: 'linear-gradient(0deg, #094782 0%, #0F77D9 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {title || t('title')}
            </CardTitle>
          </div>
          {isChatMode && (
            <Button variant="secondary" size="small" onClick={clearChat} className="text-sm">
              Clear Chat
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 px-4">
        {/* Chat Messages Area */}
        {isChatMode && (
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto border rounded-lg p-4 bg-gray-50 mb-4 scroll-smooth"
          >
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">Start a conversation with the AI assistant</div>
            ) : (
              <div className="space-y-4">
                {Array.isArray(messages) &&
                  messages.map((message) => (
                    <div key={message.id} className={cn('flex', message.isUser ? 'justify-end' : 'justify-start')}>
                      <div
                        className={cn(
                          'rounded-lg px-4 py-2',
                          message.isUser
                            ? 'bg-blue-500 text-white max-w-[80%]'
                            : message.data && message.type
                              ? 'bg-white border border-gray-200 w-full max-w-none'
                              : 'bg-white border border-gray-200 max-w-[80%]',
                        )}
                      >
                        <div className="text-base whitespace-pre-wrap">{message.content}</div>

                        {/* Display structured data if available */}
                        {message.data && message.type && (
                          <div className="mt-3 w-full max-w-none">
                            {renderStructuredData(message.type, message.data, setQuestionValue, handleQuestionSubmit)}
                          </div>
                        )}

                        <div className={cn('text-sm mt-1', message.isUser ? 'text-blue-100' : 'text-gray-500')}>
                          {message.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                        <span className="text-base text-gray-500">AI is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        )}

        {/* Suggestions (only in initial state) */}
        {!isChatMode && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                type="button"
                className="text-left px-3 py-2 bg-neutral-100 rounded-md hover:bg-neutral-200 transition-colors inline-block"
                onClick={() => setQuestionValue(t('suggestions.openInvoices'))}
              >
                <span className="text-base font-medium">{t('suggestions.openInvoices')}</span>
              </button>
              <button
                type="button"
                className="text-left px-3 py-2 bg-neutral-100 rounded-md hover:bg-neutral-200 transition-colors inline-block"
                onClick={() => setQuestionValue(t('suggestions.availableOffers'))}
              >
                <span className="text-base font-medium">{t('suggestions.availableOffers')}</span>
              </button>
              <button
                type="button"
                className="text-left px-3 py-2 bg-neutral-100 rounded-md hover:bg-neutral-200 transition-colors inline-block"
                onClick={() => setQuestionValue(t('suggestions.recentPurchases'))}
              >
                <span className="text-base font-medium">{t('suggestions.recentPurchases')}</span>
              </button>
            </div>
          </div>
        )}

        {/* Input Field - Always at bottom */}
        <div className="bg-white border-t border-gray-200 pt-4 pb-4">
          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(handleQuestionSubmit)}>
              <FormField
                control={form.control}
                name="question"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <InputButton
                        placeholder={isChatMode ? 'Type your message...' : t('placeholder')}
                        buttonText={loading ? 'Sending...' : isChatMode ? 'Send' : t('buttonText')}
                        disabled={loading}
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </form>
          </FormProvider>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="px-4 pb-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-red-600 text-sm">Error: {error.message}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export { AiHelperCard };
