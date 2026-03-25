import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import type { VaultFile } from '../types.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

export function generateMasterKey(): string {
  return randomBytes(KEY_LENGTH).toString('hex');
}

function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return scryptSync(masterKey, salt, KEY_LENGTH);
}

export function encryptVault(
  secrets: Record<string, string>,
  scopes: Record<string, string[]>,
  masterKey: string,
): VaultFile {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(masterKey, salt);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = JSON.stringify(secrets);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    version: 1,
    algorithm: ALGORITHM,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    data: encrypted.toString('base64'),
    scopes,
  };
}

export function decryptVault(vault: VaultFile, masterKey: string): Record<string, string> {
  const salt = Buffer.from(vault.salt, 'base64');
  const iv = Buffer.from(vault.iv, 'base64');
  const authTag = Buffer.from(vault.authTag, 'base64');
  const encrypted = Buffer.from(vault.data, 'base64');
  const key = deriveKey(masterKey, salt);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}
