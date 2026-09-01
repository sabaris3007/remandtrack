/**
 * AES-256-GCM Field-Level Encryption for Case Data
 *
 * Encrypts sensitive fields (accused names, police station details, jail locations)
 * stored in the SQLite database. Uses Node.js built-in `crypto` — zero new dependencies.
 *
 * Format: base64(iv):base64(authTag):base64(ciphertext)
 * - iv: 12-byte random initialization vector (unique per encryption)
 * - authTag: 16-byte GCM authentication tag (integrity verification)
 * - ciphertext: encrypted payload
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;       // GCM recommended IV length
const AUTH_TAG_LENGTH = 16;  // 128-bit auth tag
const KEY_LENGTH = 32;       // 256-bit key

// Sensitive fields that get encrypted before storage
export const ENCRYPTED_FIELDS = ['accused_name', 'police_station', 'jail_location'] as const;
export type EncryptedFieldName = typeof ENCRYPTED_FIELDS[number];

let _cachedKey: Buffer | null = null;

/**
 * Resolves the 256-bit encryption key from env var or auto-generates one.
 * Key is a 64-char hex string (32 bytes).
 */
function getEncryptionKey(): Buffer {
  if (_cachedKey) return _cachedKey;

  let hexKey = process.env.CASE_ENCRYPTION_KEY;

  if (!hexKey || hexKey.length !== 64) {
    // Auto-generate a key and persist it to .env so it survives restarts
    hexKey = crypto.randomBytes(KEY_LENGTH).toString('hex');
    const envPath = path.join(process.cwd(), '.env');
    const line = `\nCASE_ENCRYPTION_KEY=${hexKey}\n`;

    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      if (!content.includes('CASE_ENCRYPTION_KEY')) {
        fs.appendFileSync(envPath, line);
      }
    } else {
      fs.writeFileSync(envPath, line.trim() + '\n');
    }
    process.env.CASE_ENCRYPTION_KEY = hexKey;
    console.log('[Encryption] Auto-generated AES-256 key and saved to .env');
  }

  _cachedKey = Buffer.from(hexKey, 'hex');
  return _cachedKey;
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns the format: base64(iv):base64(authTag):base64(ciphertext)
 */
export function encryptField(plaintext: string): string {
  if (!plaintext) return plaintext;

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  // Compact format: iv:tag:ciphertext (all base64-encoded)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypts a ciphertext string produced by encryptField().
 * Returns the original plaintext.
 */
export function decryptField(encrypted: string): string {
  if (!encrypted || !encrypted.includes(':')) return encrypted;

  const parts = encrypted.split(':');
  if (parts.length !== 3) return encrypted; // Not encrypted, return as-is

  const key = getEncryptionKey();
  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const ciphertext = parts[2];

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    // If decryption fails (wrong key, corrupted data), return as-is
    // This handles the case where data was stored before encryption was enabled
    return encrypted;
  }
}

/**
 * Encrypts all sensitive fields in a case record object (mutates in place).
 * Returns the same object with encrypted values.
 */
export function encryptCaseFields(record: Record<string, any>): Record<string, any> {
  for (const field of ENCRYPTED_FIELDS) {
    if (record[field] && typeof record[field] === 'string') {
      record[field] = encryptField(record[field]);
    }
  }
  return record;
}

/**
 * Decrypts all sensitive fields in a case record object (mutates in place).
 * Returns the same object with plaintext values.
 */
export function decryptCaseFields(record: Record<string, any>): Record<string, any> {
  for (const field of ENCRYPTED_FIELDS) {
    if (record[field] && typeof record[field] === 'string') {
      record[field] = decryptField(record[field]);
    }
  }
  return record;
}

/**
 * Checks whether a field value looks like an encrypted string.
 * Useful for determining if data needs decryption or was stored pre-encryption.
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false;
  const parts = value.split(':');
  if (parts.length !== 3) return false;
  // Check that all three parts are valid base64
  try {
    Buffer.from(parts[0], 'base64');
    Buffer.from(parts[1], 'base64');
    Buffer.from(parts[2], 'base64');
    return true;
  } catch {
    return false;
  }
}
