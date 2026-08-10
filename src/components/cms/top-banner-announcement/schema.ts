import { z } from 'zod';

const TopBannerLinkSchema = z.object({
  id: z.string(),
  url: z.string(),
  target: z.string(),
});

export const TopBannerAnnouncementSchema = z.object({
  id: z.string(),
  type: z.literal('top-banner-announcement'),
  title: z.string(),
  link: TopBannerLinkSchema,
  is_active: z.boolean(),
});

export type TopBannerAnnouncementData = z.infer<typeof TopBannerAnnouncementSchema>;
