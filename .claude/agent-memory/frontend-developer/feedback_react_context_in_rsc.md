---
name: feedback-react-context-in-rsc
description: React Context Providers do not cross the RSC boundary. A Server Component cannot wrap children in `<Ctx.Provider>` and expect a Server-Component descendant to read it via `useContext`/`use()`. Use prop-passing for data that needs to flow across Server-rendered tree levels.
metadata:
  type: feedback
---

In SHOW-323 Slice 5 the Layout-Pipeline contract called for forwarding Page-Body components into the renderer where they get substituted at a `content-slot` marker. The first design used `React.createContext` with a `PageBodyContext.Provider` wrapping the renderer call. That:

- Failed at `npm run build` time with: *"You're importing a module that depends on `createContext` into a React Server Component module."*
- Could be silenced by marking the context-file `'use client'`, but then the Provider value lives in the Client subgraph — a Server-Component descendant (`CmsRenderer`) sees only the default value, never the Provider's value.
- Jest+jsdom rendered everything as client-equivalent, so tests passed and the issue surfaced only at build/runtime.

**Rule for SHOW-323 (and similar layout pipelines):** if data needs to flow from a Server Component down to a Server-Component descendant, pass it as a **prop**. Thread it through container recursion in the renderer. Don't reach for React Context.

**Why:** React 19 Context Providers are a Client-Component construct. A Server Component can import the context module (default values only), but cannot `<Provider value=>` across the RSC boundary. The renderer reading `use(Context)` in an RSC returns the default — not what tests with jsdom Provider expect.

**How to apply:**
- Default to prop-passing for cross-tree-level data in CMS / layout pipelines.
- If the test contract suggests Context, verify with `npm run build` BEFORE committing — jest alone is insufficient.
- If you really need Context, the renderer must become `'use client'` (and pull the entire CMS subgraph into the client bundle). Almost never the right trade-off.

[[feedback-use-client-audit-navigation-ts]] applies as well — the renderer staying Server-Component-pure is the goal, and Context Providers fight that goal.
