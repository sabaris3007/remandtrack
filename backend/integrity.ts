/**
 * SHA-256 Tamper-Proof Integrity Module for Case Records
 *
 * Extends the same cryptographic approach used in Module 5 (Audit Logger)
 * to the case data itself. Every case record gets a deterministic SHA-256 hash
 * computed over its fields. A Merkle root provides a single global fingerprint
 * for the entire dataset.
 *
 * Tamper detection: if anyone modifies a remand_date, max_sentence_days, or
 * chargesheet_filed value, the recomputed hash won't match the stored hash.
 */

import crypto from 'crypto';

// Fields included in the integrity hash, in canonical order.
// This must be a fixed, sorted list — changing the order would break all stored hashes.
const HASH_FIELDS = [
  'accused_name',
  'case_id',
  'chargesheet_filed',
  'cnr_number',
  'court_name',
  'dlsa_unit',
  'has_counsel',
  'is_first_offender',
  'jail_location',
  'judge_hierarchy',
  'max_sentence_days',
  'police_station',
  'remand_date',
  'sections',
] as const;

/**
 * Computes a deterministic SHA-256 hash of a case record.
 * Uses the same canonical approach as the audit logger: pipe-delimited fields,
 * sorted keys, consistent type coercion.
 *
 * The hash is computed over the PLAINTEXT values (before encryption),
 * so the seed script must hash before encrypting.
 */
export function computeCaseHash(record: Record<string, any>): string {
  const parts: string[] = [];

  for (const field of HASH_FIELDS) {
    const val = record[field];
    // Normalize: booleans → '0'/'1', nulls → '', everything else → string
    if (val === null || val === undefined) {
      parts.push('');
    } else if (typeof val === 'boolean') {
      parts.push(val ? '1' : '0');
    } else {
      parts.push(String(val));
    }
  }

  const payload = parts.join('|');
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

/**
 * Verifies a single case record's integrity by recomputing its hash.
 * Returns true if the record is untampered.
 *
 * @param record - The case record with plaintext (decrypted) values
 * @param storedHash - The hash that was stored when the record was created/last verified
 */
export function verifyCaseRecord(record: Record<string, any>, storedHash: string): boolean {
  return computeCaseHash(record) === storedHash;
}

export interface IntegrityReport {
  isValid: boolean;
  totalRecords: number;
  verifiedRecords: number;
  tamperedRecords: { caseId: string; storedHash: string; computedHash: string }[];
  merkleRoot: string;
  verifiedAt: string;
}

/**
 * Verifies all case records and produces a full integrity report.
 *
 * @param records - Array of case records with plaintext values
 * @param storedHashes - Map of case_id → stored record_hash
 */
export function verifyAllCases(
  records: Record<string, any>[],
  storedHashes: Map<string, string>
): IntegrityReport {
  const tampered: IntegrityReport['tamperedRecords'] = [];
  const hashes: string[] = [];

  for (const record of records) {
    const caseId = record.case_id;
    const computed = computeCaseHash(record);
    hashes.push(computed);

    const stored = storedHashes.get(caseId);
    if (stored && stored !== computed) {
      tampered.push({ caseId, storedHash: stored, computedHash: computed });
    }
  }

  return {
    isValid: tampered.length === 0,
    totalRecords: records.length,
    verifiedRecords: records.length - tampered.length,
    tamperedRecords: tampered,
    merkleRoot: computeMerkleRoot(hashes),
    verifiedAt: new Date().toISOString(),
  };
}

/**
 * Computes a Merkle root over an array of hex SHA-256 hashes.
 * This gives a single 64-char fingerprint for the entire dataset —
 * any change to any record changes the root.
 *
 * Uses a standard binary Merkle tree:
 * - Leaf nodes: individual record hashes
 * - Internal nodes: SHA-256(left || right)
 * - Odd leaves: the last leaf is duplicated
 */
export function computeMerkleRoot(hashes: string[]): string {
  if (hashes.length === 0) return '0'.repeat(64);
  if (hashes.length === 1) return hashes[0];

  let level = [...hashes];

  while (level.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      // If odd number of nodes, duplicate the last one
      const right = i + 1 < level.length ? level[i + 1] : level[i];
      nextLevel.push(
        crypto.createHash('sha256').update(left + right, 'utf8').digest('hex')
      );
    }
    level = nextLevel;
  }

  return level[0];
}
