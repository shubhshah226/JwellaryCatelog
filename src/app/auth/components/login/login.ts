import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ToastService } from '@common/services/toast.service';
import { LoginParamModel, LoginResponse } from '../../models/user.model';
import { AuthService } from '../../services/auth.service';

/**
 * Login page (`/login`).
 * - Client validation messages stay inline (`errorMessage`)
 * - API errors are toasted centrally by ApiHttpService
 * - On success, AuthService encrypts the session; we navigate to the role dashboard
 */
@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
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
          this.userLoginResponse = response;
          this.toast.success('Login successfully.');
          this.authService.redirectToDashboard();
        },
        error: () => undefined,
      });
  }
}
