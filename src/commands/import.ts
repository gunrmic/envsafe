import { existsSync, readFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import pc from 'picocolors';
import { createKeychain } from '../crypto/keychain.js';
import { parseDotenv } from '../parser/dotenv.js';
import { findVaultFile, loadVault, saveVault } from '../utils.js';

function parseJsonEnv(content: string): Record<string, string> {
  const parsed = JSON.parse(content);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('JSON file must be a flat object with string values');
  }
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== 'string') {
      throw new Error(`Value for "${key}" must be a string, got ${typeof value}`);
    }
    result[key] = value;
  }
  return result;
}

export async function importCmd(
  file: string,
  options: { overwrite?: boolean },
): Promise<void> {
  const vaultPath = findVaultFile(resolve('.'));

  if (!vaultPath) {
    console.error(pc.red('No vault found. Run `envsafe init` first.'));
    process.exit(1);
  }

  const filePath = resolve(file);
  if (!existsSync(filePath)) {
    console.error(pc.red(`File not found: ${file}`));
    process.exit(1);
  }

  const content = readFileSync(filePath, 'utf8');
  let incoming: Record<string, string>;

  const ext = extname(filePath).toLowerCase();
  try {
    switch (ext) {
      case '.json':
        incoming = parseJsonEnv(content);
        break;
      case '.env':
      default:
        incoming = parseDotenv(content);
        break;
    }
  } catch (err) {
    console.error(pc.red(`Failed to parse ${file}: ${err instanceof Error ? err.message : err}`));
    process.exit(1);
  }

  const incomingKeys = Object.keys(incoming);
  if (incomingKeys.length === 0) {
    console.log(pc.dim('No secrets found in file'));
    return;
  }

  const keychain = createKeychain();
  const { secrets, scopes } = await loadVault(vaultPath, keychain);

  let added = 0;
  let updated = 0;
  let unchanged = 0;

  if (options.overwrite) {
    // Replace all secrets
    for (const key of Object.keys(secrets)) {
      delete secrets[key];
    }
    for (const [key, value] of Object.entries(incoming)) {
      secrets[key] = value;
      added++;
    }
  } else {
    // Merge
    for (const [key, value] of Object.entries(incoming)) {
      if (!(key in secrets)) {
        secrets[key] = value;
        added++;
      } else if (secrets[key] !== value) {
        secrets[key] = value;
        updated++;
      } else {
        unchanged++;
      }
    }
  }

  await saveVault(secrets, scopes, vaultPath, keychain);

  console.log(pc.green(`Imported from ${file}`));
  if (added > 0) console.log(pc.dim(`  ${added} new`));
  if (updated > 0) console.log(pc.dim(`  ${updated} updated`));
  if (unchanged > 0) console.log(pc.dim(`  ${unchanged} unchanged`));
}
