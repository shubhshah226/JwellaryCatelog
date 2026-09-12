/**
 * App environment (production build).
 * Swap in via Angular fileReplacements when configured.
 */
export const environment = {
  production: true,
  apiUrl: '/api/v1',
  storageKey: 'jc_session',
  encryptionSecret: 'jwellary-catalog-secret-prod-key-2024',
  encryptionSalt: 'jwellary-salt-prod',
};
