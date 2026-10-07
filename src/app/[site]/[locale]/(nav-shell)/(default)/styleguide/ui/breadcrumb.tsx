import { H4 } from '@/components/ui/h';
import { UiBreadcrumb } from '@/components/ui/molecules/ui-breadcrumb';
import type { BreadcrumbContent } from '@/lib/breadcrumb';

export default function BreadcrumbStyleGuide() {
  const breadcrumbs: BreadcrumbContent[] = [
    {
      href: '#',
      label: 'Link Name',
    },
    {
      href: '#',
      label: 'Longer Link Name',
    },
    {
      href: '#',
      label: 'Another Link Name',
    },
    {
      href: '#',
      label: 'Current Page',
    },
  ];
  return (
    <div className="py-12">
      <H4 className="mb-3">Breadcrumb</H4>
      <div className="grid  mb-2">
        <UiBreadcrumb items={breadcrumbs} />
      </div>
    </div>
  );
}
