import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogSharePayload, CatalogShareService } from '../../core/services/catalog-share.service';
import { formatInIndia, relativeTimeFromUtc } from '../../core/utils/date-time.util';
import { buildPublicStoreUrl } from '../../core/utils/store-code.util';
import { Enquiry, Product } from '../../dashboard/models/dashboard.model';
import { ProductService } from '../services/product.service';
import { VendorDataService } from '../services/vendor-data.service';

interface ShareLine {
  productId: number;
  name: string;
  category?: string;
  sku?: string;
  imageUrl?: string;
  catalogPrice: number;
  specialPrice: number | null;
  fromLead: boolean;
}

@Component({
  selector: 'app-vendor-leads',
  imports: [FormsModule, CurrencyPipe],
  templateUrl: './leads.html',
  styleUrls: ['../shared/vendor-page.css', './leads.css'],
})
export class VendorLeads implements OnInit {
  private readonly vendorData = inject(VendorDataService);
  private readonly productService = inject(ProductService);
  private readonly catalogShareService = inject(CatalogShareService);

  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly allLeads = signal<Enquiry[]>([]);
  readonly filteredLeads = signal<Enquiry[]>([]);
  readonly expandedIds = signal<Set<number>>(new Set());
  readonly allProducts = signal<Product[]>([]);
  readonly vendorId = signal(0);
  readonly storeCode = signal('');

  readonly shareOpen = signal(false);
  readonly activeLead = signal<Enquiry | null>(null);
  readonly shareLines = signal<ShareLine[]>([]);
  readonly shareGenerating = signal(false);
  readonly shareLink = signal('');
  readonly shareCopied = signal(false);
  readonly shareError = signal('');
  readonly shareProductSearch = signal('');
  shareLabel = '';

  search = '';
  status = 'all';

  readonly newCount = computed(
    () => this.filteredLeads().filter((l) => l.status === 'new').length
  );
  readonly inProgressCount = computed(
    () => this.filteredLeads().filter((l) => l.status === 'in_progress').length
  );
  readonly interestedCount = computed(
    () => this.filteredLeads().filter((l) => l.interestType === 'interested').length
  );

  readonly addableProducts = computed(() => {
    const selected = new Set(this.shareLines().map((l) => l.productId));
    const term = this.shareProductSearch().trim().toLowerCase();
    return this.allProducts()
      .filter((p) => p.status !== 'inactive' && !selected.has(p.id))
      .filter(
        (p) =>
          !term ||
          p.name.toLowerCase().includes(term) ||
          (p.sku ?? '').toLowerCase().includes(term) ||
          p.category.toLowerCase().includes(term)
      )
      .slice(0, 40);
  });

  ngOnInit(): void {
    this.vendorData.getProfile().subscribe({
      next: (profile) => {
        if (profile) {
          this.vendorId.set(profile.id);
          this.storeCode.set(profile.storeCode ?? '');
        }
      },
    });

    this.productService.getVendorProducts().subscribe({
      next: (products) => this.allProducts.set(products),
    });

    this.vendorData.getLeads().subscribe({
      next: (leads) => {
        this.allLeads.set(leads);
        this.filteredLeads.set(leads);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load leads. Please ensure the API is running on port 8001.');
        this.isLoading.set(false);
      },
    });
  }

  applyFilters(): void {
    this.filteredLeads.set(
      this.vendorData.filterLeads(this.allLeads(), this.search, this.status)
    );
  }

  resetFilters(): void {
    this.search = '';
    this.status = 'all';
    this.applyFilters();
  }

  formatStatus(status: string): string {
    return status.replace('_', ' ');
  }

  formatPhone(phone?: string): string {
    if (!phone) {
      return 'â€”';
    }
    return `+91 ${phone}`;
  }

  itemCount(lead: Enquiry): number {
    return lead.itemCount ?? lead.items?.length ?? (lead.productName ? 1 : 0);
  }

  isExpanded(id: number): boolean {
    return this.expandedIds().has(id);
  }

  toggleExpand(id: number): void {
    const next = new Set(this.expandedIds());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.expandedIds.set(next);
  }

  productSummary(lead: Enquiry): string {
    const count = this.itemCount(lead);
    if (count <= 1) {
      return lead.items?.[0]?.productName ?? lead.productName ?? 'â€”';
    }
    return `${count} products`;
  }

  /** API sends UTC; display as India Standard Time. */
  formatLeadTime(lead: Enquiry): string {
    return formatInIndia(lead.createdAt);
  }

  formatLeadRelative(lead: Enquiry): string {
    return relativeTimeFromUtc(lead.createdAt) || lead.timeAgo || '';
  }

  openShareForLead(lead: Enquiry): void {
    this.activeLead.set(lead);
    this.shareLink.set('');
    this.shareCopied.set(false);
    this.shareError.set('');
    this.shareProductSearch.set('');
    this.shareLabel = `Special offer for ${lead.customerName}`;

    const catalogById = new Map(this.allProducts().map((p) => [p.id, p]));
    const lines: ShareLine[] = [];

    const items =
      lead.items?.length
        ? lead.items
        : lead.productId
          ? [
              {
                productId: lead.productId,
                productName: lead.productName ?? 'Product',
                price: undefined as number | undefined,
                category: undefined as string | undefined,
                sku: undefined as string | undefined,
                imageUrl: undefined as string | undefined,
              },
            ]
          : [];

    for (const item of items) {
      const product = catalogById.get(item.productId);
      const catalogPrice = Number(product?.price ?? item.price ?? 0);
      lines.push({
        productId: item.productId,
        name: product?.name ?? item.productName,
        category: product?.category ?? item.category,
        sku: product?.sku ?? item.sku,
        imageUrl: product?.imageUrl ?? item.imageUrl,
        catalogPrice,
        specialPrice: catalogPrice > 0 ? catalogPrice : null,
        fromLead: true,
      });
    }

    this.shareLines.set(lines);
    this.shareOpen.set(true);
  }

  closeShare(): void {
    this.shareOpen.set(false);
    this.activeLead.set(null);
  }

  addProductToShare(product: Product): void {
    if (this.shareLines().some((l) => l.productId === product.id)) {
      return;
    }
    const catalogPrice = Number(product.price ?? 0);
    this.shareLines.update((lines) => [
      ...lines,
      {
        productId: product.id,
        name: product.name,
        category: product.category,
        sku: product.sku,
        imageUrl: product.imageUrl,
        catalogPrice,
        specialPrice: catalogPrice > 0 ? catalogPrice : null,
        fromLead: false,
      },
    ]);
  }

  removeShareLine(productId: number): void {
    this.shareLines.update((lines) => lines.filter((l) => l.productId !== productId));
  }

  setSpecialPrice(productId: number, value: string | number | null): void {
    const n =
      value === null || value === ''
        ? null
        : Number(value);
    this.shareLines.update((lines) =>
      lines.map((line) =>
        line.productId === productId
          ? {
              ...line,
              specialPrice: n != null && Number.isFinite(n) && n > 0 ? n : null,
            }
          : line
      )
    );
  }

  generateShareLink(): void {
    const lead = this.activeLead();
    const storeCode = this.storeCode();
    const vendorId = this.vendorId();
    const lines = this.shareLines();

    if (!lead || !storeCode || !vendorId) {
      this.shareError.set('Store profile is missing. Refresh and try again.');
      return;
    }
    if (!lines.length) {
      this.shareError.set('Add at least one product to the shared catalog.');
      return;
    }

    const missingPrice = lines.find((l) => l.specialPrice == null || l.specialPrice <= 0);
    if (missingPrice) {
      this.shareError.set(`Set a special price for â€œ${missingPrice.name}â€.`);
      return;
    }

    const specialPrices: Record<string, number> = {};
    for (const line of lines) {
      specialPrices[String(line.productId)] = Number(line.specialPrice);
    }

    const payload: CatalogSharePayload = {
      v: 1,
      productIds: lines.map((l) => l.productId),
      specialPrices,
      leadId: lead.id,
      customerName: lead.customerName,
      customerPhone: lead.customerPhone,
      shareLabel: this.shareLabel.trim() || `Special offer for ${lead.customerName}`,
    };

    this.shareGenerating.set(true);
    this.shareError.set('');
    this.catalogShareService.createShortLink(vendorId, storeCode, payload).subscribe({
      next: (record) => {
        this.shareLink.set(
          record.url ||
            `${buildPublicStoreUrl(storeCode).replace('/home', '')}/c/${record.shortCode}`
        );
        this.shareGenerating.set(false);
        this.allLeads.update((list) =>
          list.map((item) =>
            item.id === lead.id && (item.status === 'new' || item.status === 'in_progress')
              ? { ...item, status: 'responded' }
              : item
          )
        );
        this.applyFilters();
      },
      error: () => {
        this.shareGenerating.set(false);
        this.shareError.set('Could not create share link. Try again.');
      },
    });
  }

  copyShareLink(): void {
    const link = this.shareLink();
    if (!link || !navigator.clipboard) {
      return;
    }
    void navigator.clipboard.writeText(link).then(() => {
      this.shareCopied.set(true);
      setTimeout(() => this.shareCopied.set(false), 2000);
    });
  }
}
