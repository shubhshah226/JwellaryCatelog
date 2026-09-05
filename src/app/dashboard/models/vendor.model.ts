export type VendorPlan = 'premium' | 'standard' | 'basic';
export type VendorStatus = 'active' | 'inactive' | 'trial';
export type SubscriptionType = 'renewal' | 'expiry' | 'trial';
export type VendorSortField = 'name' | 'email' | 'plan' | 'status' | 'subscription' | 'joinedOn';
export type SortDirection = 'asc' | 'desc';

export interface VendorAccount {
  id: number;
  storeCode?: string;
  userId?: number;
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

export interface VendorFilters {
  search: string;
  status: string;
  plan: string;
  subscription: string;
  joinedDate: string;
}

/** Admin jeweller form — plan/subscription stay API defaults. */
export interface VendorFormData {
  name: string;
  website: string;
  contactPerson: string;
  email: string;
  phone: string;
  alternativePhone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  status: 'active' | 'inactive';
  /** Read-only display of DB id when editing */
  vendorId?: number | null;
  storeCode?: string;
}

export function createEmptyVendorForm(): VendorFormData {
  return {
    name: '',
    website: '',
    contactPerson: '',
    email: '',
    phone: '',
    alternativePhone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    status: 'active',
    vendorId: null,
    storeCode: '',
  };
}
