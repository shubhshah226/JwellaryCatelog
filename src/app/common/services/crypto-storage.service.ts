import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Encrypts / decrypts JSON values in localStorage (AES-GCM via Web Crypto).
 *
 * Used for the login session so DevTools → Application → Local Storage
 * shows ciphertext instead of a readable access token.
 *
 * Limitation: the key is derived from values in the frontend bundle, so this
 * is obfuscation against casual viewing — not protection against a determined
 * attacker who extracts the app code.
 */
@Injectable({
  providedIn: 'root',
})
export class CryptoStorageService {
  private keyPromise: Promise<CryptoKey> | null = null;

  /** Encrypt `value` as JSON and save under `environment.storageKey` (or override). */
  async setJson<T>(value: T, key = environment.storageKey): Promise<void> {
    const plain = JSON.stringify(value);
    const encrypted = await this.encrypt(plain);
    localStorage.setItem(key, encrypted);
    // Drop legacy plain key if we migrated away from it.
    if (key !== 'user') {
      localStorage.removeItem('user');
    }
  }

  /** Read and decrypt JSON. Also migrates legacy plain JSON once. */
  async getJson<T>(key = environment.storageKey): Promise<T | null> {
    const raw = localStorage.getItem(key) ?? localStorage.getItem('user');
    if (!raw) {
      return null;
    }

    // Legacy plain JSON (pre-encryption) — accept once, then re-save encrypted.
    if (raw.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(raw) as T;
        await this.setJson(parsed, key);
        return parsed;
      } catch {
        localStorage.removeItem(key);
        localStorage.removeItem('user');
        return null;
      }
    }

    try {
      const plain = await this.decrypt(raw);
      return JSON.parse(plain) as T;
    } catch {
      localStorage.removeItem(key);
      localStorage.removeItem('user');
      return null;
    }
  }

  clear(key = environment.storageKey): void {
    localStorage.removeItem(key);
    localStorage.removeItem('user');
  }

  private async encrypt(plainText: string): Promise<string> {
    const key = await this.getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plainText);
    const cipherBuf = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      encoded as BufferSource
    );
    // Pack as: base64(iv) + '.' + base64(ciphertext)
    return `${this.toBase64(iv)}.${this.toBase64(new Uint8Array(cipherBuf))}`;
  }

  private async decrypt(payload: string): Promise<string> {
    const [ivPart, dataPart] = payload.split('.');
    if (!ivPart || !dataPart) {
      throw new Error('Invalid encrypted payload');
    }
    const key = await this.getKey();
    const iv = this.fromBase64(ivPart);
    const data = this.fromBase64(dataPart);
    const plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      data as BufferSource
    );
    return new TextDecoder().decode(plainBuf);
  }

  private async getKey(): Promise<CryptoKey> {
    if (!this.keyPromise) {
      this.keyPromise = this.deriveKey();
    }
    return this.keyPromise;
  }

  /** PBKDF2 → AES-GCM key from environment secret + salt. */
  private async deriveKey(): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const material = await crypto.subtle.importKey(
      'raw',
      encoder.encode(environment.encryptionSecret),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode(environment.encryptionSalt),
        iterations: 100_000,
        hash: 'SHA-256',
      },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private toBase64(bytes: Uint8Array): string {
    let binary = '';
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    return btoa(binary);
  }

  private fromBase64(value: string): Uint8Array {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}
