import { AbstractCMSComponentService } from '@extensions/medienwerft-cms-plugin/services/impl/AbstractCMSComponentService';
import type { CMSComponentEntry } from '@extensions/medienwerft-cms-plugin/types';
import { categoryTileRowEntry } from '@/components/cms-custom/category-tile-row';
import { ctaBannerEntry } from '@/components/cms-custom/cta-banner';
import { ctaButtonEntry } from '@/components/cms-custom/cta-button';
import { featureListEntry } from '@/components/cms-custom/feature-list';
import { cmsFooterEntry } from '@/components/cms-custom/footer';
import { galleryEntry } from '@/components/cms-custom/gallery';
import { cmsHeaderEntry } from '@/components/cms-custom/header';
import { headingEntry } from '@/components/cms-custom/heading';
import { heroBannerEntry } from '@/components/cms-custom/hero-banner';
import { imageEntry } from '@/components/cms-custom/image';
import { imageTextEntry } from '@/components/cms-custom/image-text';
import { newsletterSignupEntry } from '@/components/cms-custom/newsletter-signup';
import { productCarouselEntry } from '@/components/cms-custom/product-carousel';
import { productGridEntry } from '@/components/cms-custom/product-grid';
import { promoCardEntry } from '@/components/cms-custom/promo-card';
import { quoteEntry } from '@/components/cms-custom/quote';
import { richTextEntry } from '@/components/cms-custom/rich-text';
import { sectionEntry } from '@/components/cms-custom/section';
import { spacerEntry } from '@/components/cms-custom/spacer';
import { cmsTopBarEntry } from '@/components/cms-custom/top-bar';
import { videoEntry } from '@/components/cms-custom/video';
import { injectable } from '@/platform/core/di/injectable';

const definitionMap: Record<string, CMSComponentEntry> = {
  [cmsTopBarEntry.definition.type]: cmsTopBarEntry,
  [cmsHeaderEntry.definition.type]: cmsHeaderEntry,
  [cmsFooterEntry.definition.type]: cmsFooterEntry,
  [heroBannerEntry.definition.type]: heroBannerEntry,
  [sectionEntry.definition.type]: sectionEntry,
  [spacerEntry.definition.type]: spacerEntry,
  [richTextEntry.definition.type]: richTextEntry,
  [headingEntry.definition.type]: headingEntry,
  [imageEntry.definition.type]: imageEntry,
  [imageTextEntry.definition.type]: imageTextEntry,
  [videoEntry.definition.type]: videoEntry,
  [galleryEntry.definition.type]: galleryEntry,
  [quoteEntry.definition.type]: quoteEntry,
  [ctaButtonEntry.definition.type]: ctaButtonEntry,
  [ctaBannerEntry.definition.type]: ctaBannerEntry,
  [newsletterSignupEntry.definition.type]: newsletterSignupEntry,
  [featureListEntry.definition.type]: featureListEntry,
  [productGridEntry.definition.type]: productGridEntry,
  [productCarouselEntry.definition.type]: productCarouselEntry,
  [categoryTileRowEntry.definition.type]: categoryTileRowEntry,
  [promoCardEntry.definition.type]: promoCardEntry,
};

@injectable('EmporixCMSComponentService', 'Singleton')
export class StorefrontCMSComponentService extends AbstractCMSComponentService {
  constructor() {
    super(definitionMap);
  }
}

export default StorefrontCMSComponentService;
