import { Component, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-access-denied',
  standalone: true,
  templateUrl: './access-denied.html',
  styleUrl: './access-denied.css',
})
export class AccessDenied {
  private readonly authService = inject(AuthService);

  goToDashboard(): void {
    this.authService.redirectToDashboard();
  }
}
