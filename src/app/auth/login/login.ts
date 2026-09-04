import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly authService = inject(AuthService);

  username = '';
  password = '';
  showPassword = false;
  isLoading = signal(false);
  errorMessage = signal('');

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onLogin(): void {
    const username = this.username.trim();
    if (!username || !this.password) {
      this.errorMessage.set('Please enter username and password.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    this.authService.login(username, this.password.trim()).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.authService.redirectToDashboard();
      },
      error: (err: Error) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.message || 'Login failed. Please try again.');
      },
    });
  }
}
