/**
 * Change-password page for authenticated users.
 * Validates password rules client-side, then calls AuthService;
 * API failures are toasted by ApiHttpService (no duplicate toast here).
 */
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../core/services/toast.service';
import { ChangePasswordParamModel } from '../models/user.model';
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

  changePasswordParamModel = new ChangePasswordParamModel();
  confirmPassword = '';

  showOld = false;
  showNew = false;
  showConfirm = false;

  readonly isSubmitting = signal(false);
  /** Static client validation only — API messages go to toast. */
  readonly errorMessage = signal('');

  submit(): void {
    const oldPassword = this.changePasswordParamModel.oldPassword.trim();
    const newPassword = this.changePasswordParamModel.newPassword.trim();
    const confirmPassword = this.confirmPassword.trim();

    this.changePasswordParamModel.oldPassword = oldPassword;
    this.changePasswordParamModel.newPassword = newPassword;

    if (!oldPassword || !newPassword || !confirmPassword) {
      this.errorMessage.set('Please fill in all password fields.');
      return;
    }
    if (newPassword.length < 8) {
      this.errorMessage.set('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      this.errorMessage.set('New password and confirm password do not match.');
      return;
    }
    if (oldPassword === newPassword) {
      this.errorMessage.set('New password must be different from current password.');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    this.authService.changePassword(this.changePasswordParamModel).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.changePasswordParamModel = new ChangePasswordParamModel();
        this.confirmPassword = '';
        this.toast.success(res.message || 'Password changed successfully.');
        this.authService.forceLogout();
      },
      error: () => {
        this.isSubmitting.set(false);
      },
    });
  }
}
