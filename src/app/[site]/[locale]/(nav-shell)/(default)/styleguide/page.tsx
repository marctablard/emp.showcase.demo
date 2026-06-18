import { notFound } from 'next/navigation';
import { H1 } from '@/components/ui/h';
import ColorStyleGuide from './atoms/color';
import ShadowStyleGuide from './atoms/shadow';
import TextStyleGuide from './atoms/text';
import AlertStyleGuide from './ui/alert';
import BadgeStyleGuide from './ui/badge';
import BreadcrumbStyleGuide from './ui/breadcrumb';
import ButtonStyleGuide from './ui/button';
import DialogStyleguide from './ui/dialog';
import FormFieldStyleguide from './ui/form-field';
import LinkStyleGuide from './ui/link';
import NotificationStyleguide from './ui/notification';
import PaginationStyleGuide from './ui/pagination';

export default function StyleGuide() {
  const enabled = process.env.NEXT_STYLEGUIDE_PAGE === 'true' || process.env.NEXT_PUBLIC_STYLEGUIDE_PAGE === 'true';
  if (!enabled) {
    notFound();
  }
  return (
    <main className="max-w-6xl mx-auto px-4 grid gap-x-4 lg:px-9 sm:gap-x-6">
      <H1 className="mt-12 mb-6">Hello Styleguide</H1>
      <p className="text-lg md:max-w-3/5">
        For the styling we are using tailwindcss. So the HTML-Tags get not styled at all, instead please use the utility
        classes provided by{' '}
        <a className="text-text-action underline" href="https://tailwindcss.com/docs/styling-with-utility-classes">
          tailwindcss
        </a>{' '}
        and our ui-components.
        <br />
        <br />
        Here you can find some common styles and the ui-components documented.
      </p>
      <TextStyleGuide />
      <ColorStyleGuide />
      <ShadowStyleGuide />
      <ButtonStyleGuide />
      <LinkStyleGuide />
      <BadgeStyleGuide />
      <BreadcrumbStyleGuide />
      <PaginationStyleGuide />
      <FormFieldStyleguide />
      <NotificationStyleguide />
      <AlertStyleGuide />
      <DialogStyleguide />
    </main>
  );
}
