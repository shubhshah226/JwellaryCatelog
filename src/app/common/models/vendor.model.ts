export type VendorPlan = 'premium' | 'standard' | 'basic';
export type VendorStatus = 'active' | 'inactive' | 'trial';
export type SubscriptionType = 'renewal' | 'expiry' | 'trial';

/** API accountStatus values for /admin/updateTenantStatus */
export type TenantAccountStatus = 'active' | 'suspended';

/** Payload for POST /admin/updateTenantStatus */
export class UpdateTenantStatusParamModel {
  public tenantId: string = '';
  public accountStatus: TenantAccountStatus = 'active';
}

/** Payload for POST /admin/resetOwnerPassword — API generates the password. */
export class ResetOwnerPasswordParamModel {
  public tenantId: string = '';
}

/** Allowed masterType values for /admin/addTenant */
export type VendorMasterType = 'metal_type' | 'purity' | 'color';

export interface VendorMasterItem {
  masterType: VendorMasterType;
  masterValue: string;
}

export interface VendorAccount {
  /** Tenant UUID from new API */
  id: string;
  storeCode?: string;
  userId?: string;
  name: string;
  initials: string;
  website: string;
  email: string;
  phone: string;
  alternativePhone?: string;
  contactPerson?: string;
  plan: VendorPlan;
  status: VendorStatus;
  subscription: string;
  subscriptionType: SubscriptionType;
  subscriptionDate?: string;
  joinedOn: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  logoUrl?: string;
  catalogsCount: number;
  totalSales: number;
  rank: number;
  productCount?: number;
  enquiryCount?: number;
  brandColor?: string;
  currency?: string;
  catalogExpiryDays?: number;
  priceVisibleDefault?: boolean;
}

export interface VendorLoginCredentials {
  username: string;
  password: string;
  emailSent: boolean;
  loginUrl?: string;
}

export interface VendorCreateResult {
  vendor: VendorAccount;
  loginCredentials?: VendorLoginCredentials;
}

export interface VendorStats {
  id: number;
  total: number;
  active: number;
  inactive: number;
  trial: number;
  totalChange: number;
  activeChange: number;
  inactiveChange: number;
  trialChange: number;
  sparklines: {
    total: number[];
    active: number[];
    inactive: number[];
    trial: number[];
  };
}

/** Superadmin add/edit vendor form aligned to /admin/addTenant */
export interface VendorFormData {
  businessName: string;
  ownerName: string;
  ownerEmail: string;
  contactPhone: string;
  city: string;
  brandColor: string;
  currency: string;
  catalogExpiryDays: number | null;
  priceVisibleDefault: boolean;
  /** Product categories as plain names → API `categories: string[]` */
  categories: string[];
  /** Metal types (masterType = metal_type) */
  metalTypes: string[];
  /** Purities (masterType = purity) */
  purities: string[];
  /** Colors (masterType = color) */
  colors: string[];
  status: 'active' | 'inactive';
  vendorId?: string | null;
  storeCode?: string;
  /** Kept for edit mapping compatibility */
  website?: string;
  address?: string;
  state?: string;
  pincode?: string;
  alternativePhone?: string;
}

export function createEmptyVendorForm(): VendorFormData {
  return {
    businessName: '',
    ownerName: '',
    ownerEmail: '',
    contactPhone: '',
    city: '',
    brandColor: '#8B0000',
    currency: 'INR',
    catalogExpiryDays: 30,
    priceVisibleDefault: true,
    categories: [],
    metalTypes: [],
    purities: [],
    colors: [],
    status: 'active',
    vendorId: null,
    storeCode: '',
    website: '',
    address: '',
    state: '',
    pincode: '',
    alternativePhone: '',
  };
}

/** Build API masters array from the three UI lists. */
export function buildVendorMasters(form: VendorFormData): VendorMasterItem[] {
  const masters: VendorMasterItem[] = [];
  for (const value of form.metalTypes) {
    const masterValue = value.trim();
    if (masterValue) {
      masters.push({ masterType: 'metal_type', masterValue });
    }
  }
  for (const value of form.purities) {
    const masterValue = value.trim();
    if (masterValue) {
      masters.push({ masterType: 'purity', masterValue });
    }
  }
  for (const value of form.colors) {
    const masterValue = value.trim();
    if (masterValue) {
      masters.push({ masterType: 'color', masterValue });
    }
  }
  return masters;
}
