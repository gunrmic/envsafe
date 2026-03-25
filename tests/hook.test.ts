import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generateMasterKey, encryptVault } from '../src/crypto/vault.js';

const CLI = join(import.meta.dirname, '..', 'src', 'cli.ts');

function runCli(args: string[], options?: { cwd?: string; env?: Record<string, string> }): string {
  return execFileSync('npx', ['tsx', CLI, ...args], {
    cwd: options?.cwd,
    env: { ...process.env, ...options?.env },
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

describe('hook command', () => {
  it('outputs zsh hook script', () => {
    const output = runCli(['hook', 'zsh']);
    assert.ok(output.includes('chpwd_functions'));
    assert.ok(output.includes('_envsafe_hook'));
    assert.ok(output.includes('envsafe _export'));
  });

  it('outputs bash hook script', () => {
    const output = runCli(['hook', 'bash']);
    assert.ok(output.includes('PROMPT_COMMAND'));
    assert.ok(output.includes('_envsafe_hook'));
  });

  it('outputs powershell hook script', () => {
    const output = runCli(['hook', 'powershell']);
    assert.ok(output.includes('_envsafe_original_prompt'));
    assert.ok(output.includes('Invoke-Expression'));
  });
});

describe('_export command', () => {
  let dir: string;
  let masterKey: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'envsafe-export-'));
    masterKey = generateMasterKey();
    const vault = encryptVault(
      { SECRET_KEY: 'test-value', DB_URL: 'postgres://localhost' },
      {},
      masterKey,
    );
    writeFileSync(join(dir, '.envsafe.vault'), JSON.stringify(vault, null, 2));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('outputs posix export statements', () => {
    const output = runCli(['_export', '--shell', 'posix'], {
      cwd: dir,
      env: { ENVSAFE_KEY: masterKey },
    });
    assert.ok(output.includes("export SECRET_KEY='test-value'"));
    assert.ok(output.includes("export DB_URL='postgres://localhost'"));
    assert.ok(output.includes("export _ENVSAFE_ACTIVE='1'"));
    assert.ok(output.includes('export _ENVSAFE_KEYS='));
  });

  it('outputs powershell export statements', () => {
    const output = runCli(['_export', '--shell', 'powershell'], {
      cwd: dir,
      env: { ENVSAFE_KEY: masterKey },
    });
    assert.ok(output.includes("$env:SECRET_KEY='test-value'"));
    assert.ok(output.includes("$env:DB_URL='postgres://localhost'"));
    assert.ok(output.includes("$env:_ENVSAFE_ACTIVE='1'"));
  });

  it('outputs nothing when no vault exists', () => {
    const emptyDir = mkdtempSync(join(tmpdir(), 'envsafe-empty-'));
    try {
      const output = runCli(['_export', '--shell', 'posix'], { cwd: emptyDir });
      assert.strictEqual(output.trim(), '');
    } finally {
      rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it('shell-escapes values with single quotes', () => {
    const vault = encryptVault({ KEY: "it's a test" }, {}, masterKey);
    writeFileSync(join(dir, '.envsafe.vault'), JSON.stringify(vault, null, 2));
    const output = runCli(['_export', '--shell', 'posix'], {
      cwd: dir,
      env: { ENVSAFE_KEY: masterKey },
    });
    assert.ok(output.includes("export KEY='it'\\''s a test'"));
  });
});

describe('_unexport command', () => {
  it('outputs posix unset statements', () => {
    const output = runCli(['_unexport', '--shell', 'posix'], {
      env: { _ENVSAFE_KEYS: 'FOO,BAR', _ENVSAFE_ACTIVE: '1' },
    });
    assert.ok(output.includes('unset FOO'));
    assert.ok(output.includes('unset BAR'));
    assert.ok(output.includes('unset _ENVSAFE_ACTIVE'));
    assert.ok(output.includes('unset _ENVSAFE_KEYS'));
    assert.ok(output.includes('unset _ENVSAFE_VAULT'));
  });

  it('outputs powershell remove statements', () => {
    const output = runCli(['_unexport', '--shell', 'powershell'], {
      env: { _ENVSAFE_KEYS: 'FOO,BAR', _ENVSAFE_ACTIVE: '1' },
    });
    assert.ok(output.includes('Remove-Item Env:FOO'));
    assert.ok(output.includes('Remove-Item Env:BAR'));
  });

  it('outputs nothing when no keys tracked', () => {
    const output = runCli(['_unexport', '--shell', 'posix']);
    assert.strictEqual(output.trim(), '');
  });
});
