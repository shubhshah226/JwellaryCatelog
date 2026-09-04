import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-change-password',
  imports: [FormsModule],
  templateUrl: './change-password.html',
  styleUrl: './change-password.css',
})
export class ChangePassword {
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  showCurrent = false;
  showNew = false;
  showConfirm = false;

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  submit(): void {
    const current = this.currentPassword.trim();
    const next = this.newPassword.trim();
    const confirm = this.confirmPassword.trim();

    if (!current || !next || !confirm) {
      this.errorMessage.set('Please fill in all password fields.');
      this.successMessage.set('');
      return;
    }
    if (next.length < 5) {
      this.errorMessage.set('New password must be at least 5 characters.');
      this.successMessage.set('');
      return;
    }
    if (next !== confirm) {
      this.errorMessage.set('New password and confirm password do not match.');
      this.successMessage.set('');
      return;
    }
    if (current === next) {
      this.errorMessage.set('New password must be different from current password.');
      this.successMessage.set('');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.authService.changePassword(current, next).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.successMessage.set('Password updated successfully.');
        this.toast.success('Password updated successfully.');
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
      },
      error: (err: Error) => {
        this.isSubmitting.set(false);
        const message = err.message || 'Unable to change password. Please try again.';
        this.errorMessage.set(message);
        this.toast.error(message);
      },
    });
  }
}
