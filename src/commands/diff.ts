import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import pc from 'picocolors';
import { createKeychain } from '../crypto/keychain.js';
import { parseDotenv } from '../parser/dotenv.js';
import { findVaultFile, loadVault } from '../utils.js';

export async function diff(file?: string): Promise<void> {
  const vaultPath = findVaultFile(resolve('.'));

  if (!vaultPath) {
    console.error(pc.red('No vault found. Run `envsafe init` first.'));
    process.exit(1);
  }

  // Default to .env.example
  const refPath = resolve(file ?? '.env.example');

  if (!existsSync(refPath)) {
    console.error(pc.red(`File not found: ${file ?? '.env.example'}`));
    if (!file) {
      console.error(pc.dim('Create a .env.example or specify a file: envsafe diff <file>'));
    }
    process.exit(1);
  }

  const keychain = createKeychain();
  const { secrets } = await loadVault(vaultPath, keychain);
  const vaultKeys = new Set(Object.keys(secrets));

  const refContent = readFileSync(refPath, 'utf8');
  const refSecrets = parseDotenv(refContent);
  const refKeys = new Set(Object.keys(refSecrets));

  const missing: string[] = [];
  const extra: string[] = [];
  const present: string[] = [];

  for (const key of refKeys) {
    if (vaultKeys.has(key)) {
      present.push(key);
    } else {
      missing.push(key);
    }
  }

  for (const key of vaultKeys) {
    if (!refKeys.has(key)) {
      extra.push(key);
    }
  }

  if (missing.length === 0 && extra.length === 0) {
    console.log(pc.green(`All ${present.length} keys match`));
    process.exit(0);
  }

  if (missing.length > 0) {
    console.log(pc.red(`\nMissing from vault (${missing.length}):`));
    for (const key of missing.sort()) {
      console.log(`  ${pc.red('-')} ${key}`);
    }
  }

  if (extra.length > 0) {
    console.log(pc.yellow(`\nExtra in vault (${extra.length}):`));
    for (const key of extra.sort()) {
      console.log(`  ${pc.yellow('+')} ${key}`);
    }
  }

  if (present.length > 0) {
    console.log(pc.dim(`\n${present.length} key(s) match`));
  }

  process.exit(missing.length > 0 ? 1 : 0);
}
