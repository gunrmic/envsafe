import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import pc from 'picocolors';
import { createKeychain } from '../crypto/keychain.js';
import { generateMasterKey, encryptVault } from '../crypto/vault.js';
import { findVaultFile, loadVault, getAccount } from '../utils.js';

const SERVICE = 'envsafe';

export async function rotate(): Promise<void> {
  const vaultPath = findVaultFile(resolve('.'));

  if (!vaultPath) {
    console.error(pc.red('No vault found. Run `envsafe init` first.'));
    process.exit(1);
  }

  const keychain = createKeychain();
  const { secrets, scopes } = await loadVault(vaultPath, keychain);

  // Generate new key
  const newKey = generateMasterKey();
  const account = getAccount(vaultPath);

  // Re-encrypt with new key
  const vault = encryptVault(secrets, scopes, newKey);
  writeFileSync(vaultPath, JSON.stringify(vault, null, 2) + '\n');

  // Update keychain
  await keychain.setPassword(SERVICE, account, newKey);

  console.log(pc.green('Master key rotated successfully'));
  console.error(pc.yellow('If you use ENVSAFE_KEY in CI/CD, update it to:'));
  console.log(newKey);
}
