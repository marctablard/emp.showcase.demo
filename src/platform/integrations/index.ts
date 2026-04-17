import 'server-only';

/**
 * Integration layer — reserved bootstrap module (placeholder).
 *
 * Live `@injectable` integration classes are registered in the generated
 * `src/platform/server.ts` and `src/platform/ssr.ts` (see `scripts/di-generator.ts`).
 * Nothing in the app imports this module today.
 *
 * Do not use this for browser-side resolution: Client Components must call `/api/*`
 * (or Server Actions) and use small helpers under `src/lib/client/*`.
 *
 * When a dedicated integration-only container is needed again, implement `get` here
 * using server-only modules and keep imports out of the client graph.
 */
const integrationProvider = {
  async get<T>(_id: string): Promise<T> {
    throw new Error(
      'Integration provider not activated. Resolve integrations via server.get / ssr.get from @/platform/server or @/platform/ssr.',
    );
  },
};

export default integrationProvider;
