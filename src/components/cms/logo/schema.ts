import { z } from 'zod';

const ImageSchema = z.object({
  filename: z.string(),
  alt: z.string().optional(),
});

export const LogoSchema = z.object({
  id: z.string(),
  type: z.literal('logo'),
  site: z.string().optional(),
  image: ImageSchema.optional(),
  alt_text: z.string().optional(),
});

export type LogoData = z.infer<typeof LogoSchema>;
