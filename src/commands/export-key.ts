import { resolve } from 'node:path';
import pc from 'picocolors';
import { createKeychain } from '../crypto/keychain.js';
import { findVaultFile, getAccount } from '../utils.js';

export async function exportKey(): Promise<void> {
  const vaultPath = findVaultFile(resolve('.'));

  if (!vaultPath) {
    console.error(pc.red('No vault found. Run `envsafe init` first.'));
    process.exit(1);
  }

  const keychain = createKeychain();
  const account = getAccount(vaultPath);
  const masterKey = await keychain.getPassword('envsafe', account);

  if (!masterKey) {
    console.error(pc.red('No encryption key found in keychain.'));
    process.exit(1);
  }

  console.error(pc.yellow('Warning: this key can decrypt all secrets in this vault'));
  console.error(pc.dim('Store it as ENVSAFE_KEY in your CI/CD secrets'));
  console.log(masterKey);
}
