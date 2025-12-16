import { ArrowRight, Trash2 } from 'lucide-react';
import { H4 } from '@/components/ui/h';
import UiLink from '@/components/ui/link';

export default function LinkStyleGuide() {
  return (
    <div className="py-12">
      <H4 className="mb-3">Links</H4>
      <p className="text-base mb-2">
        Now there is a ui-component for links &quot;UiLink&quot;. You can either use the Link from next.js as type or A
        for HTML a-Tag and also button-Tag is possible.
      </p>
      <p>primary:</p>
      <div className="p-4 grid grid-cols-[1fr] sm:grid-cols-[1fr_1fr_1fr] gap-6 mb-2 items-start">
        <div>
          <UiLink type="Link" href="#" variant="primary" size="s" iconBefore={<Trash2 />} iconAfter={<ArrowRight />}>
            Link S
          </UiLink>
        </div>
        <div>
          <UiLink type="Link" href="#" variant="primary" size="m" iconBefore={<Trash2 />} iconAfter={<ArrowRight />}>
            Link M
          </UiLink>
        </div>
        <div>
          <UiLink type="Link" href="#" variant="primary" size="l" iconBefore={<Trash2 />} iconAfter={<ArrowRight />}>
            Link L
          </UiLink>
        </div>
      </div>
      <p>secondary:</p>
      <div className="p-4 grid grid-cols-[1fr] sm:grid-cols-[1fr_1fr_1fr] gap-6 mb-2 items-start">
        <div>
          <UiLink type="A" href="#" variant="secondary" size="s" iconBefore={<Trash2 />} iconAfter={<ArrowRight />}>
            Link S
          </UiLink>
        </div>
        <div>
          <UiLink type="A" href="#" variant="secondary" size="m" iconBefore={<Trash2 />} iconAfter={<ArrowRight />}>
            Link M
          </UiLink>
        </div>
        <div>
          <UiLink
            type="A"
            href="#"
            disabled
            variant="secondary"
            size="l"
            iconBefore={<Trash2 />}
            iconAfter={<ArrowRight />}
          >
            Link L
          </UiLink>
        </div>
      </div>
      <p className="text-base mb-2">You can also use as type Button and they can be disabled:</p>
      <p>primary:</p>
      <div className="p-4 grid grid-cols-[1fr] sm:grid-cols-[1fr_1fr_1fr] gap-6 mb-2 items-start">
        <div>
          <UiLink
            type="Button"
            disabled
            href="#"
            variant="primary"
            size="s"
            iconBefore={<Trash2 />}
            iconAfter={<ArrowRight />}
          >
            Link S
          </UiLink>
        </div>
        <div>
          <UiLink
            type="Button"
            disabled
            href="#"
            variant="primary"
            size="m"
            iconBefore={<Trash2 />}
            iconAfter={<ArrowRight />}
          >
            Link M
          </UiLink>
        </div>
        <div>
          <UiLink
            type="Button"
            disabled
            href="#"
            variant="primary"
            size="l"
            iconBefore={<Trash2 />}
            iconAfter={<ArrowRight />}
          >
            Link L
          </UiLink>
        </div>
      </div>
      <p>secondary:</p>
      <div className="p-4 grid grid-cols-[1fr] sm:grid-cols-[1fr_1fr_1fr] gap-6 mb-2 items-start">
        <div>
          <UiLink
            type="Button"
            disabled
            href="#"
            variant="secondary"
            size="s"
            iconBefore={<Trash2 />}
            iconAfter={<ArrowRight />}
          >
            Link S
          </UiLink>
        </div>
        <div>
          <UiLink
            type="Button"
            disabled
            href="#"
            variant="secondary"
            size="m"
            iconBefore={<Trash2 />}
            iconAfter={<ArrowRight />}
          >
            Link M
          </UiLink>
        </div>
        <div>
          <UiLink
            type="Button"
            disabled
            href="#"
            variant="secondary"
            size="l"
            iconBefore={<Trash2 />}
            iconAfter={<ArrowRight />}
          >
            Link L
          </UiLink>
        </div>
      </div>
    </div>
  );
}
