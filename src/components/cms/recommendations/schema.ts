import { z } from 'zod';

export const RecommendationsSchema = z.object({
  id: z.string(),
  type: z.literal('recommendations'),
  overline: z.string().optional(),
  headline: z.string().optional(),
  productId: z.string().optional(),
  products: z.string().optional(),
  locale: z.string().optional(),
});

export type RecommendationsData = z.infer<typeof RecommendationsSchema>;
