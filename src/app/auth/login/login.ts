import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ToastService } from '../../core/services/toast.service';
import { LoginParamModel, LoginResponse } from '../models/user.model';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  email = '';
  password = '';
  showPassword = false;
  isLoading = signal(false);
  /** Static client validation only — API messages go to toast. */
  errorMessage = signal('');
  userLoginResponse: LoginResponse = new LoginResponse();

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onLogin(): void {
    const email = this.email.trim();
    if (!email || !this.password) {
      this.errorMessage.set('Please enter email and password.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    const loginParamModel: LoginParamModel = {
      email: this.email,
      password: this.password,
    };

    this.authService
      .login(loginParamModel)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (response) => {
          if (response.accessToken != null && response.accessToken !== '') {
            this.userLoginResponse = response;
            localStorage.setItem('user', JSON.stringify(this.userLoginResponse));
            if (this.userLoginResponse.userRole == 'superadmin') {
              void this.router.navigate(['superAdmin/dashboard']);
            } else if (
              this.userLoginResponse.userRole == 'owner' ||
              this.userLoginResponse.userRole == 'vendor'
            ) {
              void this.router.navigate(['vendor/dashboard']);
            }
          } else {
            this.toastService.error(response.message || 'Login failed');
          }
        },
        error: (err: unknown) => {
          this.toastService.error(
            err instanceof Error ? err.message : 'Unable to connect to the API server.'
          );
        },
      });
  }
}
