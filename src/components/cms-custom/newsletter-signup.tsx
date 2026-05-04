import dynamic from 'next/dynamic';
import type { CMSComponentEntry } from '@extensions/medienwerft-cms-plugin/types';

const NewsletterSignup = dynamic(() => import('./newsletter-signup-client'));

export const newsletterSignupEntry: CMSComponentEntry = {
  definition: {
    type: 'cms-newsletter-signup',
    label: 'Newsletter signup',
    description: 'Email signup form. Configure an endpoint to wire up an external provider.',
    props: {
      headline: { label: 'Headline', type: 'text' },
      body: { label: 'Body', type: 'textarea' },
      placeholder: { label: 'Email placeholder', type: 'text' },
      submit_label: { label: 'Submit label', type: 'text' },
      success_message: { label: 'Success message', type: 'text' },
      endpoint: { label: 'Submit endpoint (URL)', type: 'url' },
      alignment: {
        label: 'Alignment',
        type: 'select',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Center', value: 'center' },
          { label: 'Right', value: 'right' },
        ],
      },
      layout: {
        label: 'Layout',
        type: 'select',
        options: [
          { label: 'Inline', value: 'inline' },
          { label: 'Stacked', value: 'stacked' },
        ],
      },
      tone: {
        label: 'Tone',
        type: 'select',
        options: [
          { label: 'Default', value: 'default' },
          { label: 'Muted', value: 'muted' },
          { label: 'Accent', value: 'accent' },
        ],
      },
    },
    defaultProps: {
      placeholder: 'you@example.com',
      submit_label: 'Subscribe',
      success_message: 'Thanks — please check your inbox.',
      alignment: 'left',
      layout: 'inline',
      tone: 'default',
    },
  },
  mapProps: (p) => ({
    headline: p.headline,
    body: p.body,
    placeholder: p.placeholder,
    submitLabel: p.submit_label,
    successMessage: p.success_message,
    endpoint: p.endpoint,
    alignment: p.alignment,
    layout: p.layout,
    tone: p.tone,
  }),
  component: NewsletterSignup,
};
