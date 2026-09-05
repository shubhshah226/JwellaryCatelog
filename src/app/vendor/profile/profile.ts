import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { resolveMediaUrl } from '../../core/utils/media-url.util';
import { VendorAccount } from '../../dashboard/models/vendor.model';
import { VendorDataService } from '../services/vendor-data.service';

@Component({
  selector: 'app-vendor-profile',
  imports: [DecimalPipe, FormsModule],
  templateUrl: './profile.html',
  styleUrls: ['../shared/vendor-page.css', './profile.css'],
})
export class VendorProfile implements OnInit {
  private readonly vendorData = inject(VendorDataService);

  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly profile = signal<VendorAccount | null>(null);
  readonly isSaving = signal(false);
  readonly formError = signal('');
  readonly logoError = signal('');
  readonly successMessage = signal('');

  editEmail = '';
  editPhone = '';
  editAddress = '';
  editCity = '';
  editState = '';
  editPincode = '';
  editLogoUrl = '';

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    this.vendorData.getProfile().subscribe({
      next: (profile) => {
        if (!profile) {
          this.profile.set(null);
          this.isLoading.set(false);
          return;
        }
        const next = {
          ...profile,
          id: Number(profile.id),
          logoUrl: resolveMediaUrl(profile.logoUrl || '') || '',
        };
        this.profile.set(next);
        this.fillForm(next);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load profile. Please ensure the API is running on port 8001.');
        this.isLoading.set(false);
      },
    });
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
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (result) {
        this.editLogoUrl = result;
        this.logoError.set('');
        this.successMessage.set('');
      }
    };
    reader.onerror = () => this.logoError.set('Could not read image file.');
    reader.readAsDataURL(file);
    input.value = '';
  }

  removeLogo(): void {
    this.editLogoUrl = '';
    this.logoError.set('');
    this.successMessage.set('');
  }

  resetForm(): void {
    const p = this.profile();
    if (!p) {
      return;
    }
    this.fillForm(p);
    this.formError.set('');
    this.logoError.set('');
    this.successMessage.set('');
  }

  saveProfile(): void {
    const p = this.profile();
    if (!p) {
      return;
    }
    if (!this.editEmail.trim() || !this.editPhone.trim()) {
      this.formError.set('Email and phone are required.');
      return;
    }

    this.isSaving.set(true);
    this.formError.set('');
    this.successMessage.set('');

    const logoPayload = this.editLogoUrl.startsWith('data:')
      ? this.editLogoUrl
      : this.stripMediaHost(this.editLogoUrl);

    this.vendorData
      .updateProfile({
        email: this.editEmail.trim(),
        phone: this.editPhone.trim(),
        address: this.editAddress.trim(),
        city: this.editCity.trim(),
        state: this.editState.trim(),
        pincode: this.editPincode.trim(),
        logoUrl: logoPayload,
      })
      .subscribe({
        next: (updated) => {
          const next = {
            ...p,
            ...updated,
            id: Number(updated.id || p.id),
            logoUrl: resolveMediaUrl(updated.logoUrl || '') || '',
          };
          this.profile.set(next);
          this.fillForm(next);
          this.isSaving.set(false);
          this.successMessage.set('Profile saved.');
        },
        error: (err) => {
          const msg =
            err?.error?.error?.message ||
            err?.error?.message ||
            'Failed to update profile.';
          this.formError.set(msg);
          this.isSaving.set(false);
        },
      });
  }

  formatPlan(plan: string): string {
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  }

  formatStatus(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  private fillForm(p: VendorAccount): void {
    this.editEmail = p.email || '';
    this.editPhone = p.phone || '';
    this.editAddress = p.address || '';
    this.editCity = p.city || '';
    this.editState = p.state || '';
    this.editPincode = p.pincode || '';
    this.editLogoUrl = p.logoUrl || '';
  }

  private stripMediaHost(url: string): string {
    if (!url) {
      return '';
    }
    if (url.startsWith('/uploads/')) {
      return url;
    }
    const marker = '/uploads/';
    const idx = url.indexOf(marker);
    if (idx >= 0) {
      return url.slice(idx);
    }
    return url;
  }
}
