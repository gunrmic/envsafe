import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import pc from 'picocolors';
import { createKeychain } from '../crypto/keychain.js';
import { findVaultFile, loadVault, saveVault } from '../utils.js';

async function promptSecret(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr });

    // Disable echo for secret input
    if (process.stdin.isTTY) {
      process.stdin.setRawMode?.(true);
    }

    process.stderr.write(prompt);
    let input = '';

    process.stdin.on('data', (chunk) => {
      const str = chunk.toString();
      for (const ch of str) {
        if (ch === '\n' || ch === '\r') {
          if (process.stdin.isTTY) process.stdin.setRawMode?.(false);
          process.stderr.write('\n');
          rl.close();
          resolve(input);
          return;
        } else if (ch === '\u0003') {
          // Ctrl+C
          if (process.stdin.isTTY) process.stdin.setRawMode?.(false);
          rl.close();
          reject(new Error('Cancelled'));
          return;
        } else if (ch === '\u007f' || ch === '\b') {
          // Backspace
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stderr.write('\b \b');
          }
        } else {
          input += ch;
          process.stderr.write('*');
        }
      }
    });
  });
}

export async function set(key: string, value?: string): Promise<void> {
  const vaultPath = findVaultFile(resolve('.'));

  if (!vaultPath) {
    console.error(pc.red('No vault found. Run `envsafe init` first.'));
    process.exit(1);
  }

  // Prompt for value if not provided
  let secretValue: string;
  if (value !== undefined) {
    secretValue = value;
  } else {
    try {
      secretValue = await promptSecret(`Enter value for ${pc.bold(key)}: `);
    } catch {
      console.error(pc.dim('\nCancelled'));
      process.exit(1);
      return;
    }
  }

  const keychain = createKeychain();
  const { secrets, scopes } = await loadVault(vaultPath, keychain);

  const isUpdate = key in secrets;
  secrets[key] = secretValue;

  await saveVault(secrets, scopes, vaultPath, keychain);

  console.log(pc.green(`${isUpdate ? 'Updated' : 'Set'} ${pc.bold(key)}`));
}
