import { z } from 'zod';

const BannerSchema = z.object({
  filename: z.string(),
  alt: z.string().optional(),
});

export const CategorySchema = z.object({
  id: z.string(),
  type: z.literal('category'),
  title: z.string().optional(),
  description: z.string().optional(),
  emporix_category_id: z.string().optional(),
  banner: BannerSchema.optional(),
  highlight: z.boolean().optional(),
  site: z.string().optional(),
});

export type CategoryData = z.infer<typeof CategorySchema>;
