/**
 * Dynamic translation key helpers for next-intl strict typing.
 *
 * ## Why these exist
 *
 * With the `AppConfig.Messages` augmentation in `global.ts`, next-intl rejects
 * any key that TypeScript cannot verify as an exact string literal present in
 * the messages JSON.  When a key is built at **runtime** — from API data,
 * template literals with variables, or `.toLowerCase()` transforms — TypeScript
 * can only infer `string` (or a template-literal type like `` `status.${string}` ``),
 * which is too wide to match the union of concrete keys.
 *
 * ## Approach
 *
 * Instead of using `any`, we define **explicit union types** for each namespace
 * where dynamic keys are used. The `dk()` function casts a runtime string to
 * the specified union type so `t()` accepts it without `any`.
 *
 * ## When to use
 *
 * ```ts
 * // ✅ Key constructed from runtime data — specify the target union
 * tWeather(dk<WeatherKey>(hour.description))
 * tOrderStatus(dk<OrderStatusKey>(order.status))
 * t(dk<OrderPaymentTypeKey>(`paymentTypes.${method.toLowerCase()}`))
 *
 * // ❌ Static keys — use the literal directly (TypeScript will verify it)
 * t('columns.orderNumber')
 * ```
 *
 * ## Preferred alternatives
 *
 * When the set of dynamic values is **known at compile time**, prefer narrowing
 * instead of casting:
 *
 * ```ts
 * const KEYS = ['a', 'b', 'c'] as const;
 * KEYS.map(key => t(`prefix.${key}`)); // TypeScript verifies each literal
 * ```
 *
 * @see https://github.com/amannn/next-intl/issues/1521
 * @see https://next-intl.dev/docs/workflows/typescript
 */

// ---------------------------------------------------------------------------
// Dynamic key cast — narrows `string` to a specific key union type `K`
// ---------------------------------------------------------------------------

/**
 * Cast a runtime string to an explicit translation key union type.
 *
 * @typeParam K - the union of allowed keys for the target namespace
 * @param key - the dynamically constructed translation key
 * @returns the same string, typed as `K`
 */
export function dk<K extends string>(key: string): K {
  return key as K;
}

// ---------------------------------------------------------------------------
// Namespace: account.Weather
// Used by: weather-card.tsx, solar-output-card.tsx
// ---------------------------------------------------------------------------
export type WeatherKey =
  | 'loading'
  | 'precipitation'
  | 'humidity'
  | 'wind'
  | 'mainLocation'
  | 'changeLocation'
  | 'error'
  | 'clearSky'
  | 'mainlyClear'
  | 'partlyCloudy'
  | 'overcast'
  | 'fog'
  | 'depositingRimeFog'
  | 'lightDrizzle'
  | 'moderateDrizzle'
  | 'denseDrizzle'
  | 'lightFreezingDrizzle'
  | 'denseFreezingDrizzle'
  | 'slightRain'
  | 'moderateRain'
  | 'heavyRain'
  | 'lightFreezingRain'
  | 'heavyFreezingRain'
  | 'slightSnowFall'
  | 'moderateSnowFall'
  | 'heavySnowFall'
  | 'snowGrains'
  | 'slightRainShowers'
  | 'moderateRainShowers'
  | 'violentRainShowers'
  | 'slightSnowShowers'
  | 'heavySnowShowers'
  | 'thunderstorm'
  | 'thunderstormWithSlightHail'
  | 'thunderstormWithHeavyHail'
  | 'unknown';

// ---------------------------------------------------------------------------
// Namespace: orders.OrderStatus
// Used by: order-status-badge.tsx, order-confirmation.tsx
// ---------------------------------------------------------------------------
export type OrderStatusKey = 'IN_CHECKOUT' | 'CREATED' | 'CONFIRMED' | 'SHIPPED' | 'COMPLETED' | 'DECLINED';

// ---------------------------------------------------------------------------
// Namespace: orders  (sub-path: status.*)
// Used by: my-orders-table.tsx, my-invoices-card.tsx
// ---------------------------------------------------------------------------
export type OrderStatusLowercaseKey =
  | 'status.in_checkout'
  | 'status.created'
  | 'status.confirmed'
  | 'status.processing'
  | 'status.ready_for_pickup'
  | 'status.ready_for_shipping'
  | 'status.shipped'
  | 'status.delivered'
  | 'status.completed'
  | 'status.cancelled';

// ---------------------------------------------------------------------------
// Namespace: orders  (sub-path: paymentTypes.*)
// Used by: my-orders-table.tsx
// ---------------------------------------------------------------------------
export type OrderPaymentTypeKey =
  | 'paymentTypes.creditcard'
  | 'paymentTypes.paypal'
  | 'paymentTypes.invoice'
  | 'paymentTypes.prepayment';

// ---------------------------------------------------------------------------
// Namespace: orders.Tracking
// Used by: tracking-dialog.tsx
// ---------------------------------------------------------------------------
export type TrackingKey =
  | 'trackingInformation'
  | 'carrier'
  | 'trackingNumber'
  | 'estimatedDelivery'
  | 'trackingHistory'
  | 'lastUpdated'
  | 'viewOnCarrierWebsite'
  | 'errorFetchingTracking'
  | 'between'
  | 'pending'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'exception'
  | 'orderProcessed'
  | 'packageReceived'
  | 'inTransit'
  | 'outForDelivery'
  | 'inTransitNextCarrier'
  | 'inTransitCarrierFacility'
  | 'exceptionNoRecipient';

// ---------------------------------------------------------------------------
// Namespace: orders.Invoices  (sub-path: status.*)
// Used by: my-invoices-card.tsx
// ---------------------------------------------------------------------------
export type InvoiceStatusKey = 'status.open' | 'status.overdue' | 'status.paid';

// ---------------------------------------------------------------------------
// Namespace: checkout.PaymentModes
// Used by: checkout-payment.tsx, order-confirmation.tsx, payment-method.tsx,
//          order-detail.tsx, order-cards.tsx
// ---------------------------------------------------------------------------
export type PaymentModeKey = 'creditCard' | 'paypal' | 'invoice' | 'none';

// ---------------------------------------------------------------------------
// Namespace: account.quoteStatus
// Used by: quote-status-badge.tsx
// ---------------------------------------------------------------------------
export type QuoteStatusKey =
  | 'requested'
  | 'available'
  | 'in_progress'
  | 'declined'
  | 'accepted'
  | 'order_created'
  | 'creating'
  | 'closed'
  | 'open';

// ---------------------------------------------------------------------------
// Namespace: common.Languages
// Used by: header-language-switcher.tsx
// ---------------------------------------------------------------------------
export type LanguageKey = 'label' | 'en' | 'de';

// ---------------------------------------------------------------------------
// Namespace: common.Notification  (sub-path: company.onboarding.*)
// Used by: notification.tsx
// ---------------------------------------------------------------------------
export type NotificationOnboardingKey =
  | 'company.onboarding.rejected'
  | 'company.onboarding.pending'
  | 'company.onboarding.approved';

// ---------------------------------------------------------------------------
// Namespace: auth.errors
// Used by: notification.tsx
// ---------------------------------------------------------------------------
export type AuthErrorKey = 'AccessDenied' | 'Configuration' | 'Verification' | 'Default';

// ---------------------------------------------------------------------------
// Namespace: notifications
// Used by: DefaultNotificationPayloadServiceServer.ts
// ---------------------------------------------------------------------------
export type NotificationCodeKey = 'SUBSTITUTION_AVAILABLE' | 'ITEM_PRICE_CHANGE' | 'actions.goToCart';

// ---------------------------------------------------------------------------
// Namespace: account.Documents
// Used by: documents-card.tsx
// ---------------------------------------------------------------------------
export type DocumentKey =
  | 'title'
  | 'categories.contracts'
  | 'categories.company'
  | 'categories.manuals'
  | 'categories.warranty'
  | 'seeAll';

// ---------------------------------------------------------------------------
// Namespace: validation
// Used by: form.tsx
// ---------------------------------------------------------------------------
export type ValidationKey =
  | 'contactData.email.required'
  | 'contactData.email.invalid'
  | 'contactData.firstName.required'
  | 'contactData.lastName.required'
  | 'address.contactName.required'
  | 'address.street.required'
  | 'address.streetNumber.required'
  | 'address.zipCode.required'
  | 'address.city.required'
  | 'address.country.required'
  | 'address.state.required'
  | 'shipping.method.required'
  | 'payment.method.required'
  | 'login.username.required'
  | 'login.username.invalid'
  | 'login.password.required'
  | 'password.email.required'
  | 'password.email.invalid'
  | 'register.registrationType.required'
  | 'register.firstName.required'
  | 'register.lastName.required'
  | 'register.email.required'
  | 'register.email.invalid'
  | 'register.email.mismatch'
  | 'register.emailConfirmation.required'
  | 'register.companyName.required'
  | 'register.vatNumber.required'
  | 'register.street.required'
  | 'register.houseNumber.required'
  | 'register.postalCode.required'
  | 'register.city.required'
  | 'register.country.required'
  | 'register.password.mismatch'
  | 'register.passwordConfirmation.required'
  | 'register.general.emailExists'
  | 'register.general.registrationFailed'
  | 'register.general.serverError';

// ---------------------------------------------------------------------------
// Namespace: product (sub-path: filters.*)
// Used by: search-filter.tsx, search-active-filters.tsx
// Keys come from API facet names mapped to translation sub-paths
// ---------------------------------------------------------------------------
export type ProductFilterKey =
  | 'filters.prices.effectiveAmount'
  | 'filters.categoryAssignments.name'
  | 'filters.filterButton'
  | 'filters.clearFilter'
  | 'filters.applyFilters'
  | ProductVariantAttributeKey
  | ProductTemplateAttributeKey;

// ---------------------------------------------------------------------------
// Namespace: product (sub-path: filters.mixins.productVariantAttributes.*)
// Used by: product-detail.tsx, product-variant-selector-multi.tsx,
//          product-variant-selector-simple.tsx, product-tile-fly-out.tsx
// These keys come from product data. Unknown keys use { defaultValue }.
// ---------------------------------------------------------------------------
export type ProductVariantAttributeKey =
  | 'filters.mixins.productVariantAttributes.capacity'
  | 'filters.mixins.productVariantAttributes.nominal-power'
  | 'filters.mixins.productVariantAttributes.color'
  | 'filters.mixins.productVariantAttributes.ampere'
  | 'filters.mixins.productVariantAttributes.length'
  | 'filters.mixins.productVariantAttributes.farbe'
  | 'filters.mixins.productVariantAttributes.format';

// ---------------------------------------------------------------------------
// Namespace: product (sub-path: filters.mixins.productTemplateAttributes.*)
// Used by: product-detail.tsx, product-tile.tsx, product-tile-fly-out.tsx
// ---------------------------------------------------------------------------
export type ProductTemplateAttributeKey =
  | 'filters.mixins.productTemplateAttributes.length'
  | 'filters.mixins.productTemplateAttributes.width'
  | 'filters.mixins.productTemplateAttributes.height'
  | 'filters.mixins.productTemplateAttributes.cell-type'
  | 'filters.mixins.productTemplateAttributes.timeframe-months'
  | 'filters.mixins.productTemplateAttributes.estimated-budget-month'
  | 'filters.mixins.productTemplateAttributes.not-to-exceed-amout';

// ---------------------------------------------------------------------------
// Combined type for product-tile-fly-out.tsx renderAttributes helper
// ---------------------------------------------------------------------------
export type ProductAttributeKey = ProductVariantAttributeKey | ProductTemplateAttributeKey;
