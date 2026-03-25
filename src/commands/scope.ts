import { resolve } from 'node:path';
import pc from 'picocolors';
import { createKeychain } from '../crypto/keychain.js';
import { findVaultFile, loadVault, saveVault } from '../utils.js';

export async function scope(
  action: string,
  name: string,
  keys: string[],
): Promise<void> {
  if (action === 'list') {
    return scopeList();
  }

  const vaultPath = findVaultFile(resolve('.'));
  if (!vaultPath) {
    console.error(pc.red('No vault found. Run `envsafe init` first.'));
    process.exit(1);
  }

  const keychain = createKeychain();
  const { secrets, scopes } = await loadVault(vaultPath, keychain);

  switch (action) {
    case 'add': {
      if (keys.length === 0) {
        console.error(pc.red('Specify at least one key to add to the scope'));
        process.exit(1);
      }

      // Validate keys exist
      const missing = keys.filter((k) => !(k in secrets));
      if (missing.length > 0) {
        console.error(pc.red(`Keys not found in vault: ${missing.join(', ')}`));
        process.exit(1);
      }

      if (!scopes[name]) scopes[name] = [];
      let added = 0;
      for (const key of keys) {
        if (!scopes[name].includes(key)) {
          scopes[name].push(key);
          added++;
        }
      }

      await saveVault(secrets, scopes, vaultPath, keychain);
      console.log(pc.green(`Added ${added} key(s) to scope "${name}"`));
      break;
    }

    case 'rm':
    case 'remove': {
      if (!scopes[name]) {
        console.error(pc.red(`Scope "${name}" not found`));
        process.exit(1);
      }

      if (keys.length === 0) {
        // Delete entire scope
        delete scopes[name];
        await saveVault(secrets, scopes, vaultPath, keychain);
        console.log(pc.green(`Deleted scope "${name}"`));
      } else {
        // Remove specific keys from scope
        let removed = 0;
        for (const key of keys) {
          const idx = scopes[name].indexOf(key);
          if (idx !== -1) {
            scopes[name].splice(idx, 1);
            removed++;
          }
        }
        if (scopes[name].length === 0) {
          delete scopes[name];
        }
        await saveVault(secrets, scopes, vaultPath, keychain);
        console.log(pc.green(`Removed ${removed} key(s) from scope "${name}"`));
      }
      break;
    }

    default:
      console.error(pc.red(`Unknown action: ${action}`));
      console.error(pc.dim('Usage: envsafe scope <add|rm|list> <name> [keys...]'));
      process.exit(1);
  }
}

async function scopeList(): Promise<void> {
  const vaultPath = findVaultFile(resolve('.'));
  if (!vaultPath) {
    console.error(pc.red('No vault found. Run `envsafe init` first.'));
    process.exit(1);
  }

  const keychain = createKeychain();
  const { scopes } = await loadVault(vaultPath, keychain);
  const scopeNames = Object.keys(scopes);

  if (scopeNames.length === 0) {
    console.log(pc.dim('No scopes defined. Use `envsafe scope add <name> <KEY>` to create one.'));
    return;
  }

  for (const [name, keys] of Object.entries(scopes)) {
    console.log(pc.bold(name));
    for (const key of keys) {
      console.log(`  ${key}`);
    }
  }
}
