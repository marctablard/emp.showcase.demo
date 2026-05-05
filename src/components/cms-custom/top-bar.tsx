import type { CMSComponentEntry } from '@extensions/medienwerft-cms-plugin/types';
import { sharedFieldDefinitions } from './_shared/field-definitions';
import CmsTopBar from './top-bar-content';

export default CmsTopBar;
export { CmsTopBar };

export const cmsTopBarEntry: CMSComponentEntry = {
  definition: {
    type: 'cms-top-bar',
    label: 'Top bar',
    description:
      'Slim utility bar above the header. Holds site/language/currency switchers on the left and optional center / right nav links.',
    fieldDefinitions: sharedFieldDefinitions,
    props: {
      show_site_switcher: { label: 'Show site switcher', type: 'boolean' },
      show_language_switcher: { label: 'Show language switcher', type: 'boolean' },
      show_currency_switcher: { label: 'Show currency switcher', type: 'boolean' },
      center_nav_items: {
        label: 'Center navigation',
        type: 'array',
        items: { $ref: 'link', label: 'Link', type: 'object' },
      },
      right_nav_items: {
        label: 'Right navigation',
        type: 'array',
        items: { $ref: 'link', label: 'Link', type: 'object' },
      },
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
      tone: 'accent',
      show_site_switcher: true,
      show_language_switcher: true,
      show_currency_switcher: true,
    },
  },
  mapProps: (p) => ({
    tone: p.tone,
    showSiteSwitcher: p.show_site_switcher,
    showLanguageSwitcher: p.show_language_switcher,
    showCurrencySwitcher: p.show_currency_switcher,
    centerNavItems: p.center_nav_items ?? [],
    rightNavItems: p.right_nav_items ?? [],
  }),
  component: CmsTopBar,
};
