/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * License Key Manager for SheetSQL Compiler
 * Handles client-side Pro feature unlocking via Ko-fi shop activation keys.
 */

// Must match the salt in scripts/generateLicenseKey.cjs
export const LICENSE_SALT = 'SSQL_KOFI_PRO_KEY_SALT_v1_2026';
export const KOFI_SHOP_URL = 'https://ko-fi.com/V7V2JM8S4';

export interface LicenseStatus {
  isPro: boolean;
  key?: string;
  activatedAt?: string;
}

/**
 * Fast synchronous SHA-256 implementation for in-browser client verification
 */
function sha256Sync(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let lengthProperty = 'length';
  let i = 0, j = 0;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty] * 8;

  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, boolean> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let c = candidate * candidate; c < 312; c += candidate) {
        isComposite[c] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  hash = hash.slice(0, 8);

  ascii += '\x80';
  while ((ascii[lengthProperty] % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;

  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15],
        w2 = w[i - 2];

      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      w[i] =
        i < 16
          ? w[i]
          : ((w[i - 16] + s0 + w[i - 7] + s1) & 0xffffffff) | 0;

      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const sA = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const sB = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);

      const temp1 = (hash[7] + sB + ch + k[i] + w[i]) & 0xffffffff;
      const temp2 = (sA + maj) & 0xffffffff;

      hash = [(temp1 + temp2) & 0xffffffff, hash[0], hash[1], hash[2], (hash[3] + temp1) & 0xffffffff, hash[4], hash[5], hash[6]];
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) & 0xffffffff;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

/**
 * Compute 4-character hex checksum from raw payload + salt
 */
export function computeChecksum(payload: string): string {
  const hash = sha256Sync(`${payload}:${LICENSE_SALT}`);
  return hash.substring(0, 4).toUpperCase();
}

/**
 * Verify if a given string is a valid SheetSQL Pro license key
 * Expected format: SSQL-PRO-XXXX-YYYY-ZZZZ
 */
export function verifyLicenseKey(rawKey: string): { valid: boolean; error?: string } {
  if (!rawKey || typeof rawKey !== 'string') {
    return { valid: false, error: 'Please enter a license key' };
  }

  const clean = rawKey.trim().toUpperCase().replace(/\s+/g, '');
  const parts = clean.split('-');

  // Master demo / VIP keys for testing
  if (clean === 'SSQL-PRO-VIP-2026' || clean === 'SSQL-PRO-EARLY-ACCESS') {
    return { valid: true };
  }

  if (parts.length !== 5) {
    return {
      valid: false,
      error: 'Invalid key format. Expected format: SSQL-PRO-XXXX-YYYY-ZZZZ',
    };
  }

  if (parts[0] !== 'SSQL' || parts[1] !== 'PRO') {
    return {
      valid: false,
      error: 'Key must start with SSQL-PRO-',
    };
  }

  const payload = `${parts[2]}${parts[3]}`;
  const expectedChecksum = computeChecksum(payload);

  if (parts[4] !== expectedChecksum) {
    return {
      valid: false,
      error: 'License key is invalid or corrupted. Please check for typos.',
    };
  }

  return { valid: true };
}

const STORAGE_KEY = 'sheetsql_pro_license_v1';

/**
 * Check if the user has an active Pro license
 */
export function isProUnlocked(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;

    const data = JSON.parse(stored);
    if (!data.key) return false;

    return verifyLicenseKey(data.key).valid;
  } catch {
    return false;
  }
}

/**
 * Get current stored license info
 */
export function getStoredLicense(): LicenseStatus {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { isPro: false };

    const data = JSON.parse(stored);
    const isValid = verifyLicenseKey(data.key).valid;

    return {
      isPro: isValid,
      key: isValid ? data.key : undefined,
      activatedAt: data.activatedAt,
    };
  } catch {
    return { isPro: false };
  }
}

/**
 * Activate a license key and persist to localStorage
 */
export function activateLicense(key: string): { success: boolean; error?: string } {
  const check = verifyLicenseKey(key);
  if (!check.valid) {
    return { success: false, error: check.error };
  }

  try {
    const payload = {
      key: key.trim().toUpperCase(),
      activatedAt: new Date().toISOString(),
      plan: 'PRO',
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new Event('sheetsql:license-changed'));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to save license key' };
  }
}

/**
 * Deactivate / remove stored license
 */
export function deactivateLicense(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event('sheetsql:license-changed'));
  } catch {}
}
