import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ToastService } from '../../core/services/toast.service';
import { ForgotPasswordParamModel } from '../models/user.model';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: '../login/login.css',
})
export class ForgotPassword {
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  email = '';
  readonly isLoading = signal(false);
  readonly linkSent = signal(false);
  /** Static client validation only. */
  readonly errorMessage = signal('');

  submit(): void {
    const email = this.email.trim();
    if (!email) {
      this.errorMessage.set('Please enter your email.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    const param = new ForgotPasswordParamModel();
    param.email = email;

    this.authService
      .forgotPassword(param)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (res) => {
          this.linkSent.set(true);
          this.toast.success(
            res.message ||
              'If that email is registered, a reset link has been sent to it.'
          );
        },
        error: (err: unknown) => {
          this.toast.error(
            err instanceof Error ? err.message : 'Unable to send reset link.'
          );
        },
      });
  }
}
