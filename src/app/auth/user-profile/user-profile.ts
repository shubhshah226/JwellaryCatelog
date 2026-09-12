import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../core/services/toast.service';
import { formatInIndia } from '../../core/utils/date-time.util';
import { AuthService } from '../services/auth.service';
import { UserProfile } from '../models/user.model';

@Component({
  selector: 'app-user-profile',
  imports: [FormsModule],
  templateUrl: './user-profile.html',
  styleUrl: './user-profile.css',
})
export class UserProfilePage implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly isLoading = signal(true);
  /** Static page state only — API detail goes to toast. */
  readonly loadFailed = signal(false);
  readonly profile = signal<UserProfile | null>(null);

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    this.isLoading.set(true);
    this.loadFailed.set(false);

    this.authService.getUserProfile().subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.isLoading.set(false);
      },
      error: (err: unknown) => {
        this.toast.error(
          err instanceof Error ? err.message : 'Unable to load user profile.'
        );
        this.loadFailed.set(true);
        this.isLoading.set(false);
      },
    });
  }

  formatRole(role: string): string {
    if (!role) {
      return '—';
    }
    if (role === 'superadmin') {
      return 'Super Admin';
    }
    if (role === 'owner') {
      return 'Owner';
    }
    return role;
  }

  formatStatus(status: string): string {
    if (!status) {
      return '—';
    }
    return status.replace(/_/g, ' ');
  }

  formatLastLogin(value: string | null): string {
    if (!value) {
      return '—';
    }
    return formatInIndia(value) || value;
  }
}
