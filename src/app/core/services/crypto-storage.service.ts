import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

interface EncryptedPayload {
  iv: string;
  data: string;
}

@Injectable({
  providedIn: 'root',
})
export class CryptoStorageService {
  private cryptoKey: CryptoKey | null = null;

  async setItem<T>(value: T): Promise<void> {
    const key = await this.getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(value));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

    const payload: EncryptedPayload = {
      iv: this.toBase64(iv),
      data: this.toBase64(new Uint8Array(encrypted)),
    };

    localStorage.setItem(environment.storageKey, JSON.stringify(payload));
  }

  async getItem<T>(): Promise<T | null> {
    const raw = localStorage.getItem(environment.storageKey);
    if (!raw) {
      return null;
    }

    try {
      const payload = JSON.parse(raw) as EncryptedPayload;
      const key = await this.getKey();
      const iv = this.fromBase64(payload.iv);
      const encryptedData = this.fromBase64(payload.data);
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as BufferSource },
        key,
        encryptedData as BufferSource
      );

      return JSON.parse(new TextDecoder().decode(decrypted)) as T;
    } catch {
      this.removeItem();
      return null;
    }
  }

  removeItem(): void {
    localStorage.removeItem(environment.storageKey);
  }

  private async getKey(): Promise<CryptoKey> {
    if (this.cryptoKey) {
      return this.cryptoKey;
    }

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(environment.encryptionSecret),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    this.cryptoKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode(environment.encryptionSalt),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    return this.cryptoKey;
  }

  private toBase64(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes));
  }

  private fromBase64(value: string): Uint8Array {
    return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  }
}
