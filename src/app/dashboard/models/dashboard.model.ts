export type CatalogStatus = 'active' | 'inactive' | 'pending' | 'expired';
export type EnquiryStatus = 'new' | 'in_progress' | 'responded' | 'closed';

export interface Vendor {
  id: string;
  userId?: string;
  name: string;
  initials: string;
  catalogsCount: number;
  totalSales: number;
  rank: number;
}

export interface Catalog {
  id: string;
  vendorId?: string | null;
  name: string;
  status: CatalogStatus;
  productCount?: number;
  shareUrl?: string | null;
  shortCode?: string | null;
  token?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  whatsappUrl?: string | null;
}

export type ProductStatus = 'in_stock' | 'out_of_stock' | 'make_to_order' | 'active' | 'inactive';

export const PRODUCT_STOCK_STATUSES = [
  { value: 'in_stock', label: 'In Stock' },
  { value: 'out_of_stock', label: 'Out Of Stock' },
  { value: 'make_to_order', label: 'Make to Order' },
] as const;

/** @deprecated Prefer master-data API categories */
export const PRODUCT_CATEGORIES = [
  'Necklaces',
  'Rings',
  'Earrings',
  'Bangles',
  'Chains',
  'Pendants',
  'Headpieces',
  'Bracelets',
] as const;

/** @deprecated Prefer master-data API metal types */
export const METAL_TYPES = ['Gold', 'Silver', 'Diamond', 'Platinum', 'Gemstone', 'Mixed'] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
export type MetalType = (typeof METAL_TYPES)[number];

export interface Product {
  id: string;
  vendorId?: string | null;
  catalogId?: string | null;
  name: string;
  category: string;
  categoryId?: string | null;
  description?: string;
  price?: number | null;
  imageUrl?: string;
  images?: string[];
  metalType?: string;
  metalTypeId?: string | null;
  weight?: string;
  purity?: string;
  purityId?: string | null;
  sku?: string;
  color?: string;
  colorId?: string | null;
  status?: ProductStatus;
  stockStatus?: string;
}

export interface ProductFormData {
  name: string;
  category: string;
  catalogId: string | null;
  description: string;
  price: number | null;
  /** Public cover image (base64 data URL or hosted URL). */
  imageUrl: string;
  /** Extra images shown only after customer OTP verify. */
  galleryImages: string[];
  /** Combined [cover, ...gallery] for backward helpers. */
  images: string[];
  metalType: string;
  weight: string;
  purity: string;
  sku: string;
  color: string;
  status: ProductStatus;
}

export function createEmptyProductForm(): ProductFormData {
  return {
    name: '',
    category: '',
    catalogId: null,
    description: '',
    price: null,
    imageUrl: '',
    galleryImages: [],
    images: [],
    metalType: '',
    weight: '',
    purity: '',
    sku: '',
    color: '',
    status: 'in_stock',
  };
}

export interface Enquiry {
  id: string;
  vendorId?: string | null;
  customerName: string;
  customerPhone?: string;
  initials: string;
  message: string;
  status: EnquiryStatus;
  timeAgo: string;
  /** @deprecated Prefer items[] for multi-product leads */
  productId?: string;
  /** Summary label; for multi-product use items */
  productName?: string;
  interestType?: 'interested' | 'enquiry' | string;
  createdAt?: string;
  itemCount?: number;
  items?: LeadItem[];
  catalogId?: string;
  token?: string;
  totalPrice?: number;
}

export interface LeadItem {
  productId: string;
  productName: string;
  category?: string;
  price?: number;
  imageUrl?: string;
  sku?: string;
  quantity?: number;
}

export interface SaleRecord {
  id: number;
  vendorId: number;
  date: string;
  amount: number;
}

export interface DashboardMeta {
  id: number;
  vendorsChange: number;
  catalogsChange: number;
  productsChange: number;
  enquiriesChange: number;
  dateRange: string;
}

export interface StatCard {
  label: string;
  value: number;
  change: number;
  icon: 'vendors' | 'catalogs' | 'products' | 'enquiries';
  color: string;
  hidden?: boolean;
}

export interface ChartPoint {
  date: string;
  label: string;
  amount: number;
  x: number;
  y: number;
}

export interface DonutSegment {
  label: string;
  value: number;
  percentage: number;
  color: string;
  offset: number;
}

export interface DashboardData {
  isAdmin: boolean;
  userName: string;
  roleLabel: string;
  dateRange: string;
  stats: StatCard[];
  salesChart: ChartPoint[];
  salesMax: number;
  topVendors: Vendor[];
  enquirySegments: DonutSegment[];
  enquiryTotal: number;
  catalogSegments: DonutSegment[];
  catalogTotal: number;
  recentEnquiries: Enquiry[];
  vendorSalesTotal: number;
}

export class DashboardSummary {
  tenantCount: number = 0;
  activeTenantCount: number = 0;
  suspendedTenantCount: number = 0;
  newTenantCount: number = 0;
  productCount: number = 0;
  catalogCount: number = 0;
  viewedCatalogCount: number = 0;
  enquiryCount: number = 0;
  newEnquiryCount: number = 0;
}
