import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import pc from 'picocolors';
import { createKeychain } from '../crypto/keychain.js';
import { findVaultFile, loadVault } from '../utils.js';

export async function run(
  commandArgs: string[],
  options: { scope?: string; only?: string },
): Promise<void> {
  const vaultPath = findVaultFile(resolve('.'));

  if (!vaultPath) {
    console.error(pc.red('No vault found. Run `envsafe init` first.'));
    process.exit(1);
  }

  if (commandArgs.length === 0) {
    console.error(pc.red('No command specified. Usage: envsafe run -- <command>'));
    process.exit(1);
  }

  const keychain = createKeychain();
  const { secrets, scopes } = await loadVault(vaultPath, keychain);

  // Filter secrets
  let injected: Record<string, string>;

  if (options.scope) {
    const scopeKeys = scopes[options.scope];
    if (!scopeKeys) {
      console.error(pc.red(`Unknown scope: ${options.scope}`));
      console.error(pc.dim(`Available scopes: ${Object.keys(scopes).join(', ') || '(none)'}`));
      process.exit(1);
    }
    injected = {};
    for (const key of scopeKeys) {
      if (key in secrets) injected[key] = secrets[key];
    }
  } else if (options.only) {
    const keys = options.only.split(',').map((k) => k.trim());
    injected = {};
    for (const key of keys) {
      if (key in secrets) {
        injected[key] = secrets[key];
      } else {
        console.error(pc.yellow(`Warning: key "${key}" not found in vault`));
      }
    }
  } else {
    injected = secrets;
    if (Object.keys(secrets).length > 0) {
      console.error(
        pc.dim(`Injecting all ${Object.keys(secrets).length} secret(s). Use --scope or --only to restrict.`)
      );
    }
  }

  // Join all args into a single shell command string
  const fullCommand = commandArgs.join(' ');
  const child = spawn(fullCommand, [], {
    env: { ...process.env, ...injected },
    stdio: 'inherit',
    shell: true,
  });

  child.on('error', (err) => {
    console.error(pc.red(`Failed to start: ${err.message}`));
    process.exit(1);
  });

  child.on('close', (code) => {
    process.exit(code ?? 1);
  });
}
