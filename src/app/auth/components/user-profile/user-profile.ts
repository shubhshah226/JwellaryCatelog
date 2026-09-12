import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { formatInIndia } from '@common/utils/date-time.util';
import { AuthService } from '../../services/auth.service';
import { UserProfile } from '../../models/user.model';

@Component({
  selector: 'app-user-profile',
  imports: [FormsModule],
  templateUrl: './user-profile.html',
  styleUrl: './user-profile.css',
})
export class UserProfilePage implements OnInit {
  private readonly authService = inject(AuthService);

  readonly isLoading = signal(true);
  /** Static page state only â€” API detail goes to toast. */
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
      error: () => {
        this.loadFailed.set(true);
        this.isLoading.set(false);
      },
    });
  }

  formatRole(role: string): string {
    if (!role) {
      return 'â€”';
    }
    if (role === 'superadmin' || role === 'admin') {
      return 'Super Admin';
    }
    if (role === 'owner' || role === 'vendor') {
      return 'Owner';
    }
    return role;
  }

  formatStatus(status: string): string {
    if (!status) {
      return 'â€”';
    }
    return status.replace(/_/g, ' ');
  }

  formatLastLogin(value: string | null): string {
    if (!value) {
      return 'â€”';
    }
    return formatInIndia(value) || value;
  }
}
