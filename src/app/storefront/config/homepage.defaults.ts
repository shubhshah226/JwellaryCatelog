import { HomepageContent, HomepageStat } from '../models/storefront.model';

/**
 * Curated jewellery photography (Unsplash) â€” gold, diamond, bridal, everyday.
 * Used as defaults before a vendor uploads their own media.
 */
export const HOME_IMAGES = {
  /** Banner slide 1 â€” gold jewellery close-up */
  hero: 'https://images.unsplash.com/photo-1611652022419-a9419f74343a?auto=format&fit=crop&w=1400&q=80',
  /** Banner slide 2 â€” bridal / festive jewellery */
  heroBridal: 'https://images.unsplash.com/photo-1601121141461-9d51bffe2d04?auto=format&fit=crop&w=1400&q=80',
  /** Banner slide 3 â€” diamond rings */
  heroDiamond: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1400&q=80',
  rings: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=600&q=80',
  necklaces: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80',
  earrings: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=600&q=80',
  bangles: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=600&q=80',
  pendants: 'https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=600&q=80',
  bridal: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1400&q=80',
  mens: 'https://images.unsplash.com/photo-1611651338412-84074bddf964?auto=format&fit=crop&w=600&q=80',
  gifts: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=600&q=80',
  engagement: 'https://images.unsplash.com/photo-1606800052052-a08af7148866?auto=format&fit=crop&w=800&q=80',
  wedding: 'https://images.unsplash.com/photo-1601121141461-9d51bffe2d04?auto=format&fit=crop&w=800&q=80',
  festive: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80',
  everyday: 'https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=800&q=80',
  gifting: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=800&q=80',
  store: 'https://images.unsplash.com/photo-1573408301185-9146fe634ad3?auto=format&fit=crop&w=1200&q=80',
  sketch: 'https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=1200&q=80',
  catalogue: 'https://images.unsplash.com/photo-1611652022419-a9419f74343a?auto=format&fit=crop&w=1200&q=80',
};

/** Default banner carousel URLs for a fresh jewellery storefront. */
export const DEFAULT_BANNER_URLS = [
  HOME_IMAGES.hero,
  HOME_IMAGES.heroBridal,
  HOME_IMAGES.heroDiamond,
];

export function createDefaultHomepage(vendorName = ''): HomepageContent {
  const brand = vendorName || 'our atelier';
  const story = vendorName
    ? `${vendorName} crafts hallmarked gold and certified diamond jewellery for weddings, festivals and everyday elegance â€” pieces made to be worn, loved and passed on.`
    : 'A family of jewellers dedicated to hallmarked gold, certified diamonds and timeless design.';

  return {
    topBar: {
      enabled: true,
      items: [
        { text: 'BIS Hallmarked Gold' },
        { text: 'IGI / GIA Certified Diamonds' },
        { text: 'Insured Pan-India Delivery' },
        { text: 'Lifetime Exchange Value' },
      ],
    },
    hero: {
      headline: 'Gold & Diamond Jewellery',
      subtitle:
        'Discover hallmarked gold, certified diamonds and bridal heirlooms â€” crafted for your most precious moments.',
      ctaText: 'Explore Collection',
      badgeText: 'BIS Hallmarked â†’',
    },
    bannerSlides: [
      {
        headline: 'Gold & Diamond Jewellery',
        subtitle:
          'Discover hallmarked gold, certified diamonds and bridal heirlooms â€” crafted for your most precious moments.',
        ctaText: 'Explore Collection',
        badgeText: 'BIS Hallmarked â†’',
      },
      {
        headline: 'Bridal Heirlooms',
        subtitle:
          'Necklace sets, polki and kundan pieces designed for the wedding day â€” and the generations after.',
        ctaText: 'View Bridal',
        badgeText: 'Wedding Edit â†’',
      },
      {
        headline: 'Diamond Solitaires',
        subtitle:
          'Brilliant-cut diamonds in gold and platinum â€” engagement rings and everyday sparkle.',
        ctaText: 'Shop Diamonds',
        badgeText: 'Certified â†’',
      },
    ],
    stats: {
      enabled: true,
      items: [
        { value: '5000+', label: 'Happy Families' },
        { value: '100%', label: 'Hallmarked Gold' },
        { value: '25+', label: 'Years of Craft' },
        { value: '4.9', label: 'Customer Rating' },
      ],
    },
    collections: {
      enabled: true,
      title: 'Shop by Category',
      subtitle: 'Browse rings, necklaces, earrings and more â€” curated for every occasion.',
      ctaText: 'View All Collections',
      items: [
        { name: 'Rings', category: 'Rings', imageUrl: HOME_IMAGES.rings },
        { name: 'Necklaces', category: 'Necklaces', imageUrl: HOME_IMAGES.necklaces },
        { name: 'Earrings', category: 'Earrings', imageUrl: HOME_IMAGES.earrings },
        { name: 'Bangles', category: 'Bangles', imageUrl: HOME_IMAGES.bangles },
        { name: 'Pendants', category: 'Pendants', imageUrl: HOME_IMAGES.pendants },
        { name: 'Bridal', category: 'Necklaces', imageUrl: HOME_IMAGES.bridal },
        { name: "Men's Gold", category: 'Chains', imageUrl: HOME_IMAGES.mens },
        { name: 'Gifts', category: 'Pendants', imageUrl: HOME_IMAGES.gifts },
      ],
    },
    featuredBanner: {
      enabled: true,
      eyebrow: 'Featured Collection',
      title: 'The Bridal Edit',
      subtitle:
        'Temple sets, polki necklaces and matching earrings â€” jewellery for the most important day.',
      ctaText: 'Explore Bridal Jewellery',
      imageUrl: HOME_IMAGES.bridal,
      links: ['Necklaces', 'Earrings', 'Bangles', 'Rings'],
    },
    trending: {
      enabled: true,
      title: 'Trending Now',
      subtitle: 'Pieces customers are choosing this season from our gold and diamond floor.',
    },
    occasions: {
      enabled: true,
      title: 'Jewellery for Every Occasion',
      items: [
        { name: 'Engagement', tagline: 'A promise in diamond', imageUrl: HOME_IMAGES.engagement },
        { name: 'Wedding', tagline: 'Bridal splendour', imageUrl: HOME_IMAGES.wedding },
        { name: 'Festive', tagline: 'Celebrate in gold', imageUrl: HOME_IMAGES.festive },
        { name: 'Everyday', tagline: 'Quiet luxury', imageUrl: HOME_IMAGES.everyday },
        { name: 'Gifting', tagline: 'Made to remember', imageUrl: HOME_IMAGES.gifting },
      ],
    },
    whyChoose: {
      enabled: true,
      title: vendorName ? `Why Choose ${vendorName}?` : 'Why Choose Us',
      items: [
        { title: 'Hallmarked Gold', text: 'Every gold piece carries BIS hallmark purity assurance.' },
        { title: 'Certified Diamonds', text: 'IGI / GIA certified stones with transparent grading.' },
        { title: 'Secure Delivery', text: 'Insured shipping across India with careful packaging.' },
        { title: 'Easy Exchange', text: 'Lifetime exchange value on eligible gold jewellery.' },
        { title: 'Expert Craft', text: 'Designers and karigars dedicated to fine jewellery.' },
      ],
    },
    story: {
      enabled: true,
      eyebrow: 'Our Story',
      title: `The ${brand === 'our atelier' ? 'House' : brand} Legacy`,
      body: story,
      ctaText: 'Know Our Story',
      imageUrl: HOME_IMAGES.store,
    },
    customJewellery: {
      enabled: true,
      eyebrow: 'Bespoke',
      title: 'Crafted Just for You',
      body: 'Bring a sketch, an heirloom stone, or a family motif â€” we will craft a piece that is uniquely yours.',
      ctaText: 'Start Your Design',
      imageUrl: HOME_IMAGES.sketch,
    },
    cataloguePromo: {
      enabled: true,
      title: 'Browse the Full Catalogue',
      body: 'Explore gold, diamond and bridal collections online, or visit the store for a private viewing.',
      browseText: 'Browse Catalogue',
      downloadText: 'Request Catalogue',
      imageUrl: HOME_IMAGES.catalogue,
    },
    testimonials: {
      enabled: true,
      title: 'Loved by Our Customers',
      items: [
        {
          quote: 'Our bridal set from them was beyond what we imagined â€” every detail felt personal.',
          name: 'Ananya S.',
          rating: 5,
        },
        {
          quote: 'Hallmarked quality and warm service. We have been clients for years.',
          name: 'Rahul M.',
          rating: 5,
        },
        {
          quote: "They remade my grandmother's gold into a pendant. Beautiful craftsmanship.",
          name: 'Meera K.',
          rating: 5,
        },
      ],
    },
    footer: {
      newsletterTitle: 'Stay Close to the Sparkle',
      tagline: 'New gold & diamond collections, bridal previews and jewellery stories.',
    },
  };
}

export function mergeHomepage(
  stored: Partial<HomepageContent> | null | undefined,
  vendorName = ''
): HomepageContent {
  const base = createDefaultHomepage(vendorName);
  if (!stored) {
    return base;
  }
  return {
    ...base,
    ...stored,
    topBar: {
      ...base.topBar,
      ...stored.topBar,
      items: stored.topBar?.items?.length ? stored.topBar.items : base.topBar.items,
    },
    hero: { ...base.hero, ...stored.hero },
    bannerSlides: Array.isArray(stored.bannerSlides) ? stored.bannerSlides : base.bannerSlides,
    stats: normalizeStats(stored.stats, base.stats),
    collections: {
      ...base.collections,
      ...stored.collections,
      subtitle: stored.collections?.subtitle || base.collections.subtitle,
      items: fillItemImages(
        stored.collections?.items?.length ? stored.collections.items : base.collections.items,
        base.collections.items
      ),
    },
    featuredBanner: {
      ...base.featuredBanner,
      ...stored.featuredBanner,
      imageUrl: stored.featuredBanner?.imageUrl || base.featuredBanner.imageUrl,
    },
    trending: { ...base.trending, ...stored.trending },
    occasions: {
      ...base.occasions,
      ...stored.occasions,
      items: fillItemImages(
        stored.occasions?.items?.length ? stored.occasions.items : base.occasions.items,
        base.occasions.items
      ),
    },
    whyChoose: {
      ...base.whyChoose,
      ...stored.whyChoose,
      title:
        stored.whyChoose?.title && stored.whyChoose.title !== 'Why Choose Us'
          ? stored.whyChoose.title
          : base.whyChoose.title,
      items: stored.whyChoose?.items?.length ? stored.whyChoose.items : base.whyChoose.items,
    },
    story: {
      ...base.story,
      ...stored.story,
      imageUrl: stored.story?.imageUrl || base.story.imageUrl,
    },
    customJewellery: {
      ...base.customJewellery,
      ...stored.customJewellery,
      imageUrl: stored.customJewellery?.imageUrl || base.customJewellery.imageUrl,
    },
    cataloguePromo: {
      ...base.cataloguePromo,
      ...stored.cataloguePromo,
      imageUrl: stored.cataloguePromo?.imageUrl || base.cataloguePromo.imageUrl,
    },
    testimonials: {
      ...base.testimonials,
      ...stored.testimonials,
      items: stored.testimonials?.items?.length
        ? stored.testimonials.items
        : base.testimonials.items,
    },
    footer: { ...base.footer, ...stored.footer },
  };
}

function fillItemImages<T extends { name: string; imageUrl: string }>(items: T[], fallback: T[]): T[] {
  return items.map((item) => ({
    ...item,
    imageUrl: item.imageUrl || fallback.find((f) => f.name === item.name)?.imageUrl || '',
  }));
}

/** Accept legacy stats array or { enabled, items }. */
function normalizeStats(
  stored: HomepageContent['stats'] | HomepageStat[] | null | undefined,
  base: HomepageContent['stats']
): HomepageContent['stats'] {
  if (!stored) {
    return base;
  }
  if (Array.isArray(stored)) {
    return {
      enabled: true,
      items: stored.length ? stored : base.items,
    };
  }
  return {
    enabled: stored.enabled !== false,
    items: stored.items?.length ? stored.items : base.items,
  };
}
