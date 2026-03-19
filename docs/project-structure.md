# Emporix Showcase Project Structure

This document provides an overview of the project's directory structure and the purpose of each directory.

## Directory Tree Overview

```
emporix-showcase/
├── docs/                   # Project documentation <- you are here
├── e2e/                    # End-to-end tests
├── public/                 # Static assets
├── resources/              # Additional resources
├── scripts/                # Utility scripts
├── src/                    # Main source code
│   ├── app/                # Next.js App Router
│   │   ├── [site]/[locale]/ # Multi-tenant routes
│   │   │   ├── (default)/  # Full header/footer layout
│   │   │   ├── (reduced)/  # Minimal layout (checkout)
│   │   │   └── (no-margin)/ # Full-width CMS pages
│   │   ├── api/            # API routes
│   ├── components/         # React components
│   │   ├── account/        # Account components
│   │   ├── address/        # Address components
│   │   ├── breadcrumb/     # Breadcrumb components
│   │   ├── cart/           # Cart components
│   │   ├── checkout/       # Checkout components
│   │   ├── cms/            # CMS components
│   │   ├── common/         # Common components
│   │   ├── footer/         # Footer components
│   │   ├── header/         # Header components
│   │   ├── icons/          # Icon components
│   │   ├── login/          # Login components
│   │   ├── notification/   # Notification components
│   │   ├── password/       # Password components
│   │   ├── product/        # Product components
│   │   ├── register/       # Registration components
│   │   ├── search/         # Search components
│   │   ├── seo/            # SEO components
│   │   └── ui/             # UI components
│   ├── hooks/              # Custom React hooks
│   ├── i18n/               # i18n configuration
│   |   └── translations/   # Localization files
│   ├── lib/                # Shared libraries
│   ├── platform/           # Core business logic
│   │   ├── core/           # Core functionality
│   │   ├── integrations/   # External API integrations
│   │   │   ├── batteryincluded/ # Battery Included integration
│   │   │   ├── emporix/    # Emporix integration
│   │   │   ├── openmeteo/  # OpenMeteo integration
│   │   │   └── types/      # Integration types
│   │   ├── repositories/   # Data access layer
│   │   └── services/       # Business logic services
│   │       ├── approval/   # Approval services
│   │       ├── auth/       # Authentication services
│   │       ├── cart/       # Cart services
│   │       ├── category/   # Category services
│   │       ├── checkout/   # Checkout services
│   │       ├── company/    # Company services
│   │       ├── customer/   # Customer services
│   │       ├── model/      # Domain models
│   │       ├── order/      # Order services
│   │       ├── payment/    # Payment services
│   │       ├── price/      # Price services
│   │       ├── product/    # Product services
│   │       ├── search/     # Search services
│   │       ├── session/    # Session services
│   │       ├── shipping/   # Shipping services
│   │       ├── site/       # Site services
│   │       ├── validation/ # Validation services
│   │       └── weather/    # Weather services
│   ├── providers/          # React providers
│   ├── stores/             # State management
│   ├── types/              # TypeScript types
│   └── utils/              # Utility functions
└── test-results/           # Test results
```

## Root Directories

### `/docs`
Project documentation including architecture, implementation details, and development guidelines.

### `/e2e`
End-to-end tests using Playwright for testing the application from a user's perspective.

### `/public`
Static assets that are served directly by the web server, including images, fonts, and other resources.

### `/resources`
Additional resources used by the application, such as configuration files, templates, or data files.

### `/scripts`
Utility scripts for build, deployment, and other development tasks.

### `/src`
The main source code directory containing all application code.

### `/test-results`
Contains test results from automated test runs.

## Source Code Structure (`/src`)

### `/src/app`
Next.js App Router structure containing page components and API routes.

- `/[site]/[locale]`: Multi-tenant, locale-aware routes
- `/api`: API routes for server-side functionality

### `/src/components`
Reusable React components organized by feature or domain.

- `/account`: Components related to user account management
- `/address`: Components for address management and display
- `/breadcrumb`: Navigation breadcrumb components
- `/cart`: Shopping cart related components
- `/checkout`: Checkout process components
- `/cms`: Components integrated with the Storyblok CMS
- `/common`: Shared utility components used across features
- `/footer`: Footer components
- `/header`: Header and navigation components
- `/icons`: Custom icon components
- `/login`: Authentication and login components
- `/notification`: Toast and notification components
- `/password`: Password management components
- `/product`: Product display and management components
- `/register`: User registration components
- `/search`: Search functionality components
- `/seo`: SEO-related components like meta tags
- `/ui`: Base UI components like buttons, cards, inputs

### `/src/hooks`
Custom React hooks for shared logic and state management.

### `/src/i18n`
Internationalization configuration and utilities.

### `/src/lib`
Shared libraries and utilities that are not specific to React.

### `/src/platform`
Core business logic and services implementing the layered architecture. [Layered Architecture](./layered-architecture.md)

#### `/src/platform/core`
Core functionality and utilities for the platform layer.

#### `/src/platform/integrations`
Integration with external services and APIs.

- `/batteryincluded`: Integration with Battery Included services
- `/emporix`: Integration with Emporix e-commerce platform
- `/openmeteo`: Integration with OpenMeteo weather API
- `/types`: Type definitions for integrations

#### `/src/platform/repositories`
Data access layer for retrieving and storing data.

#### `/src/platform/services`
Business logic services organized by domain.

- `/approval`: Approval workflow services
- `/auth`: Authentication services
- `/cart`: Shopping cart services
- `/category`: Product category services
- `/checkout`: Checkout process services
- `/company`: Company management services
- `/customer`: Customer management services
- `/model`: Domain models and data transfer objects
- `/order`: Order management services
- `/payment`: Payment processing services
- `/price`: Pricing services
- `/product`: Product management services
- `/search`: Search services
- `/session`: Session management services
- `/shipping`: Shipping services
- `/site`: Site configuration services
- `/validation`: Data validation services
- `/weather`: Weather information services

### `/src/providers`
React context providers and higher-order components.

### `/src/stores`
Stores for global state management.

### `/src/types`
TypeScript type definitions used throughout the application.

### `/src/utils`
Utility functions and helpers.
