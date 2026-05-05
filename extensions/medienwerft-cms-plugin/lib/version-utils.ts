import { createHash } from 'crypto';

/**
 * Generate a SHA-256 hash of a string and return first 12 hex characters.
 * Uses Node.js crypto (server-side only) to match the editor-side Web Crypto implementation.
 */
export function generateUrlHash(url: string): string {
  const hash = createHash('sha256').update(url).digest('hex');
  return hash.substring(0, 12);
}

/**
 * Build a deterministic entity ID from slug/id, locale, and site.
 *
 * Matches the editor-side buildEntityId convention:
 *  - **Pages** use the last URL path segment plus a SHA-256 URL hash for
 *    uniqueness (since slugs are user-facing and can collide/repeat).
 *    Example: `cms-page-shoes-ab12cd34ef56-en-main`.
 *  - **Layouts** use the logical layout id directly (no hash) — layout ids
 *    are already unique within a site scope and the editor stores them that
 *    way. Example: `cms-layout-default-en-main`.
 *
 * **Idempotency**: if `idOrSlug` is already a fully built entity id for
 * the same `type` / `locale` / `site`, the leading prefix and trailing
 * scope suffix are stripped before normalisation, so calling this twice
 * produces the same result. Prevents doubled ids like
 * `cms-layout-cms-layout-default-en-main-en-main` when a caller forwards
 * an FK that was already built (e.g. a page mixin's `layout_id`).
 *
 * @param type - Entity type prefix ('page' or 'layout')
 * @param idOrSlug - For pages: URL path / slug (e.g. 'products/shoes'). For
 *   layouts: the logical layout id (e.g. 'default').
 * @param locale - Content locale
 * @param site - Site code
 * @param version - Optional version state: 'draft', 'live', or timestamp.
 *   Live uses no suffix.
 */
export function buildEntityId(
  type: 'page' | 'layout',
  idOrSlug: string,
  locale: string,
  site: string,
  version?: string,
): string {
  let baseId: string;
  if (type === 'layout') {
    if (idOrSlug.startsWith('cms-layout-')) {
      baseId = idOrSlug;
    } else {
      baseId = `cms-layout-${idOrSlug}-${locale}-${site}`;
    }
  } else if (type === 'page') {
    if (idOrSlug.startsWith('cms-page-')) {
      baseId = idOrSlug;
    } else {
      const urlParts = idOrSlug.split('/').filter((p) => p.length > 0);
      const lastSegment = urlParts[urlParts.length - 1] || 'home';
      const urlHash = generateUrlHash(idOrSlug);
      baseId = `cms-page-${lastSegment}-${urlHash}-${locale}-${site}`;
    }
  } else {
    throw new Error('Invalid Type', type);
  }
  return constructVersionedId(baseId, version);
}

/**
 * Validates a CMS version parameter.
 *
 * @param version - The version string to validate
 * @returns true if the version is valid (draft, live, or timestamp format)
 */
export function isValidVersion(version?: string): boolean {
  if (!version) {
    return false;
  }

  if (version === 'draft' || version === 'live') {
    return true;
  }

  // Validate timestamp format: YYYY-MM-DDTHH-MM-SSZ
  return /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$/.test(version);
}

/**
 * Constructs a page/layout ID based on the base ID and version.
 *
 * @param baseId - The base identifier (e.g., 'homepage')
 * @param version - The version ('draft', 'live', or timestamp)
 * @returns The constructed ID (e.g., 'homepage-draft', 'homepage-2026-03-30T10-15-30Z')
 */
export function constructVersionedId(baseId: string, version?: 'draft' | 'live' | string): string {
  if (!version || version === 'live') {
    return baseId;
  }

  if (version === 'draft') {
    return `${baseId}-draft`;
  }
  // Archived version with timestamp
  return `${baseId}-${version}`;
}

/**
 * Parses a versioned ID to extract the base ID and version.
 *
 * @param id - The full ID (e.g., 'homepage-draft', 'homepage-2026-03-30T10-15-30Z')
 * @returns Object with baseId and version
 */
export function parseVersionedId(id: string): { baseId: string; version: 'draft' | 'live' | string } {
  if (id.endsWith('-draft')) {
    return {
      baseId: id.slice(0, -6), // Remove '-draft'
      version: 'draft',
    };
  }

  // Check for timestamp pattern
  const timestampMatch = id.match(/^(.+)-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z)$/);
  if (timestampMatch) {
    return {
      baseId: timestampMatch[1],
      version: timestampMatch[2],
    };
  }

  // No version suffix, treat as live
  return {
    baseId: id,
    version: 'live',
  };
}
