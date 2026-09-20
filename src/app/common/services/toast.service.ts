import { Injectable, inject } from '@angular/core';
import { IndividualConfig, ToastrService } from 'ngx-toastr';

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private readonly toastr = inject(ToastrService);

  /** ngx-toastr success — green banner with check icon, title + message */
  success(message: string, title = 'Success'): void {
    this.toastr.success(message, title, this.options());
  }

  error(message: string, title = ''): void {
    this.toastr.error(message, title, this.options());
  }

  info(message: string, title = 'Info'): void {
    this.toastr.info(message, title, this.options());
  }

  warning(message: string, title = 'Warning'): void {
    this.toastr.warning(message, title, this.options());
  }

  private options(): Partial<IndividualConfig> {
    return {
      timeOut: 3500,
      progressBar: false,
      closeButton: false,
      tapToDismiss: true,
      newestOnTop: true,
    };
  }
}
