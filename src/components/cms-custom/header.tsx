import type { CMSComponentEntry } from '@extensions/medienwerft-cms-plugin/types';
import { normalizeMedia, sharedFieldDefinitions } from './_shared/field-definitions';
import CmsHeader from './header-content';

export default CmsHeader;
export { CmsHeader };

export const cmsHeaderEntry: CMSComponentEntry = {
  definition: {
    type: 'cms-header',
    label: 'Header',
    description: 'Site header with logo, navigation links, and an optional CTA.',
    fieldDefinitions: sharedFieldDefinitions,
    props: {
      logo: { label: 'Logo image', type: 'media', allowedTypes: ['image/*'] },
      logo_text: { label: 'Logo text', type: 'text' },
      nav_items: {
        label: 'Navigation items',
        type: 'array',
        items: { $ref: 'link', label: 'Link', type: 'object' },
      },
      cta: { $ref: 'link', label: 'CTA button', type: 'object' },
      sticky: { label: 'Sticky on scroll', type: 'boolean' },
      show_search: { label: 'Show search bar', type: 'boolean' },
      show_account: { label: 'Show account button', type: 'boolean' },
      show_cart: { label: 'Show cart button', type: 'boolean' },
      tone: {
        label: 'Tone',
        type: 'select',
        options: [
          { label: 'Default', value: 'default' },
          { label: 'Muted', value: 'muted' },
          { label: 'Accent', value: 'accent' },
          { label: 'Inverted', value: 'inverted' },
        ],
      },
    },
    defaultProps: {
      sticky: false,
      tone: 'default',
      show_search: true,
      show_account: true,
      show_cart: true,
    },
  },
  mapProps: (p) => ({
    logo: normalizeMedia(p.logo),
    logoText: p.logo_text,
    navItems: p.nav_items ?? [],
    cta: p.cta,
    sticky: p.sticky,
    tone: p.tone,
    showSearch: p.show_search,
    showAccount: p.show_account,
    showCart: p.show_cart,
  }),
  component: CmsHeader,
};
