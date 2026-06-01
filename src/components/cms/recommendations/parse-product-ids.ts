/**
 * Parses a comma-separated product-ID string into a trimmed, non-empty array.
 *
 * Accepts any whitespace around the delimiter:
 *   "a,b,c"   → ["a","b","c"]
 *   "a, b, c" → ["a","b","c"]
 *   "a ,b"    → ["a","b"]
 *   "a,b,"    → ["a","b"]   (trailing comma filtered)
 *   ""        → []
 */
export const parseProductIds = (products: string): string[] =>
  products
    .split(/\s*,\s*/)
    .map((id) => id.trim())
    .filter(Boolean);
