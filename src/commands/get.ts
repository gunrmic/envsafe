import { resolve } from 'node:path';
import pc from 'picocolors';
import { createKeychain } from '../crypto/keychain.js';
import { findVaultFile, loadVault } from '../utils.js';

export async function get(key: string): Promise<void> {
  const vaultPath = findVaultFile(resolve('.'));

  if (!vaultPath) {
    console.error(pc.red('No vault found. Run `envsafe init` first.'));
    process.exit(1);
  }

  const keychain = createKeychain();
  const { secrets } = await loadVault(vaultPath, keychain);

  if (!(key in secrets)) {
    console.error(pc.red(`Key "${key}" not found in vault`));
    process.exit(1);
  }

  console.error(pc.yellow('Warning: secret value printed to terminal'));
  console.log(secrets[key]);
}
