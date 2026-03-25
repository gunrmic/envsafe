import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import pc from 'picocolors';
import { createKeychain } from '../crypto/keychain.js';
import { findVaultFile, loadVault, saveVault } from '../utils.js';

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
}

export async function rm(key: string, options: { force?: boolean }): Promise<void> {
  const vaultPath = findVaultFile(resolve('.'));

  if (!vaultPath) {
    console.error(pc.red('No vault found. Run `envsafe init` first.'));
    process.exit(1);
  }

  const keychain = createKeychain();
  const { secrets, scopes } = await loadVault(vaultPath, keychain);

  if (!(key in secrets)) {
    console.error(pc.red(`Key "${key}" not found in vault`));
    process.exit(1);
  }

  if (!options.force) {
    const shouldDelete = await confirm(`Delete "${key}" from vault? [y/N] `);
    if (!shouldDelete) {
      console.log(pc.dim('Cancelled'));
      return;
    }
  }

  delete secrets[key];

  // Remove key from any scopes
  for (const [scopeName, scopeKeys] of Object.entries(scopes)) {
    const idx = scopeKeys.indexOf(key);
    if (idx !== -1) {
      scopeKeys.splice(idx, 1);
      if (scopeKeys.length === 0) {
        delete scopes[scopeName];
      }
    }
  }

  await saveVault(secrets, scopes, vaultPath, keychain);
  console.log(pc.green(`Deleted ${pc.bold(key)}`));
}
