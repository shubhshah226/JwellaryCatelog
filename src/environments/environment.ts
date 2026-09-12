/**
 * App environment (dev).
 * Keep a single API base URL — all HTTP calls go through `apiUrl`.
 */
export const environment = {
  production: false,
  /** Backend base URL used by ApiHttpService and interceptors. */
  apiUrl: 'http://localhost:8400',
  /** localStorage key for the encrypted login session blob. */
  storageKey: 'jc_session',
  /**
   * Client-side encryption material for session storage.
   * Note: this hides data from casual inspection in DevTools; it is not
   * server-grade secrecy because the key ships with the frontend bundle.
   */
  encryptionSecret: 'jwellary-catalog-secret-dev-key-2024',
  encryptionSalt: 'jwellary-salt-dev',
};
