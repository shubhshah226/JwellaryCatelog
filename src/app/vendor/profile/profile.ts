import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../auth/services/auth.service';
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
  private readonly authService = inject(AuthService);

  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly profile = signal<VendorAccount | null>(null);
  readonly isDrawerOpen = signal(false);
  readonly isSaving = signal(false);
  readonly formError = signal('');
  readonly successMessage = signal('');

  readonly sessionUser = this.authService.getSession()?.user;

  editEmail = '';
  editPhone = '';

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    this.vendorData.getProfile().subscribe({
      next: (profile) => {
        this.profile.set(profile ? { ...profile, id: Number(profile.id) } : null);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load profile. Please ensure the API is running on port 8001.');
        this.isLoading.set(false);
      },
    });
  }

  openEditDrawer(): void {
    const p = this.profile();
    if (!p) {
      return;
    }
    this.editEmail = p.email;
    this.editPhone = p.phone;
    this.formError.set('');
    this.successMessage.set('');
    this.isDrawerOpen.set(true);
  }

  closeDrawer(): void {
    if (!this.isSaving()) {
      this.isDrawerOpen.set(false);
    }
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

    this.vendorData.updateContact(p.id, this.editEmail.trim(), this.editPhone.trim()).subscribe({
      next: (updated) => {
        this.profile.set({
          ...p,
          email: updated.email,
          phone: updated.phone,
        });
        this.isSaving.set(false);
        this.isDrawerOpen.set(false);
        this.successMessage.set('Contact details updated.');
      },
      error: () => {
        this.formError.set('Failed to update profile.');
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
}
