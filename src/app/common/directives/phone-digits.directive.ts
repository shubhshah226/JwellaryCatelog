import { Directive, ElementRef, HostListener, inject } from '@angular/core';
import { NgControl } from '@angular/forms';
import { sanitizePhoneDigits, shouldBlockPhoneKey } from '../utils/phone.util';

/**
 * Restricts an input to digits only (max 10).
 * Use on phone fields: `<input appPhoneDigits ... />`
 */
@Directive({
  selector: 'input[appPhoneDigits]',
})
export class PhoneDigitsDirective {
  private readonly el = inject(ElementRef<HTMLInputElement>);
  private readonly ngControl = inject(NgControl, { optional: true, self: true });

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (shouldBlockPhoneKey(event)) {
      event.preventDefault();
    }
  }

  @HostListener('paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const input = this.el.nativeElement;
    const pasted = event.clipboardData?.getData('text') ?? '';
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const next = sanitizePhoneDigits(
      `${input.value.slice(0, start)}${pasted}${input.value.slice(end)}`
    );
    this.applyValue(next);
  }

  @HostListener('input')
  onInput(): void {
    const input = this.el.nativeElement;
    const cleaned = sanitizePhoneDigits(input.value);
    if (cleaned !== input.value) {
      this.applyValue(cleaned);
    }
  }

  private applyValue(value: string): void {
    const input = this.el.nativeElement;
    input.value = value;
    const control = this.ngControl?.control;
    if (control) {
      control.setValue(value);
      control.markAsDirty();
    } else {
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}
