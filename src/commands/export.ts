import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { findVaultFile } from '../utils.js';
import { decryptVault } from '../crypto/vault.js';
import { getPasswordSync } from '../crypto/keychain-sync.js';
import type { VaultFile } from '../types.js';

const SERVICE = 'envsafe';

function shellEscapePosix(value: string): string {
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

function shellEscapePowerShell(value: string): string {
  return "'" + value.replace(/'/g, "''") + "'";
}

export function exportCmd(options: { shell?: string }): void {
  const vaultPath = findVaultFile(resolve('.'));
  if (!vaultPath) return;

  // Cache: skip if same vault already loaded
  if (process.env._ENVSAFE_VAULT === vaultPath) return;

  const raw = readFileSync(vaultPath, 'utf8');
  const vault: VaultFile = JSON.parse(raw);
  const account = dirname(resolve(vaultPath));
  const masterKey = getPasswordSync(SERVICE, account);

  if (!masterKey) return;

  let secrets: Record<string, string>;
  try {
    secrets = decryptVault(vault, masterKey);
  } catch {
    return;
  }

  const keys = Object.keys(secrets);
  if (keys.length === 0) return;

  const shell = options.shell || 'posix';
  const isPowerShell = shell === 'powershell';

  const lines: string[] = [];

  for (const [key, value] of Object.entries(secrets)) {
    if (isPowerShell) {
      lines.push(`$env:${key}=${shellEscapePowerShell(value)}`);
    } else {
      lines.push(`export ${key}=${shellEscapePosix(value)}`);
    }
  }

  // Track metadata
  if (isPowerShell) {
    lines.push(`$env:_ENVSAFE_ACTIVE='1'`);
    lines.push(`$env:_ENVSAFE_KEYS=${shellEscapePowerShell(keys.join(','))}`);
    lines.push(`$env:_ENVSAFE_VAULT=${shellEscapePowerShell(vaultPath)}`);
  } else {
    lines.push(`export _ENVSAFE_ACTIVE='1'`);
    lines.push(`export _ENVSAFE_KEYS=${shellEscapePosix(keys.join(','))}`);
    lines.push(`export _ENVSAFE_VAULT=${shellEscapePosix(vaultPath)}`);
  }

  // Output export statements to stdout (shell evals this)
  console.log(lines.join('\n'));

  // User feedback on stderr (not captured by eval)
  console.error(`envsafe: loaded ${keys.length} secret(s) from vault`);
}
