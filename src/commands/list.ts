import { resolve } from 'node:path';
import pc from 'picocolors';
import { createKeychain } from '../crypto/keychain.js';
import { findVaultFile, loadVault } from '../utils.js';

export async function list(options: { json?: boolean }): Promise<void> {
  const vaultPath = findVaultFile(resolve('.'));

  if (!vaultPath) {
    console.error(pc.red('No vault found. Run `envsafe init` first.'));
    process.exit(1);
  }

  const keychain = createKeychain();
  const { secrets, scopes } = await loadVault(vaultPath, keychain);
  const keys = Object.keys(secrets).sort();

  if (keys.length === 0) {
    console.log(pc.dim('No secrets stored. Use `envsafe set <KEY> [VALUE]` to add one.'));
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(keys, null, 2));
    return;
  }

  // Build reverse scope map: key -> scope names
  const keyScopes: Record<string, string[]> = {};
  for (const [scopeName, scopeKeys] of Object.entries(scopes)) {
    for (const k of scopeKeys) {
      if (!keyScopes[k]) keyScopes[k] = [];
      keyScopes[k].push(scopeName);
    }
  }

  const maxKeyLen = Math.max(...keys.map((k) => k.length));
  const hasScopes = Object.keys(scopes).length > 0;

  for (const key of keys) {
    const padded = key.padEnd(maxKeyLen + 2);
    if (hasScopes) {
      const scopeList = keyScopes[key];
      if (scopeList && scopeList.length > 0) {
        console.log(`${padded}${pc.dim(`[${scopeList.join(', ')}]`)}`);
      } else {
        console.log(`${padded}${pc.dim('(unscoped)')}`);
      }
    } else {
      console.log(padded);
    }
  }
}
