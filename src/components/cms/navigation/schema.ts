import { z } from 'zod';

const NavigationItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string().optional(),
  link: z.string().optional(),
  is_external: z.boolean().optional(),
  site: z.string().optional(),
});

export const NavigationSchema = z.object({
  id: z.string(),
  type: z.literal('navigation'),
  items: z.array(NavigationItemSchema).optional(),
  site: z.string().optional(),
});

export type NavigationItemData = z.infer<typeof NavigationItemSchema>;
export type NavigationData = z.infer<typeof NavigationSchema>;
