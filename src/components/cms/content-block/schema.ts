import { z } from 'zod';

const ImageRefSchema = z.object({
  filename: z.string(),
  alt: z.string().optional(),
});

const ContentBlockButtonSchema = z.object({
  name: z.string().optional(),
  link: z.string().optional(),
  is_external: z.boolean().optional(),
});

const ContentBlockStyleSchema = z.union([z.literal('full-width'), z.literal('vignette'), z.literal('teaser')]);

export const ContentBlockSchema = z.object({
  id: z.string(),
  type: z.literal('content-block'),
  title: z.string().optional(),
  description: z.string().optional(),
  images: z.array(ImageRefSchema).optional(),
  background_image: ImageRefSchema.optional(),
  button: ContentBlockButtonSchema.optional(),
  style: ContentBlockStyleSchema.optional(),
});

export type ContentBlockData = z.infer<typeof ContentBlockSchema>;
