import { z } from 'zod';
import { RichtextSchema } from '../richtext/schema';

/**
 * Wire-format schema for the `article` CMS component.
 *
 * The body `content` is typed against the agnostic `RichtextSchema`
 * (the semantic block AST consumed by `<Richtext>`). Adapters that
 * speak a different wire format (e.g. TipTap-JSON, or other CMS-native
 * richtext) are responsible for pre-mapping their richtext
 * into this shape at the adapter boundary — the UI side only ever
 * sees a valid AST. A payload that fails `RichtextSchema.parse`
 * rejects at the adapter boundary, not in the renderer.
 */
const ArticleVideoSchema = z.object({
  url: z.string().optional(),
  title: z.string().optional(),
});

const ArticleLinkedProductSchema = z.object({
  _uid: z.string(),
  product_id: z.string().optional(),
  name: z.string().optional(),
});

export const ArticleSchema = z.object({
  id: z.string(),
  type: z.literal('article'),
  title: z.string().optional(),
  introduction: z.string().optional(),
  video: ArticleVideoSchema.optional(),
  // Article body — typed against the agnostic richtext AST. Adapters
  // pre-map their wire format (e.g. TipTap JSON) into
  // RichtextData at the boundary.
  content: RichtextSchema.optional(),
  linked_products: z.array(ArticleLinkedProductSchema).optional(),
});

export type ArticleData = z.infer<typeof ArticleSchema>;
export type ArticleLinkedProductData = z.infer<typeof ArticleLinkedProductSchema>;
