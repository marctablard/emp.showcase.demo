import { z } from 'zod';

export const CategoryGridSchema = z.object({
  id: z.string(),
  type: z.literal('category-grid'),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  showAllCategories: z.boolean().optional(),
  categoryId: z.string().optional(),
  maxCategories: z.coerce.number().optional(),
  columns: z.coerce.number().optional(),
});

export type CategoryGridData = z.infer<typeof CategoryGridSchema>;
