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
  catalogsCount: number;
  totalSales: number;
  rank: number;
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

export interface VendorFormData {
  name: string;
  website: string;
  email: string;
  phone: string;
  contactPerson: string;
  plan: VendorPlan;
  status: VendorStatus;
  subscriptionType: SubscriptionType;
  subscriptionDate: string;
  joinedOn: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

export function createEmptyVendorForm(): VendorFormData {
  return {
    name: '',
    website: '',
    email: '',
    phone: '',
    contactPerson: '',
    plan: 'standard',
    status: 'active',
    subscriptionType: 'renewal',
    subscriptionDate: '',
    joinedOn: new Date().toISOString().slice(0, 10),
    address: '',
    city: '',
    state: '',
    pincode: '',
  };
}
