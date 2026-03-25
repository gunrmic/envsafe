import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { KeychainBackend, VaultFile } from './types.js';
import { VaultNotFoundError, KeychainAccessError, DecryptionError } from './types.js';
import { encryptVault, decryptVault } from './crypto/vault.js';

const VAULT_FILENAME = '.envsafe.vault';
const SERVICE = 'envsafe';

export function findVaultFile(startDir: string): string | null {
  let dir = resolve(startDir);
  while (true) {
    const candidate = join(dir, VAULT_FILENAME);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function getVaultPath(dir: string): string {
  return join(resolve(dir), VAULT_FILENAME);
}

export function getAccount(vaultPath: string): string {
  return dirname(resolve(vaultPath));
}

export async function loadVault(
  vaultPath: string,
  keychain: KeychainBackend,
): Promise<{ secrets: Record<string, string>; scopes: Record<string, string[]>; vault: VaultFile }> {
  if (!existsSync(vaultPath)) {
    throw new VaultNotFoundError(vaultPath);
  }

  const raw = readFileSync(vaultPath, 'utf8');
  const vault: VaultFile = JSON.parse(raw);
  const account = getAccount(vaultPath);
  const masterKey = await keychain.getPassword(SERVICE, account);

  if (!masterKey) {
    throw new KeychainAccessError(
      'No encryption key found in keychain. Was this vault created on a different machine?'
    );
  }

  try {
    const secrets = decryptVault(vault, masterKey);
    return { secrets, scopes: vault.scopes ?? {}, vault };
  } catch {
    throw new DecryptionError();
  }
}

export async function saveVault(
  secrets: Record<string, string>,
  scopes: Record<string, string[]>,
  vaultPath: string,
  keychain: KeychainBackend,
): Promise<void> {
  const account = getAccount(vaultPath);
  const masterKey = await keychain.getPassword(SERVICE, account);

  if (!masterKey) {
    throw new KeychainAccessError('No encryption key found in keychain.');
  }

  const vault = encryptVault(secrets, scopes, masterKey);
  writeFileSync(vaultPath, JSON.stringify(vault, null, 2) + '\n');
}

export function ensureGitignore(dir: string, entries: string[]): void {
  const gitignorePath = join(dir, '.gitignore');
  let content = '';

  if (existsSync(gitignorePath)) {
    content = readFileSync(gitignorePath, 'utf8');
  }

  const lines = content.split('\n');
  const toAdd = entries.filter((entry) => !lines.some((line) => line.trim() === entry));

  if (toAdd.length > 0) {
    const suffix = content.endsWith('\n') || content === '' ? '' : '\n';
    writeFileSync(gitignorePath, content + suffix + toAdd.join('\n') + '\n');
  }
}
