import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ToastService } from '../../core/services/toast.service';
import { ResetPasswordParamModel } from '../models/user.model';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './reset-password.html',
  styleUrl: '../login/login.css',
})
export class ResetPassword implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  token = '';
  newPassword = '';
  confirmPassword = '';
  showPassword = false;
  showConfirm = false;

  readonly isLoading = signal(false);
  readonly tokenMissing = signal(false);
  /** Static client validation only. */
  readonly errorMessage = signal('');

  ngOnInit(): void {
    const token = (this.route.snapshot.queryParamMap.get('token') || '').trim();
    this.token = token;
    this.tokenMissing.set(!token);
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirm(): void {
    this.showConfirm = !this.showConfirm;
  }

  submit(): void {
    if (!this.token) {
      this.errorMessage.set('This reset link is invalid or incomplete.');
      return;
    }

    const newPassword = this.newPassword.trim();
    const confirmPassword = this.confirmPassword.trim();

    if (!newPassword || !confirmPassword) {
      this.errorMessage.set('Please enter and confirm your new password.');
      return;
    }
    if (newPassword.length < 8) {
      this.errorMessage.set('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      this.errorMessage.set('Passwords do not match.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    const param = new ResetPasswordParamModel();
    param.token = this.token;
    param.newPassword = newPassword;

    this.authService
      .resetPassword(param)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (res) => {
          this.toast.success(res.message || 'Password reset. Please log in.');
          void this.router.navigate(['/login']);
        },
        error: (err: unknown) => {
          this.toast.error(
            err instanceof Error ? err.message : 'Unable to reset password.'
          );
        },
      });
  }
}
