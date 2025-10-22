# Emporix Journey Aware Storefront – Release Notes September 2025

**Build:** 30.09.2025  

---

## TL;DR – Highlights

- **Product Variant Selection:** Single and multi-hierarchy  
- **Standardized Notification System** (custom entity-based)  
- **Web Push** *(Beta)*  
- **Automated Tenant Setup** *(Beta)*  
- **Quote/Offer Management** *(Beta)*  
- **Approval Workflow** *(Beta)* – Endpoints functional  
- **File-based CMS Alternative** to Storyblok  
- **Emporix Search** as an alternative to BatteryIncluded  
- **Performance:** Improved caching headers, faster cart loading  
- **DX:** Platform containers (services & integrations) are now **hotswappable**  
- **Order History** reworked  
- **Fixes:** More stable session and cart handling, fewer hardcodings, better header layout on small viewports  

---

### About *Beta* Features

Features marked with **(Beta)** are newly introduced and still in an early phase.  
They are fully functional, but we’re not yet guaranteeing final stability.  
The *Beta* label also means we’re actively looking for **feedback from our partners** to help us refine and harden these capabilities before declaring them production-ready.  

---

## New Features

### Product Variant Selection (Single & Multi-Hierarchy)
Allows variant selection via simple and nested attribute hierarchies (e.g., `color → size → material`).  
Includes validation of valid combinations.

### Standardized Notification System
Unified notifications (toast/in-app/modal) based on **custom entities**.  
Provides clear severity levels (`info`, `success`, `warning`, `error`) and a defined dismiss/timeout policy.

### Web Push *(Beta)*
Opt-in web push notifications for user-defined events.  
Targeted delivery to users, sessions, and cart owners.

### Automated Tenant Setup *(Beta)*
Provisioning flow for new tenants (basic configurations, standard roles, default catalogs).  
Script-driven automation.

### Quote/Offer Management *(Beta)*
Create, version, and submit offers for approval.

### Approval Workflow *(Beta)*
Endpoints and UI for submitting and approving purchase requests.

### File-based CMS Alternative to Storyblok
Local JSON-based CMS as default option without external accounts.  
Can be switched to Storyblok via simple code toggle.

### Emporix Search as Alternative to BatteryIncluded
Emporix Search as the default, switchable to BatteryIncluded for advanced features  
(such as filters, suggestions, and recommendations).

---

## Improvements

- **Performance:** More precise caching headers for dynamic and static content  
- **Performance:** Faster cart loading (optimized API request timing and serialization)  
- **Development/DX:** Platform containers (services & integrations) are now hotswappable – no dev server restart needed  
- **Order History:** UI/UX and data queries revised (consistent pagination & filters)

---

## Bugfixes

- **Session Handling:** More consistent across tab/window switches  
- **Cart Handling:** More robust against race conditions  
- **Cart Migration:** More reliable when switching from anonymous to logged-in users  
- **Product Presentation:** Removed various hardcoded behaviors; configuration now applies correctly  
- **Header Responsiveness:** Improved layout on smaller viewports  

---

## Compatibility & Upgrades

- **Breaking Changes:** None  
- **Migration Effort:** None – alternatives (CMS/Search) are active by default and switchable via config  

---

## Configuration / How-To

- **File CMS ↔ Storyblok:**  
  Switch via config (API keys); documentation: `docs/local-cms.md`  

- **Search Service:**  
  Switch between Emporix and BatteryIncluded; documentation: `docs/search-service.md`

---

*© 2025 [Emporix AG] – All rights reserved.*
