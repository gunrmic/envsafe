#!/usr/bin/env node

import { Command } from 'commander';
import { init } from './commands/init.js';
import { run } from './commands/run.js';
import { set } from './commands/set.js';
import { get } from './commands/get.js';
import { list } from './commands/list.js';
import { audit } from './commands/audit.js';
import { ci } from './commands/ci.js';
import { hook } from './commands/hook.js';
import { exportCmd } from './commands/export.js';
import { unexportCmd } from './commands/unexport.js';
import { rm } from './commands/rm.js';
import { scope } from './commands/scope.js';
import { exportKey } from './commands/export-key.js';
import { importCmd } from './commands/import.js';
import { rotate } from './commands/rotate.js';
import { diff } from './commands/diff.js';

const program = new Command();

program
  .name('envsafe')
  .description('Encrypted, keychain-backed secret storage. Replaces .env files.')
  .version('0.3.0')
  .enablePositionalOptions();

program
  .command('init')
  .description('Import .env and encrypt it')
  .option('--force', 'Overwrite existing vault')
  .action(init);

program
  .command('run')
  .description('Run command with injected secrets')
  .option('--scope <name>', 'Only inject secrets in this scope')
  .option('--only <keys>', 'Only inject these keys (comma-separated)')
  .argument('<cmd...>', 'Command and arguments to run')
  .passThroughOptions()
  .action((cmdArgs: string[], options: { scope?: string; only?: string }) => {
    return run(cmdArgs, options);
  });

program
  .command('set')
  .description('Add or update a secret')
  .argument('<key>', 'Secret key name')
  .argument('[value]', 'Secret value (prompts if omitted)')
  .action(set);

program
  .command('get')
  .description('Print a secret value')
  .argument('<key>', 'Secret key name')
  .action(get);

program
  .command('list')
  .description('List all secret keys')
  .option('--json', 'Output as JSON array')
  .action(list);

program
  .command('audit')
  .description('Scan repo for secret exposure')
  .action(audit);

program
  .command('ci')
  .description('Generate CI integration snippet')
  .option('--platform <name>', 'CI platform (github, gitlab, circleci)')
  .action(ci);

program
  .command('rm')
  .description('Delete a secret from the vault')
  .argument('<key>', 'Secret key to delete')
  .option('--force', 'Skip confirmation')
  .action(rm);

program
  .command('scope')
  .description('Manage secret scopes')
  .argument('<action>', 'Action: add, rm, or list')
  .argument('[name]', 'Scope name')
  .argument('[keys...]', 'Secret keys')
  .action(scope);

program
  .command('export-key')
  .description('Print the master encryption key (for CI setup)')
  .action(exportKey);

program
  .command('import')
  .description('Import secrets from a file (.env or .json)')
  .argument('<file>', 'File to import')
  .option('--overwrite', 'Replace all secrets instead of merging')
  .action(importCmd);

program
  .command('rotate')
  .description('Rotate the master encryption key')
  .action(rotate);

program
  .command('diff')
  .description('Compare vault keys against a reference file')
  .argument('[file]', 'Reference file (default: .env.example)')
  .action(diff);

program
  .command('hook')
  .description('Output shell hook script for auto-injection')
  .argument('<shell>', 'Shell type (zsh, bash, powershell)')
  .action(hook);

program
  .command('_export', { hidden: true })
  .option('--shell <type>', 'Shell type for output format', 'posix')
  .action(exportCmd);

program
  .command('_unexport', { hidden: true })
  .option('--shell <type>', 'Shell type for output format', 'posix')
  .action(unexportCmd);

program.parse();
