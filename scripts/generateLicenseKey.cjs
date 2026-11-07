#!/usr/bin/env node
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * SheetSQL Compiler - Pro License Key Generator
 * Generates tamper-proof activation keys for Ko-fi shop buyers.
 * 
 * Usage:
 *   node scripts/generateLicenseKey.js
 *   node scripts/generateLicenseKey.js --count=5
 *   node scripts/generateLicenseKey.js --user="customer@email.com"
 *   npm run gen-key
 */

const crypto = require('crypto');

// Shared secret salt (must match src/utils/licenseManager.ts)
const LICENSE_SALT = 'SSQL_KOFI_PRO_KEY_SALT_v1_2026';

/**
 * Compute 4-character hex checksum from raw payload + salt
 */
function computeChecksum(payload) {
  const hash = crypto
    .createHash('sha256')
    .update(`${payload}:${LICENSE_SALT}`)
    .digest('hex');
  return hash.substring(0, 4).toUpperCase();
}

/**
 * Generate a single valid SSQL-PRO key
 * Format: SSQL-PRO-XXXX-YYYY-ZZZZ
 */
function generateKey(customEntropy) {
  let entropy;
  if (customEntropy) {
    entropy = crypto
      .createHash('md5')
      .update(customEntropy + Math.random().toString())
      .digest('hex')
      .substring(0, 8)
      .toUpperCase();
  } else {
    entropy = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 hex chars
  }

  const block1 = entropy.substring(0, 4);
  const block2 = entropy.substring(4, 8);
  const checksum = computeChecksum(`${block1}${block2}`);

  return `SSQL-PRO-${block1}-${block2}-${checksum}`;
}

/**
 * Validate a key
 */
function validateKey(key) {
  const clean = key.trim().toUpperCase();
  const parts = clean.split('-');

  if (parts.length !== 5 || parts[0] !== 'SSQL' || parts[1] !== 'PRO') {
    return false;
  }

  const payload = `${parts[2]}${parts[3]}`;
  const expectedChecksum = computeChecksum(payload);
  return parts[4] === expectedChecksum;
}

// Parse CLI arguments
const args = process.argv.slice(2);
let count = 1;
let customer = '';

for (const arg of args) {
  if (arg.startsWith('--count=')) {
    count = parseInt(arg.replace('--count=', ''), 10) || 1;
  } else if (arg.startsWith('--user=')) {
    customer = arg.replace('--user=', '');
  } else if (!isNaN(parseInt(arg, 10))) {
    count = parseInt(arg, 10);
  }
}

console.log(`\n\x1b[1m\x1b[35m============================================================\x1b[0m`);
console.log(`\x1b[1m\x1b[36m  💎 SheetSQL Compiler - Ko-fi Pro License Key Generator  \x1b[0m`);
console.log(`\x1b[1m\x1b[35m============================================================\x1b[0m\n`);

const keys = [];
for (let i = 0; i < count; i++) {
  const key = generateKey(customer ? `${customer}_${i}` : undefined);
  keys.push(key);
}

if (count === 1) {
  const key = keys[0];
  console.log(`\x1b[32m✔ Generated 1 Pro License Key:\x1b[0m`);
  console.log(`\n   \x1b[1m\x1b[33m${key}\x1b[0m\n`);
  console.log(`\x1b[90mVerified: ${validateKey(key) ? 'VALID (Checksum OK)' : 'INVALID'}\x1b[0m\n`);

  console.log(`\x1b[36m--- Ko-fi Customer Delivery Note Template ---\x1b[0m`);
  console.log(`Thank you for supporting SheetSQL Compiler on Ko-fi! 🎉`);
  console.log(`Here is your Lifetime Pro Activation License Key:\n`);
  console.log(`License Key: ${key}`);
  console.log(`\nHow to activate:`);
  console.log(`1. Open https://gbudidarma.github.io/BI_SQLSheetCompiler/`);
  console.log(`2. Click the "+ Postgres" button in the schema sidebar or the 💎 Pro button.`);
  console.log(`3. Enter your License Key and click "Activate Pro".`);
  console.log(`4. Enjoy permanent access to live PostgreSQL database connections! 🚀\n`);
} else {
  console.log(`\x1b[32m✔ Generated ${count} Pro License Keys (Batch for Ko-fi Shop):\x1b[0m\n`);
  keys.forEach((k, idx) => {
    console.log(`${(idx + 1).toString().padStart(2, ' ')}. \x1b[1m\x1b[33m${k}\x1b[0m`);
  });
  console.log(`\n\x1b[90mTip: You can paste these keys into a text file or Ko-fi digital download inventory.\x1b[0m\n`);
}
