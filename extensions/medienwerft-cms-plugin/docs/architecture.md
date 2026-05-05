# CMS Extension Architecture

## Dependency Inversion Principle

This extension demonstrates **true loose coupling** through the **Dependency Inversion Principle (DIP)**. The extension defines what it needs (interfaces), and the storefront provides implementations.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     CMS Extension (High-Level Module)                │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ DI Contract (Extension owns, Storefront implements)            │ │
│  │                                                                 │ │
│  │  • services/CMSComponentService.d.ts                           │ │
│  │    - Defines what component definitions the extension needs    │ │
│  │                                                                 │ │
│  │  • types.d.ts                                                  │ │
│  │    - CMSComponentEntry, CMSComponentTypeDefinition, etc.       │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                    ▲                                  │
│                                    │ depends on abstraction           │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Extension Services (self-contained, interface + impl)          │ │
│  │                                                                 │ │
│  │  • EmporixCMSService                                           │ │
│  │    - CMS page fetching with versioning & site fallback         │ │
│  │    - Interface: services/EmporixCMSService.d.ts                │ │
│  │    - Implementation: services/impl/EmporixCMSService.ts        │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Extension Components                                           │ │
│  │                                                                 │ │
│  │  • EmporixCMSComponentRenderer                                 │ │
│  │    - client.get<CMSComponentService>('EmporixCMSComponentService')│
│  │    - Renders components dynamically                            │ │
│  │                                                                 │ │
│  │  • EmporixCmsPage                                              │ │
│  │    - Server component, fetches CMS page data                   │ │
│  │                                                                 │ │
│  │  • EmporixCMSProvider                                          │ │
│  │    - Client component, provides context to slots               │ │
│  │                                                                 │ │
│  │  • EmporixContentSlot                                          │ │
│  │    - Renders components for specific slots                     │ │
│  │                                                                 │ │
│  │  • useCMSLiveEditor                                            │ │
│  │    - Handles postMessage communication with CMS editor         │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
└───────────────────────────────┬───────────────────────────────────────┘
                                │
                                │ DI Container (Inversion of Control)
                                │
┌───────────────────────────────┼───────────────────────────────────────┐
│                     Storefront Application (Low-Level Module)         │
│                               │                                        │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Service Implementations (Storefront fulfills the contract)     │ │
│  │                                                                 │ │
│  │  • Implements CMSComponentService                              │ │
│  │    @injectable('EmporixCMSComponentService', 'Singleton')      │ │
│  │    Provides component definitions, mappers, and React          │ │
│  │    components to the extension                                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                               ▲                                        │
│                               │ uses                                   │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Component Definitions (Concrete implementations)               │ │
│  │                                                                 │ │
│  │  • src/components/cms/emporix/definitions/index.ts             │ │
│  │    - cmsDefinitionMap                                          │ │
│  │    - Maps component types to React components                  │ │
│  │    - Dynamic imports: dynamic(() => import(...))               │ │
│  │                                                                 │ │
│  │  • Individual definition files:                                │ │
│  │    - hero.ts, quick-entry.ts, column-teaser.ts, etc.           │ │
│  │    - Each exports: definition, mapProps                        │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

## Key Principles

### 1. **Extension Defines the DI Contract**
The extension owns the `CMSComponentService` interface, specifying what component definitions it needs from the storefront.

**Location:** `extensions/medienwerft-cms-plugin/services/CMSComponentService.d.ts`

### 2. **Storefront Implements the Contract**
The storefront provides a concrete implementation of `CMSComponentService`, registered in the DI container under the key `EmporixCMSComponentService`.

### 2b. **Extension-Owned Services**
The `EmporixCMSService` (CMS page fetching with versioning & site fallback) is **self-contained within the extension** — both interface and implementation live in the extension itself.

**Locations:**
- `services/EmporixCMSService.d.ts` — interface
- `services/impl/EmporixCMSService.ts` — implementation

### 3. **DI Container Connects Them**
The dependency injection container wires everything together at runtime, allowing the extension to request services without knowing about concrete implementations.

### 4. **No Direct Dependencies**
- Extension **never** imports from `src/`
- Extension **only** depends on its own interfaces
- Storefront **implements** the extension's interfaces

## Data Flow

### 1. **Page Request**
```
User Request → Next.js Route → EmporixCmsPage (Server Component)
```

### 2. **CMS Data Fetching**
```
EmporixCmsPage → EmporixCMSService (via DI) → EmporixCmsApi → Custom Entities
```

### 3. **Component Rendering**
```
EmporixCmsPage (Server Component)
              ↓
    EmporixCMSProvider (Client Component)
              ↓
    EmporixCMSContext.Provider
              ↓
    EmporixContentSlot → EmporixCMSComponentRenderer
              ↓
    CMSComponentService (via DI, key: 'EmporixCMSComponentService')
              ↓
    Dynamic component rendering
```

### 4. **Live Editing (Optional)**
```
CMS Editor (iframe) → postMessage → useCMSLiveEditor → Component State Update
```

## File Organization

```
extensions/medienwerft-cms-plugin/
├── types.d.ts                            # Type definitions
├── cms-component-registry.ts             # Helper functions (resolveEntries, getMapper)
├── components/
│   ├── index.ts                          # Public exports
│   ├── emporix-cms-page.tsx              # Server component (fetches page data)
│   ├── emporix-cms-provider.tsx          # Client provider wrapper (context + live editor)
│   ├── emporix-content-slot.tsx          # Slot renderer
│   ├── emporix-cms-component-renderer.tsx  # Component renderer (uses DI)
│   └── cms-setup-missing-banner.tsx      # Fallback when DI services are missing
├── context/
│   └── emporix-cms-context.tsx           # React context for CMS state
├── hooks/
│   └── useCMSEditorMessages.ts           # Editor integration (useCMSLiveEditor hook)
├── lib/
│   ├── fetch-cms-page.ts                 # Server-side data fetching
│   ├── component-utils.ts               # Component type extraction from DI
│   └── version-utils.ts                 # Version parameter validation
├── services/
│   ├── CMSComponentService.d.ts          # Interface: component definitions
│   ├── EmporixCMSService.d.ts            # Interface: CMS page fetching with versioning
│   └── impl/
│       ├── EmporixCMSService.ts          # CMS service implementation
│       └── AbstractCMSComponentService.ts  # Base class for component service
├── integrations/
│   └── impl/
│       └── EmporixCmsApi.ts              # Custom Entities API
└── docs/
    ├── architecture.md                   # This file
    ├── component-definition-service.md   # Service documentation
    ├── component-definitions.md          # Component guide
    ├── icon-selection.md                 # Icon system documentation
    ├── slot-based-architecture.md        # Slot system documentation
    └── storefront-integration.md         # LiveEditor integration guide
```

## HTTP Surface

The CMS plugin **does not register any HTTP endpoint**. Every editor
operation that needs live storefront data rides the iframe
`postMessage` channel that the editor already uses for component
types, the category tree, and theme variables. Theme tokens — the
last endpoint the plugin used to ship — were folded into the same
contract:

```
┌─────────────────────┐                     ┌──────────────────────────────────┐
│ CMS Editor (parent) │ ── REQUEST_THEME_TOKENS ──▶ Storefront iframe (preview)│
│                     │                     │                                  │
│                     │ ◀── THEME_TOKENS_RESPONSE ── useCMSThemeLiveEditor     │
└─────────────────────┘                     └──────────────────────────────────┘
```

The storefront resolves the manifest during SSR (via the request-
scoped `fetchCMSThemeTokenManifest` helper) and forwards it to the
live bridge as a prop, so the message handler can answer in-process
without an extra round-trip.

Cross-request caching for theme and settings reads lives at the
fetch layer: the Emporix Custom Entity reads run with
`next: { revalidate: 300 }`, so a published change reaches every
shopper within ~5 minutes. There is no editor-triggered cache
invalidation route — the TTL is the contract.

> Need to add a new editor operation that genuinely cannot ride
> postMessage (e.g. a webhook or a server-to-server callback)? The
> previous generic `/api/ext/[...slug]` infrastructure has been
> removed and is being redesigned. Coordinate with the platform team
> before reaching for HTTP.

## Extension Points

The extension provides several extension points for customization:

### 1. **Component Definitions**
Storefront implements `CMSComponentService` (DI key: `EmporixCMSComponentService`) to provide custom components.

### 2. **CMS Service**
The extension provides its own `EmporixCMSService` (interface + implementation) for CMS page fetching with versioning and site fallback.

### 3. **Prop Mapping**
Each component definition includes a `mapProps` function to transform CMS data to component props.

### 4. **Editor Integration**
The `useCMSLiveEditor` hook handles live editing via postMessage, extensible for different editor protocols.


## See Also

- [Component Definition Service Documentation](./component-definition-service.md)
- [Component Definitions Guide](./component-definitions.md)
- [Extension Development Guide](../../README.md)
- [Dependency Injection Documentation](../../../docs/dependency-injection.md)
