import type { MetadataRoute } from 'next';
import { baseUrl } from '@/lib/utils';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/account/*',
        '/api/*',
        '/admin/*',
        '/_next/',
        '/cart/*',
        '/checkout/*', // Don't index order confirmation pages
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
