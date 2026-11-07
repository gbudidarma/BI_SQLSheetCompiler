#!/usr/bin/env node
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * SheetSQL Compiler - Pro License Key Generator
 * Generates tamper-proof activation keys for Ko-fi shop buyers.
 * Requires owner secret in local .env file (SSQL_LICENSE_SECRET).
 * 
 * Usage:
 *   npm run gen-key
 *   node scripts/generateLicenseKey.cjs --count=5
 *   node scripts/generateLicenseKey.cjs --user="customer@email.com"
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Load local .env if present (never committed to GitHub)
function loadLocalSecret() {
  if (process.env.SSQL_LICENSE_SECRET) {
    return process.env.SSQL_LICENSE_SECRET.trim();
  }
  const envPath = path.resolve(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*SSQL_LICENSE_SECRET\s*=\s*(.+)\s*$/);
      if (match) {
        return match[1].trim().replace(/^['"]|['"]$/g, '');
      }
    }
  }
  return null;
}

// Parse CLI arguments
const args = process.argv.slice(2);
let count = 1;
let customer = '';
let cliSecret = null;

for (const arg of args) {
  if (arg.startsWith('--count=')) {
    count = parseInt(arg.replace('--count=', ''), 10) || 1;
  } else if (arg.startsWith('--user=')) {
    customer = arg.replace('--user=', '');
  } else if (arg.startsWith('--secret=')) {
    cliSecret = arg.replace('--secret=', '').trim();
  } else if (!isNaN(parseInt(arg, 10))) {
    count = parseInt(arg, 10);
  }
}

const LICENSE_SALT = cliSecret || loadLocalSecret();

if (!LICENSE_SALT) {
  console.error('\n\x1b[31m[Access Denied]\x1b[0m Missing owner secret (SSQL_LICENSE_SECRET).');
  console.error('This script requires your private .env file to generate valid license keys.\n');
  process.exit(1);
}

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
  console.log(`2. Click the "💎 PRO" button in the header or the upgrade banner in the sidebar.`);
  console.log(`3. Enter your License Key and click "Activate Pro".`);
  console.log(`4. Enjoy permanent access to UNLIMITED tables, multi-sheet files, and PostgreSQL databases! 🚀\n`);
} else {
  console.log(`\x1b[32m✔ Generated ${count} Pro License Keys (Batch for Ko-fi Shop):\x1b[0m\n`);
  keys.forEach((k, idx) => {
    console.log(`${(idx + 1).toString().padStart(2, ' ')}. \x1b[1m\x1b[33m${k}\x1b[0m`);
  });
  console.log(`\n\x1b[90mTip: You can paste these keys into a text file or Ko-fi digital download inventory.\x1b[0m\n`);
}
