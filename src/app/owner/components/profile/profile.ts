import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ToastService } from '@common/services/toast.service';
import { VendorAccount } from '@common/models/vendor.model';
import { VendorDataService } from '../../services/vendor-data.service';

@Component({
  selector: 'app-vendor-profile',
  imports: [FormsModule],
  templateUrl: './profile.html',
  styleUrls: ['../../shared/vendor-page.css', './profile.css'],
})
export class VendorProfile implements OnInit, OnDestroy {
  private readonly vendorData = inject(VendorDataService);
  private readonly toast = inject(ToastService);

  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly profile = signal<VendorAccount | null>(null);
  readonly isSaving = signal(false);
  readonly formError = signal('');
  readonly logoError = signal('');
  readonly logoBroken = signal(false);

  editBusinessName = '';
  editOwnerName = '';
  editEmail = '';
  editPhone = '';
  editCity = '';
  editBrandColor = '#004e8a';
  editCurrency = 'INR';
  editCatalogExpiryDays: number | null = 30;
  editPriceVisibleDefault = true;
  editLogoUrl = '';
  /** Raw logoUri from API (s3://â€¦); kept for update when file not changed */
  private storedLogoUri = '';
  private logoFile: File | null = null;
  private logoObjectUrl: string | null = null;

  ngOnInit(): void {
    this.loadProfile();
  }

  ngOnDestroy(): void {
    this.revokeLogoObjectUrl();
  }

  loadProfile(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.vendorData.getProfile().subscribe({
      next: (profile) => {
        if (!profile) {
          this.profile.set(null);
          this.isLoading.set(false);
          return;
        }
        const next = { ...profile, id: String(profile.id) };
        this.profile.set(next);
        this.storedLogoUri = (profile.logoUrl || '').trim();
        this.fillForm(next);
        this.loadLogoPreview(this.storedLogoUri);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load business profile.');
        this.isLoading.set(false);
      },
    });
  }

  brandColorPickerValue(): string {
    return this.normalizeBrandColor(this.editBrandColor) || '#004e8a';
  }

  onBrandColorChange(value: string): void {
    this.editBrandColor = this.normalizeBrandColor(value) || '#004e8a';
  }

  onLogoError(): void {
    this.logoBroken.set(true);
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.logoError.set('Please select an image file (jpg, png, or webp).');
      input.value = '';
      return;
    }
    if (file.size > 2_000_000) {
      this.logoError.set('Image must be under 2MB.');
      input.value = '';
      return;
    }
    this.logoFile = file;
    this.logoBroken.set(false);
    this.logoError.set('');
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (result) {
        this.revokeLogoObjectUrl();
        this.editLogoUrl = result;
      }
    };
    reader.onerror = () => this.logoError.set('Could not read image file.');
    reader.readAsDataURL(file);
    input.value = '';
  }

  removeLogo(): void {
    this.revokeLogoObjectUrl();
    this.editLogoUrl = '';
    this.logoFile = null;
    this.storedLogoUri = '';
    this.logoBroken.set(false);
    this.logoError.set('');
  }

  resetForm(): void {
    const p = this.profile();
    if (!p) {
      return;
    }
    this.fillForm(p);
    this.logoFile = null;
    this.storedLogoUri = (p.logoUrl || '').trim();
    this.formError.set('');
    this.logoError.set('');
    this.loadLogoPreview(this.storedLogoUri);
  }

  onPhoneChange(value: string): void {
    this.editPhone = (value || '').replace(/\D/g, '').slice(0, 10);
  }

  saveProfile(): void {
    const p = this.profile();
    if (!p) {
      return;
    }
    if (!this.editBusinessName.trim()) {
      this.formError.set('Business name is required.');
      return;
    }
    if (!this.editEmail.trim() || !this.editPhone.trim()) {
      this.formError.set('Email and phone are required.');
      return;
    }
    if (!/^\d{10}$/.test(this.editPhone.trim())) {
      this.formError.set('Phone must be a 10-digit number.');
      return;
    }

    this.isSaving.set(true);
    this.formError.set('');

    this.vendorData
      .updateProfile(
        {
          businessName: this.editBusinessName.trim(),
          ownerName: this.editOwnerName.trim() || null,
          contactEmail: this.editEmail.trim(),
          contactPhone: this.editPhone.trim(),
          city: this.editCity.trim() || null,
          brandColor: this.brandColorPickerValue(),
          currency: this.editCurrency || 'INR',
          catalogExpiryDays: this.editCatalogExpiryDays,
          priceVisibleDefault: this.editPriceVisibleDefault,
          // null keeps existing logo on server when no new file is sent
          logoUri: this.logoFile ? null : this.storedLogoUri || null,
        },
        this.logoFile
      )
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: (updated) => {
          const next = {
            ...p,
            ...updated,
            id: String(updated.id || p.id),
            logoUrl: updated.logoUrl || this.storedLogoUri,
          };
          this.profile.set(next);
          this.storedLogoUri = (next.logoUrl || '').trim();
          this.fillForm(next);
          this.logoFile = null;
          // After save, refresh preview from stream (new upload) or keep local data URL
          if (this.storedLogoUri) {
            this.loadLogoPreview(this.storedLogoUri, true);
          }
          this.toast.success('Business profile updated successfully.');
        },
      });
  }

  formatStatus(status: string): string {
    return status === 'inactive' ? 'Inactive' : 'Active';
  }

  storedLogoPresent(): boolean {
    return !!this.storedLogoUri;
  }

  private fillForm(p: VendorAccount): void {
    this.editBusinessName = p.name || '';
    this.editOwnerName = p.contactPerson || '';
    this.editEmail = p.email || '';
    this.editPhone = p.phone || '';
    this.editCity = p.city || '';
    this.editBrandColor = this.normalizeBrandColor(p.brandColor || '') || '#004e8a';
    this.editCurrency = p.currency || 'INR';
    this.editCatalogExpiryDays = p.catalogExpiryDays ?? 30;
    this.editPriceVisibleDefault = p.priceVisibleDefault ?? true;
  }

  /** logoUri is s3://â€¦ â€” use existing GET /public/businessLogo/{catalogToken}. */
  private loadLogoPreview(logoUri: string, cacheBust = false): void {
    this.logoBroken.set(false);
    if (!logoUri) {
      this.revokeLogoObjectUrl();
      this.editLogoUrl = '';
      return;
    }
    // Local file preview after pick / data URL
    if (/^(data:|blob:)/i.test(logoUri)) {
      this.editLogoUrl = logoUri;
      return;
    }
    if (/^https?:/i.test(logoUri) && !logoUri.includes('s3://')) {
      this.editLogoUrl = logoUri;
      return;
    }

    this.vendorData.resolveBusinessLogoUrl(cacheBust).subscribe({
      next: (url) => {
        this.revokeLogoObjectUrl();
        this.editLogoUrl = url;
        this.logoBroken.set(!url);
      },
      error: () => {
        this.revokeLogoObjectUrl();
        this.editLogoUrl = '';
        this.logoBroken.set(true);
      },
    });
  }

  private revokeLogoObjectUrl(): void {
    if (this.logoObjectUrl) {
      URL.revokeObjectURL(this.logoObjectUrl);
      this.logoObjectUrl = null;
    }
  }

  private normalizeBrandColor(value: string | null | undefined): string {
    if (!value) {
      return '';
    }
    let hex = value.trim();
    if (!hex) {
      return '';
    }
    if (!hex.startsWith('#')) {
      hex = `#${hex}`;
    }
    const short = /^#([0-9a-fA-F]{3})$/.exec(hex);
    if (short) {
      const [r, g, b] = short[1].split('');
      hex = `#${r}${r}${g}${g}${b}${b}`;
    }
    return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toUpperCase() : '';
  }
}
