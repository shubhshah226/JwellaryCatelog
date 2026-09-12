import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { formatInIndia, relativeTimeFromUtc } from '../../core/utils/date-time.util';
import { resolveShareUrl } from '../../core/utils/store-code.util';
import { Enquiry, EnquiryStatus } from '../../dashboard/models/dashboard.model';
import { ToastService } from '../../core/services/toast.service';
import { ProductService } from '../services/product.service';
import { VendorDataService } from '../services/vendor-data.service';

const STATUS_OPTIONS: { value: EnquiryStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'closed_won', label: 'Won' },
  { value: 'closed_lost', label: 'Lost' },
];

@Component({
  selector: 'app-vendor-leads',
  imports: [FormsModule, CurrencyPipe],
  templateUrl: './leads.html',
  styleUrls: ['../shared/vendor-page.css', './leads.css'],
})
export class VendorLeads implements OnInit {
  private readonly vendorData = inject(VendorDataService);
  private readonly productService = inject(ProductService);
  private readonly toast = inject(ToastService);

  readonly statusOptions = STATUS_OPTIONS;

  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly allLeads = signal<Enquiry[]>([]);
  readonly filteredLeads = signal<Enquiry[]>([]);

  readonly detailOpen = signal(false);
  readonly detailLoading = signal(false);
  readonly activeLead = signal<Enquiry | null>(null);
  readonly statusSaving = signal(false);

  search = '';
  status = 'all';

  readonly newCount = computed(
    () => this.allLeads().filter((l) => l.status === 'new').length
  );
  readonly contactedCount = computed(
    () => this.allLeads().filter((l) => l.status === 'contacted').length
  );
  readonly wonCount = computed(
    () => this.allLeads().filter((l) => l.status === 'closed_won').length
  );

  ngOnInit(): void {
    this.loadLeads();
  }

  loadLeads(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.vendorData.getLeads().subscribe({
      next: (leads) => {
        this.allLeads.set(leads);
        this.applyFilters();
        this.isLoading.set(false);
      },
      error: (err: unknown) => {
        this.toast.error(err instanceof Error ? err.message : 'Unable to load leads.');
        this.errorMessage.set('Unable to load leads.');
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
    const found = STATUS_OPTIONS.find((s) => s.value === status);
    return found?.label || status.replace(/_/g, ' ');
  }

  formatPhone(phone?: string): string {
    if (!phone) {
      return '—';
    }
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `+91 ${digits}`;
    }
    return phone.startsWith('+') ? phone : `+91 ${phone}`;
  }

  itemCount(lead: Enquiry): number {
    return lead.itemCount ?? lead.items?.length ?? 0;
  }

  productSummary(lead: Enquiry): string {
    const count = this.itemCount(lead);
    if (count <= 1) {
      return lead.items?.[0]?.productName ?? lead.catalogTitle ?? lead.productName ?? '—';
    }
    return `${count} products`;
  }

  formatLeadTime(lead: Enquiry): string {
    return formatInIndia(lead.createdAt);
  }

  formatLeadRelative(lead: Enquiry): string {
    return relativeTimeFromUtc(lead.createdAt) || lead.timeAgo || '';
  }

  openDetail(lead: Enquiry): void {
    this.activeLead.set(lead);
    this.detailOpen.set(true);
    this.detailLoading.set(true);
    this.vendorData.getLeadDetail(lead.id).subscribe({
      next: (detail) => {
        const withImages: Enquiry = {
          ...detail,
          items: (detail.items || []).map((item) => ({
            ...item,
            imageUrl: this.productService.panelImageUrl(item.imageUrl, 'grid') || undefined,
          })),
        };
        this.activeLead.set(withImages);
        this.allLeads.update((list) =>
          list.map((row) => (row.id === withImages.id ? { ...row, ...withImages } : row))
        );
        this.applyFilters();
        this.detailLoading.set(false);
      },
      error: (err: unknown) => {
        this.detailLoading.set(false);
        this.toast.error(err instanceof Error ? err.message : 'Unable to load lead detail.');
      },
    });
  }

  closeDetail(): void {
    this.detailOpen.set(false);
    this.activeLead.set(null);
  }

  onStatusChange(lead: Enquiry, nextStatus: string): void {
    if (!nextStatus || nextStatus === lead.status) {
      return;
    }
    this.statusSaving.set(true);
    this.vendorData.updateLeadStatus(lead.id, nextStatus).subscribe({
      next: (status) => {
        const updated = { ...lead, status };
        this.activeLead.set(updated);
        this.allLeads.update((list) =>
          list.map((row) => (row.id === lead.id ? { ...row, status } : row))
        );
        this.applyFilters();
        this.statusSaving.set(false);
        this.toast.success(`Lead marked as ${this.formatStatus(status)}.`);
      },
      error: (err: unknown) => {
        this.statusSaving.set(false);
        this.toast.error(err instanceof Error ? err.message : 'Unable to update status.');
      },
    });
  }

  catalogLink(lead: Enquiry): string {
    return resolveShareUrl(lead.catalogUrl, undefined, lead.token);
  }

  openCatalog(lead: Enquiry): void {
    const url = this.catalogLink(lead);
    if (!url) {
      this.toast.error('Catalog link is not available for this lead.');
      return;
    }
    window.open(url, '_blank', 'noopener');
  }

  callCustomer(lead: Enquiry): void {
    const phone = (lead.customerPhone || '').replace(/\D/g, '');
    if (!phone) {
      return;
    }
    window.location.href = `tel:+91${phone.slice(-10)}`;
  }

  whatsappCustomer(lead: Enquiry): void {
    const phone = (lead.customerPhone || '').replace(/\D/g, '');
    if (!phone) {
      return;
    }
    const full = phone.length === 10 ? `91${phone}` : phone;
    window.open(`https://wa.me/${full}`, '_blank', 'noopener');
  }
}
