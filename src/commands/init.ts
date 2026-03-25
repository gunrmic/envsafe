import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import pc from 'picocolors';
import { createKeychain } from '../crypto/keychain.js';
import { generateMasterKey, encryptVault } from '../crypto/vault.js';
import { parseDotenv } from '../parser/dotenv.js';
import { getVaultPath, ensureGitignore } from '../utils.js';
import { writeFileSync } from 'node:fs';

const SERVICE = 'envsafe';

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
}

export async function init(options: { force?: boolean }): Promise<void> {
  const dir = resolve('.');
  const vaultPath = getVaultPath(dir);
  const envPath = join(dir, '.env');

  // Check for existing vault
  if (existsSync(vaultPath) && !options.force) {
    console.error(pc.red('Vault already exists. Use --force to overwrite.'));
    process.exit(1);
  }

  // Parse .env if it exists
  let secrets: Record<string, string> = {};
  let importedCount = 0;

  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf8');
    secrets = parseDotenv(content);
    importedCount = Object.keys(secrets).length;
    console.log(pc.dim(`Found .env with ${importedCount} secret(s)`));
  } else {
    console.log(pc.dim('No .env file found — starting with empty vault'));
  }

  // Generate master key and store in keychain
  const keychain = createKeychain();
  const masterKey = generateMasterKey();

  try {
    await keychain.setPassword(SERVICE, dir, masterKey);
  } catch (err) {
    console.error(pc.red('Failed to store encryption key in keychain.'));
    console.error(pc.dim(String(err)));
    process.exit(1);
  }

  // Encrypt and write vault
  const vault = encryptVault(secrets, {}, masterKey);
  writeFileSync(vaultPath, JSON.stringify(vault, null, 2) + '\n');

  // Update .gitignore
  ensureGitignore(dir, ['.env', '.envsafe.vault']);

  // Summary
  console.log(pc.green(`\nVault created at ${pc.bold('.envsafe.vault')}`));
  if (importedCount > 0) {
    console.log(pc.green(`  ${importedCount} secret(s) imported`));
  }
  console.log(pc.dim('  Encryption key stored in OS keychain'));
  console.log(pc.dim('  .env and .envsafe.vault added to .gitignore'));

  // Offer to delete .env
  if (existsSync(envPath) && importedCount > 0) {
    console.log('');
    const shouldDelete = await confirm(
      `${pc.yellow('Delete the original .env file?')} [y/N] `
    );
    if (shouldDelete) {
      unlinkSync(envPath);
      console.log(pc.green('Deleted .env'));
    } else {
      console.log(pc.dim('Kept .env — remember to delete it manually'));
    }
  }

  console.log(pc.dim('\nNext: envsafe run -- <your command>'));
}
