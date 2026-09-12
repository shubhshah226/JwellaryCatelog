import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../auth/services/auth.service';
import { PLATFORM_CONTACT } from './platform-contact';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class Landing implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly contact = PLATFORM_CONTACT;

  telHref = `tel:${PLATFORM_CONTACT.phone}`;
  mailHref = `mailto:${PLATFORM_CONTACT.email}`;
  waHref = `https://wa.me/${PLATFORM_CONTACT.whatsapp}`;

  async ngOnInit(): Promise<void> {
    await this.auth.ensureSessionLoaded();
    if (this.auth.isAuthenticated()) {
      void this.router.navigateByUrl(this.auth.getDashboardRoute());
    }
  }
}
