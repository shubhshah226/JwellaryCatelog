import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PLATFORM_CONTACT } from './platform-contact';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class Landing {
  readonly contact = PLATFORM_CONTACT;

  telHref = `tel:${PLATFORM_CONTACT.phone}`;
  mailHref = `mailto:${PLATFORM_CONTACT.email}`;
  waHref = `https://wa.me/${PLATFORM_CONTACT.whatsapp}`;
}
