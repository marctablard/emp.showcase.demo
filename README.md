# Journey Aware Storefront

Journey Aware Storefront is a journey-aware storefront that provides a seamless shopping experience for customers. It is built on top of the React/Next.js framework that provides the basis for modern composable web applications.

## Features

An overview of the key features of Journey Aware Storefront.

### Technical Key-Components

Based on modern technologies and best practices, the goal is to provide a solid, maintainable and extensible foundation for building a storefront or e-commerce platform.

- TypeScript Support
- React/Next.js Architecture with App Router and SSR
- Support for SSG
- Loose Coupling and Dependency Injection with InversifyJS
- L10n (Localization) with next-intl
- Authentication with next-auth
- Automated Testing using Jest and Playwright
- Component Library with Shadcn UI
- Responsive Design with Tailwind CSS

### Business Key-Components

Ideal starting point for a new storefront or e-commerce platform. The Platform is specifically designed to give you a head-start while not overloading you with features you don't need. The main goal of this Storefront is to provide you with a set of best practices and prebuilt components, while allowing you to easily extend and replace the business logic to fit your specific needs.

- Separated Business and Integration Layer, allowing for easy extension and replacement of all business logic (e.g. synchronous pricing, order processing, etc.)
- Commerce Integration (prebuilt with Emporix Platform)
- CMS Capabilities (prebuilt with Storyblok Integration)
- Account Management and Service Portal including adaptable Dashboard
- Product and Checkout prebuilt
- LightHouse Performance Scores of 90+ from the start

## Getting Started

Here is a quick start guide to get you started with Journey Aware Storefront.

### Prerequisites

- Node.js (v20+)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Copy the environment template (includes demo values)
cp .env.template .env
```

**Note:** The `.env.template` file includes **public demo credentials** from the Emporix showcase tenant, Battery Included, and Storyblok. The application will work out-of-the-box without any configuration changes.

For **production use** or to enable **advanced features** (login, ordering, push notifications), you'll need to replace the placeholder values in `.env` with your own credentials. See [Environment Variables Documentation](docs/environment-variables.md) for details.

### Development

To run the development server:

```bash
# Start the development server with hot-reload
npm run dev
```

This will:

- Start the Next.js development server with Turbopack
- Run the dependency injection generator in watch mode
- Open the application at [http://localhost:3000](http://localhost:3000)

#### Note on Hot-Swapping Platform Layer

The dependency injection generator is configured to run in watch mode by default. This means that it will automatically generate dependency injection files when you make changes to the dependency injection configuration files.

**BUT** due to the nature of the current implementation the changes made to the platform-layer are not hot-swappable. You will need to restart the development server to apply the changes. (We are aware of this and hope to change this with the upcoming release)

### Known Issues

A list of known issues and their workarounds. (We are aware of these and will fix them in upcoming releases)

- Authorization can have issues, if Session Invalidation happens during a SSR-Moment, which causes the Client to not be aware of their lost session (then it's not possible to write cookies)
- Cart Migration is not implemented yet
- NextJS API-Endpoints are currently not additionally secured, since most security comes from the Emporix-Integration itself
- Not all CMS Components are currently following the pattern of hybrid CMS compatibility, we implemented a few to showcase the possibilities
- There's no Caching implemented for the Integration Layer, we plan to implement this in an upcoming release
- The Unit Tests rely on specific Test-Data for API-Endpoint Testing, you need to include them yourself for now, but we plan to create an automation to create the Test-Data in your own tenants soon. You may need to skip these tests for now.

### What to Expect

To sharpen the understanding of how this Framework is intended to be used, here a few key concepts.

- Not everything is pre-built, we want to give you a solid foundation, rather than a ready-to-use solution, because we know that every business has its own unique needs and requirements.
- Account Management and Service Portal is currently covering a few Widgets in a pre-built and a dummy form, this is because the needs will be specific to your project. So you can extend and customize to your requirements.
- Product and Checkout are currently pre-built to showcase the MVP-flow of every Storefront.
- Site- and Currency-Switcher is not fully implemented on purpose, especially the migration of Carts to other currencies and sites, since the business cases for this vary a lot and are not always needed.
- Pricing is currently based on the Emporix-Integration, but concepts for implementing asynchronous Pricing or Pricing from other sources are easily implemented, since the components can react to data changes
- Approval is not fully implemented, since the concepts for it vary from business to Business

### Building for Production

```bash
# Build the application
npm run build

# Start the production server
npm run start
```

The build process:

1. Generates dependency injection files (located in `src/platform/`)
2. Builds the Next.js application

### Further Scripts of interest

- `npm run dev` - Start development server with hot-reload
- `npm run dev:next` - Start Next.js dev server
- `npm run dev:open-browser` - Open browser for local development
- `npm run dev:https` - Start development server with HTTPS
- `npm run build` - Build the application (includes DI generation and lint)
- `npm run build:next` - Build Next.js only
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run generate` - Generate dependency injection files
- `npm run generate:watch` - Generate dependency injection files in watch mode
- `npm run test` - Run unit tests and E2E tests
- `npm run jest` - Run unit tests
- `npm run jest:watch` - Run unit tests in watch mode
- `npm run jest:coverage` - Run unit tests with coverage
- `npm run e2e` - Run Playwright E2E tests
- `npm run e2e:ui` - Run Playwright in UI mode
- `npm run e2e:debug` - Run Playwright in debug mode
- `npm run e2e:report` - Show Playwright HTML report
- `npm run setup` - Setup API (see scripts/setup-api.ts)
- `npm run generate:sso-password` - Generate SSO password

## License

The [LICENSE](LICENSE) file contains the license information for the Journey Aware Storefront.

## Documentation

The [docs](docs) directory contains the documentation for the Journey Aware Storefront.
