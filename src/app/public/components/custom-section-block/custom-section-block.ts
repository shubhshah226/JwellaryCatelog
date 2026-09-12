import { Component, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { inject } from '@angular/core';

@Component({
  selector: 'app-custom-section-block',
  imports: [],
  template: `
    <div class="custom-section-wrap">
      <div class="custom-section-html" [innerHTML]="safeHtml()"></div>
    </div>
  `,
  styles: [`
    .custom-section-wrap { width: 100%; }
    .custom-section-html { max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem; }
  `],
})
export class CustomSectionBlock {
  content = input('');

  private readonly sanitizer = inject(DomSanitizer);

  safeHtml(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.content());
  }
}
