import { CmsBodyFrame } from '@/components/cms/_core/cms-page-frame';
import { CmsRenderer } from '@/components/cms/_core/cms-renderer';
import { staticHomePage } from '@/lib/cms/static-home';

/**
 * Renders the version-controlled homepage. Same component tree as Storyblok,
 * without a provider call.
 */
export function StaticHomePage({ locale }: Readonly<{ locale: string }>) {
  const page = staticHomePage(locale);

  return (
    <CmsBodyFrame noMargin={page.no_margin}>
      {page.components.map((component) => (
        <CmsRenderer key={component.id} component={component} />
      ))}
    </CmsBodyFrame>
  );
}
