export interface HomepageTextItem {
  text: string;
}

export interface HomepageStat {
  value: string;
  label: string;
}

export interface HomepageBannerSlide {
  headline: string;
  subtitle: string;
  ctaText: string;
  badgeText?: string;
}

export interface HomepageCollectionItem {
  name: string;
  category: string;
  imageUrl: string;
}

export interface HomepageOccasionItem {
  name: string;
  tagline: string;
  imageUrl: string;
}

export interface HomepageWhyItem {
  title: string;
  text: string;
}

export interface HomepageTestimonial {
  quote: string;
  name: string;
  rating: number;
}

export interface HomepageContent {
  topBar: { enabled: boolean; items: HomepageTextItem[] };
  hero: {
    headline: string;
    subtitle: string;
    ctaText: string;
    badgeText?: string;
  };
  bannerSlides: HomepageBannerSlide[];
  stats: { enabled: boolean; items: HomepageStat[] };
  collections: {
    enabled: boolean;
    title: string;
    subtitle: string;
    ctaText: string;
    items: HomepageCollectionItem[];
  };
  featuredBanner: {
    enabled: boolean;
    eyebrow: string;
    title: string;
    subtitle: string;
    ctaText: string;
    imageUrl: string;
    links: string[];
  };
  trending: {
    enabled: boolean;
    title: string;
    subtitle: string;
  };
  occasions: {
    enabled: boolean;
    title: string;
    items: HomepageOccasionItem[];
  };
  whyChoose: {
    enabled: boolean;
    title: string;
    items: HomepageWhyItem[];
  };
  story: {
    enabled: boolean;
    eyebrow: string;
    title: string;
    body: string;
    ctaText: string;
    imageUrl: string;
  };
  customJewellery: {
    enabled: boolean;
    eyebrow: string;
    title: string;
    body: string;
    ctaText: string;
    imageUrl: string;
  };
  cataloguePromo: {
    enabled: boolean;
    title: string;
    body: string;
    browseText: string;
    downloadText: string;
    imageUrl: string;
  };
  testimonials: {
    enabled: boolean;
    title: string;
    items: HomepageTestimonial[];
  };
  footer: {
    newsletterTitle: string;
    tagline: string;
  };
}

export interface CustomSection {
  id: string;
  title: string;
  body?: string;
  html?: string;
  css?: string;
  imageUrl?: string;
  enabled: boolean;
  placement?: string;
  [key: string]: unknown;
}

export interface StorefrontTheme {
  primaryColor?: string;
  accentColor?: string;
  fontColor?: string;
  headerColor?: string;
  headerTextColor?: string;
}

export interface StorefrontConfig {
  id?: number;
  vendorId: number;
  vendorName?: string;
  tagline: string;
  showBanner: boolean;
  bannerUrl: string;
  bannerUrls: string[];
  logoUrl: string;
  showFeatured: boolean;
  showContact: boolean;
  showAbout: boolean;
  aboutText: string;
  featuredProductIds: number[];
  homeProductLimit: number;
  customSections: CustomSection[];
  theme: StorefrontTheme;
  homepage: HomepageContent;
}

export interface StorefrontFormData {
  tagline: string;
  showBanner: boolean;
  bannerUrl: string;
  bannerUrls: string[];
  logoUrl: string;
  showFeatured: boolean;
  showContact: boolean;
  showAbout: boolean;
  aboutText: string;
  featuredProductIds: number[];
  homeProductLimit: number;
  customSections: CustomSection[];
  theme: StorefrontTheme;
  homepage: HomepageContent;
}

export interface PublicVendor {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  website?: string;
}

export interface PublicStoreContext {
  storeCode: string;
  vendor: PublicVendor;
  config: StorefrontConfig;
  isAvailable: boolean;
}

export interface PublicStorefrontPage extends PublicStoreContext {
  featuredProducts: PublicProduct[];
}

export interface PublicProduct {
  id: number;
  name: string;
  description?: string;
  category?: string;
  metalType?: string;
  purity?: string;
  weight?: number;
  sku?: string;
  price?: number;
  listPrice?: number;
  priceVisible?: boolean;
  isSpecialPrice?: boolean;
  imageUrl?: string;
  images?: string[];
}

export interface CatalogShareRecord {
  shortCode: string;
  vendorId: number;
  storeCode: string;
  payload: CatalogSharePayload;
  createdAt: string;
  url: string;
}

export interface CatalogSharePayload {
  v?: number;
  productIds?: number[];
  category?: string;
  metalType?: string;
  minPrice?: number;
  maxPrice?: number;
  specialPrices?: Record<string, number>;
  leadId?: number;
  customerName?: string;
  customerPhone?: string;
  shareLabel?: string;
  [key: string]: unknown;
}
