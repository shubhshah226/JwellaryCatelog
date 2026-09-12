import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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

  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly profile = signal<UserProfile | null>(null);

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.authService.getUserProfile().subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.isLoading.set(false);
      },
      error: (err: unknown) => {
        const message =
          err instanceof Error ? err.message : 'Unable to load user profile.';
        this.errorMessage.set(message);
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
