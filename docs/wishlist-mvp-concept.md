# Wishlist MVP Concept

## Context

This document describes an MVP-oriented implementation concept for a single customer wishlist in the Emporix Showcase storefront.

The project is a Next.js App Router storefront with a clear separation between UI, client-side hooks/stores, Next.js API routes, platform services and Emporix integrations. The relevant existing conventions are:

- UI and browser logic call thin helpers in `src/lib/client/*` or hooks such as `useCart`; browser code should not import `src/platform/server` or `src/platform/ssr`.
- Next.js API routes resolve services from the server DI container.
- Platform services contain business logic and call Emporix integration APIs.
- Emporix integration classes encapsulate external API calls.
- Zustand stores hold interactive client state; `StoreProvider` owns the store graph.
- All user-facing strings live in `src/i18n/translations/en/*` and `src/i18n/translations/de/*`.
- The Account area already contains `/account/wishlists`, currently as a placeholder page.
- PLP and PDP already render wishlist icon buttons (`Pin`) without behavior.
- Notifications use the existing `notify` API from `src/components/ui/toast-notification`.

The Emporix Cart API explicitly supports multiple cart types, including wishlists. Cart uniqueness is based on `siteCode`, `type`, `legalEntityId` and either `sessionId` or `customerId`. For this MVP, the wishlist should therefore be implemented as a customer-owned cart with a dedicated wishlist cart type, not as an anonymous wishlist and not as a separate local storage construct.

## Goals

- Allow authenticated customers to add products to one default wishlist from PLP, PDP and cart.
- Prompt anonymous users to log in, return them to the same PLP/PDP view and apply the pending wishlist action after login.
- Show the wishlist total item quantity in the desktop header wishlist navigation button.
- Replace the Account wishlist placeholder with a real `My Account > Wishlist` view.
- Allow quantity updates, deletion, add-to-cart and future compare integration from the wishlist table.
- Keep the implementation aligned with existing Cart, Account, i18n, Zustand and DI patterns.

## Non-MVP

- Anonymous wishlist persistence.
- Flyover implementation for V1.
- Separate Emporix Shopping List API implementation unless Product/Backend explicitly rejects cart-based wishlist storage.
- Show a quantity badge in desktop view in header
- CSV Import
- Share Whishlist function
- Wishlist with ownership and role system
- Multiple Wishlists
  - Listview (sorting, filtering)
  - Editing Wishlist Name
  - Quick Add to Cart button in Wishlist Overview
- Cart to wishlist

## API Decision

Use the Emporix Cart API and represent the default wishlist as a customer cart.

Recommended constants:

```ts
export const DEFAULT_WISHLIST_NAME = 'default';
export const WISHLIST_CART_TYPE = 'wishlist';
```

Rationale:

- The task asks for a reusable default wishlist name.
- The Cart API needs a distinct `type` to avoid colliding with the normal `shopping` cart.
- The Emporix Cart API documentation explicitly shows `type: wishlist` as an example. `DEFAULT_WISHLIST_NAME` remains a reusable business constant for the single default wishlist and future multiple-list support.

## Proposed Architecture

### Integration Layer

Extend the existing Emporix cart integration only where generic cart functionality is missing.

Likely no new external integration class is required for MVP because `EmporixCartApi` already supports:

- create cart
- get cart by criteria
- search carts
- add item
- update item quantity
- remove item
- refresh cart

Potential small additions:

- allow explicit customer-owned cart creation with `customerId`
- ensure wishlist reads/mutations use customer session context and never anonymous session fallback

### Service Layer

Create a dedicated wishlist service instead of overloading `CartService` with wishlist-specific business rules.

Suggested files:

- `src/platform/services/wishlist/WishlistService.d.ts`
- `src/platform/services/wishlist/impl/EmporixWishlistService.ts`
- `src/platform/services/wishlist/constants.ts`
- `src/platform/services/model/wishlist/wishlist.d.ts`

Suggested service interface:

```ts
export interface WishlistService {
  getDefaultWishlist(): Promise<Wishlist | null>;
  getOrCreateDefaultWishlist(): Promise<Wishlist>;
  addItem(productId: string, quantity: number): Promise<Wishlist>;
  updateItemQuantity(itemId: string, quantity: number): Promise<Wishlist>;
  removeItem(itemId: string): Promise<Wishlist>;
  moveItemToCart(itemId: string): Promise<{ wishlist: Wishlist; cart: Cart }>;
}
```

Implementation notes:

- Require an authenticated customer session for all methods.
- Resolve the wishlist by `siteCode`, `customerId` and `type = wishlist`.
- Create it lazily on first add.
- Use the same pricing/product logic as `EmporixCartService.addItemToCart` for cart line payload creation.
- Re-price wishlist items for the current site/currency when rendering the wishlist view, because acceptance criteria require current site/currency prices.
- Keep unavailable or unpriced items in the wishlist, but mark them as unavailable/unpurchasable at view-model level.

The wishlist service can either share helper logic with `EmporixCartService` or extract a narrow reusable helper for building cart item payloads. Avoid a broad refactor in the MVP.

### Next.js API Routes

Add a small BFF API surface:

- `GET /api/wishlist`
- `POST /api/wishlist/items`
- `PATCH /api/wishlist/items/[itemId]`
- `DELETE /api/wishlist/items/[itemId]`
- `POST /api/wishlist/items/[itemId]/cart`

Expected behavior:

- `GET` returns `204` if no wishlist exists yet, or a wishlist view model if it exists.
- `POST` creates the default wishlist if needed and adds the product.
- `PATCH` updates quantity.
- `DELETE` removes the item.
- `POST /cart` adds the item to the shopping cart, then removes it from wishlist; if the removal fails, return a partial failure response so the UI can show the standard error notification.

### Client Layer

Add:

- `src/lib/client/wishlist.ts`
- `src/stores/wishlist-store.ts`
- `src/hooks/wishlist/useWishlist.ts`
- `src/hooks/wishlist/useWishlistAction.ts`

The wishlist store should mirror the cart store style:

- `currentWishlist: Wishlist | null | undefined`
- `loading`
- `error`
- `fetchWishlist`
- `addItem`
- `updateItemQuantity`
- `removeItem`
- `moveItemToCart`
- computed `totalItems`

`StoreProvider` should add a `WishlistStoreContext`, placed near cart/session because wishlist depends on authenticated customer, site and currency.

## UI Concept

### PLP

`ProductTile` already has a wishlist icon. Wire this button to `useWishlistAction`.

Behavior:

- logged in: add quantity `1`
- anonymous: store pending action, open login flow or route to `/login` with current URL as `callbackUrl`
- success notification: product added to wishlist
- error notification: standard error toast

### PDP

`ProductDetail` already has desktop and mobile wishlist icons. Replace the dead buttons with the same reusable wishlist action component.

Behavior:

- logged in: add selected PDP quantity
- anonymous: store pending action with selected quantity, redirect/open login, return to same PDP
- success notification includes quantity

Implementation detail: PDP quantity currently lives inside `ProductAddToCart`. For wishlist, either lift quantity state to `ProductDetail` or create a shared purchase action section that owns quantity and passes it to both add-to-cart and add-to-wishlist.

### Cart View

Add an "Add to wishlist" action per cart item in `CartItem` or `CartItemList`.

Behavior:

- logged in only per AC
- add selected cart item quantity to wishlist and remove item from cart
- show success/failure notification

### Header

`HeaderActionBar` currently links wishlist to `/account/wishlists`. Enhance this link:

- use `useWishlist()`
- keep the target as `/account/wishlists`
- do not implement flyout in MVP

### Account Wishlist View

Replace `src/app/[site]/[locale]/(default)/account/wishlists/page.tsx` placeholder with a real view using `AccountLayout`.

Breadcrumb:

- My Account
- Wishlist

The final layout should follow the Figma "Wishlist - Single List" design. The written acceptance criteria remain the source of truth if Figma and story differ.

Implementation should still be split into maintainable components, but exact file/component names should be chosen during implementation based on the design structure.

Unavailable handling:

- show all wishlist items
- visually gray unavailable rows
- show only delete action for unavailable products
- show notification listing unavailable SKUs after load

Unpriced handling:

- display `-`
- disable add-to-cart
- exclude from total
- if no known prices exist, total is `-`

Notes:

- Use singular naming (Wishlists -> Wishlist)

## Authentication and Pending Action Flow

For anonymous PLP/PDP users:

1. User clicks wishlist icon.
2. Save a small pending action in `sessionStorage`, for example:

```ts
{
  "kind": "wishlist-add",
  "productId": "123",
  "quantity": 1,
  "sourcePath": "/product/123"
}
```

3. Trigger login with the current pathname as `callbackUrl`.
4. After successful login, the existing auth flow redirects back with `?login=success`.
5. A lightweight client effect on PLP/PDP or a global `WishlistPendingActionHandler` drains the pending action when authentication is ready.
6. Add the item, clear the pending action and show the same success notification as a direct add.

This keeps "no anonymous wishlist" intact while preserving the user's context.

## Price and Availability Strategy

Wishlist items are stored as cart items. A cart item can contain a product and price snapshot from the time the item was added. The wishlist view, however, must show whether the product is purchasable for the user's current shop context.

In this project, that shop context is mainly:

- `siteCode`: the current Emporix site/store context, for example the selected storefront site.
- `currency`: the current session currency.

Therefore the wishlist view should enrich the stored wishlist lines before rendering them. It should verify the current product state and the current price instead of blindly trusting the old cart item snapshot.

Recommended view-model enrichment:

- product exists and purchasable: use `ProductService.getProductById`
- current price exists for site/currency: use `PriceService.getProductPrice`
- stock/availability exists: use `StockService` or existing availability integration where needed
- if product is missing, no longer purchasable or not available for the current site: keep it in the wishlist, but render it as unavailable and only allow deletion
- if price is missing for the current site/currency: keep it in the wishlist, display `-` for price, exclude it from total and disable add-to-cart

This enrichment can live in `WishlistService.getDefaultWishlist()` so UI stays simple.

## Data Model

Suggested service model:

```ts
export interface Wishlist {
  id: string;
  name: string;
  type: string;
  currency: string;
  siteCode: string;
  items: WishlistItem[];
  totalQuantity: number;
  totalKnownPrice?: {
    gross: Price;
    net: Price;
  };
}

export interface WishlistItem {
  id: string;
  quantity: number;
  productId: string;
  sku?: string;
  name?: LocalizedString;
  categoryName?: LocalizedString;
  imageUrl?: string;
  price?: {
    gross: Price;
    net: Price;
  };
  isPurchasable: boolean;
  hasCurrentPrice: boolean;
  unavailableReason?: string;
}
```

Notes:

- `siteCode` mirrors the existing cart/session terminology and identifies the current Emporix site/store context.
- `sku` is the product SKU shown in the acceptance criteria. Existing cart item payloads already persist `product.sku` when items are added to cart.
- `isPurchasable`, `hasCurrentPrice` and `unavailableReason` are storefront view-model fields, not Emporix API enum values. They should be derived by the wishlist service from product, price and availability checks.
- Products can also be `unpublished` -> check for unpublished products

## Internationalization

Add translation keys in English and German, preferably under `account.wishlist` and `product` for PLP/PDP actions.

Example keys:

- `account.wishlist.title`
- `account.wishlist.breadcrumb`
- `account.wishlist.empty`
- `account.wishlist.columns.product`
- `account.wishlist.columns.quantity`
- `account.wishlist.columns.price`
- `account.wishlist.columns.actions`
- `account.wishlist.actions.delete`
- `account.wishlist.actions.addToCart`
- `account.wishlist.actions.compare`
- `account.wishlist.notifications.added`
- `account.wishlist.notifications.addedWithQuantity`
- `account.wishlist.notifications.removed`
- `account.wishlist.notifications.removeFailed`
- `account.wishlist.notifications.movedToCart`
- `account.wishlist.notifications.moveToCartRemoveFailed`
- `account.wishlist.notifications.unavailableProducts`
- `account.wishlist.priceUnavailable`
- `product.addToWishlist`
- `product.addedToWishlistDescription`

Run `npm run check-translations` after implementation.

## Quality & Testing Considerations

Testing should be defined alongside implementation once the final service and UI boundaries are clear.

Expected coverage areas:

- Wishlist service behavior for authenticated-only access, default wishlist resolution, add/update/remove and move-to-cart flows.
- Client store and hook behavior for loading, mutation and refetch states.
- UI behavior for PLP/PDP add-to-wishlist, login continuation and Account wishlist management.
- Edge cases for missing products, missing prices and failed remove-after-add-to-cart operations.
- Translation coverage via the existing translation check script.

The exact unit, component and E2E tests should be selected during implementation based on the final component structure.

## Suggested Implementation Slices

1. Create Wishlist Backend
   - Add wishlist constants, model and service.
   - Store the default wishlist via Emporix Cart API with `type = wishlist`.
   - Add API routes for loading and managing wishlist items.

2. Add Wishlist State
   - Add client API helper, Zustand store and `useWishlist` hook.
   - Handle loading, errors and notifications for wishlist actions.

3. Add Wishlist Buttons
   - Enable wishlist buttons on PLP and PDP.
   - Add "Add to wishlist" action in the cart.
   - Support login continuation for anonymous users.

4. Build Wishlist Page
   - Replace the current account wishlist placeholder.
   - Implement the Figma "Wishlist - Single List" design.
   - Support quantity changes, delete, add to cart and unavailable products.
   - Edge Case: MTS without account page (check with Nicolai Eckerlein)

5. Polish and Validate
   - Add wishlist item counter in the header.
   - Add English and German translations.
   - Add targeted tests and run the existing checks.