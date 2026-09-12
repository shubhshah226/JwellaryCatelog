import { CustomSection, StorefrontConfig } from '../models/storefront.model';
import { createDefaultHomepage, DEFAULT_BANNER_URLS, mergeHomepage } from './homepage.defaults';

export const DEFAULT_STOREFRONT_THEME = {
  primaryColor: '#c9a227',
  accentColor: '#141414',
  headerColor: '#141414',
  headerTextColor: '#ffffff',
  fontColor: '#1c1917',
};

export function createDefaultStorefront(vendorId: number | string, vendorName: string): StorefrontConfig {
  return {
    vendorId,
    tagline: `Welcome to ${vendorName}`,
    showBanner: true,
    bannerUrl: DEFAULT_BANNER_URLS[0],
    bannerUrls: [...DEFAULT_BANNER_URLS],
    logoUrl: '',
    showFeatured: true,
    showContact: true,
    showAbout: true,
    aboutText: `Discover our curated jewellery collection at ${vendorName}.`,
    featuredProductIds: [],
    homeProductLimit: 5,
    customSections: [],
    theme: { ...DEFAULT_STOREFRONT_THEME },
    homepage: createDefaultHomepage(vendorName),
  };
}

export function mergeStorefrontWithDefaults(
  stored: Partial<StorefrontConfig> | null,
  vendorId: number | string,
  vendorName: string
): StorefrontConfig {
  const defaults = createDefaultStorefront(vendorId, vendorName);

  if (!stored) {
    return defaults;
  }

  const bannerUrls =
    stored.bannerUrls?.length
      ? stored.bannerUrls
      : stored.bannerUrl
        ? [stored.bannerUrl]
        : defaults.bannerUrls;

  const homepage = mergeHomepage(stored.homepage, vendorName);
  if (stored.aboutText && !stored.homepage?.story?.body) {
    homepage.story = { ...homepage.story, body: stored.aboutText };
  }

  return {
    ...defaults,
    ...stored,
    vendorId,
    bannerUrls,
    bannerUrl: bannerUrls[0] ?? stored.bannerUrl ?? '',
    theme: { ...defaults.theme, ...stored.theme },
    featuredProductIds: stored.featuredProductIds ?? defaults.featuredProductIds,
    homeProductLimit: stored.homeProductLimit ?? defaults.homeProductLimit,
    customSections: stored.customSections ?? defaults.customSections,
    homepage,
  };
}

export function createEmptySection(): CustomSection {
  return {
    id: crypto.randomUUID(),
    title: 'Custom Block',
    placement: 'after_banner',
    html: '<p>Your custom content here</p>',
    css: 'p { color: inherit; text-align: center; padding: 1rem; }',
    enabled: true,
  };
}
