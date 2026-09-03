import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { ApiClientError } from '../../core/api/api.types';
import { ApiHttpService } from '../../core/api/api-http.service';

export interface CustomerSession {
  name: string;
  phone: string;
  verifiedAt: string;
  sessionToken: string;
}

interface OtpSendResponse {
  expiresInSec: number;
  demoOtp?: string;
}

interface OtpVerifyResponse {
  sessionToken: string;
  name: string;
  phone: string;
}

const SESSION_PREFIX = 'jc_customer_';

@Injectable({
  providedIn: 'root',
})
export class CustomerAuthService {
  private readonly api = inject(ApiHttpService);
  private activeStoreCode = '';
  /** Bumped on login/logout so storefront UI re-checks OTP state. */
  readonly authTick = signal(0);

  setActiveStore(storeCode: string): void {
    this.activeStoreCode = storeCode;
  }

  getActiveStoreCode(): string {
    return this.activeStoreCode;
  }

  getSession(storeCode: string): CustomerSession | null {
    this.authTick();
    const raw = sessionStorage.getItem(SESSION_PREFIX + storeCode);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as CustomerSession;
    } catch {
      return null;
    }
  }

  isVerified(storeCode: string): boolean {
    return this.getSession(storeCode) !== null;
  }

  sendOtp(
    storeCode: string,
    name: string,
    phone: string
  ): Observable<{ success: boolean; demoOtp?: string; error?: string }> {
    const trimmedName = name.trim();
    const normalizedPhone = this.normalizePhone(phone);

    if (!trimmedName) {
      return of({ success: false, error: 'Please enter your name.' });
    }
    if (!this.isValidPhone(normalizedPhone)) {
      return of({ success: false, error: 'Please enter a valid 10-digit mobile number.' });
    }

    this.setActiveStore(storeCode);

    return this.api
      .post<OtpSendResponse>(`/public/stores/${storeCode}/otp/send`, {
        name: trimmedName,
        phone: normalizedPhone,
      })
      .pipe(
        map((res) => ({ success: true, demoOtp: res.demoOtp })),
        catchError((err: unknown) => {
          const message =
            err instanceof ApiClientError ? err.message : 'Failed to send OTP.';
          return of({ success: false, error: message });
        })
      );
  }

  verifyOtp(
    storeCode: string,
    phone: string,
    otp: string
  ): Observable<{ success: boolean; error?: string; session?: CustomerSession }> {
    const normalizedPhone = this.normalizePhone(phone);

    return this.api
      .post<OtpVerifyResponse>(`/public/stores/${storeCode}/otp/verify`, {
        phone: normalizedPhone,
        otp: otp.trim(),
      })
      .pipe(
        map((res) => {
          const session: CustomerSession = {
            name: res.name,
            phone: res.phone,
            sessionToken: res.sessionToken,
            verifiedAt: new Date().toISOString(),
          };
          sessionStorage.setItem(SESSION_PREFIX + storeCode, JSON.stringify(session));
          this.setActiveStore(storeCode);
          this.authTick.update((n) => n + 1);
          return { success: true, session };
        }),
        catchError((err: unknown) => {
          const message =
            err instanceof ApiClientError ? err.message : 'Verification failed.';
          return of({ success: false, error: message });
        })
      );
  }

  logout(storeCode: string): void {
    sessionStorage.removeItem(SESSION_PREFIX + storeCode);
    this.authTick.update((n) => n + 1);
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '').slice(-10);
  }

  private isValidPhone(phone: string): boolean {
    return /^[6-9]\d{9}$/.test(phone);
  }
}
