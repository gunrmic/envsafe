#!/usr/bin/env node

import { Command } from 'commander';
import { init } from './commands/init.js';
import { run } from './commands/run.js';
import { set } from './commands/set.js';
import { get } from './commands/get.js';
import { list } from './commands/list.js';
import { audit } from './commands/audit.js';
import { ci } from './commands/ci.js';

const program = new Command();

program
  .name('envsafe')
  .description('Encrypted, keychain-backed secret storage. Replaces .env files.')
  .version('0.1.0')
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

program.parse();
