import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generateMasterKey, encryptVault, decryptVault } from '../src/crypto/vault.js';
import type { VaultFile } from '../src/types.js';

function createTestVault(dir: string, secrets: Record<string, string>, scopes: Record<string, string[]> = {}): string {
  const masterKey = generateMasterKey();
  const vault = encryptVault(secrets, scopes, masterKey);
  const vaultPath = join(dir, '.envsafe.vault');
  writeFileSync(vaultPath, JSON.stringify(vault, null, 2));
  return masterKey;
}

function readVaultSecrets(dir: string, masterKey: string): { secrets: Record<string, string>; scopes: Record<string, string[]> } {
  const vault: VaultFile = JSON.parse(readFileSync(join(dir, '.envsafe.vault'), 'utf8'));
  return { secrets: decryptVault(vault, masterKey), scopes: vault.scopes };
}

describe('rm command logic', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'envsafe-rm-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('removes a key from secrets and scopes', () => {
    const key = createTestVault(dir, { A: '1', B: '2' }, { web: ['A', 'B'] });

    // Simulate rm: load, delete, save
    const { secrets, scopes } = readVaultSecrets(dir, key);
    delete secrets['A'];
    scopes['web'] = scopes['web'].filter(k => k !== 'A');
    const vault = encryptVault(secrets, scopes, key);
    writeFileSync(join(dir, '.envsafe.vault'), JSON.stringify(vault, null, 2));

    const result = readVaultSecrets(dir, key);
    assert.ok(!('A' in result.secrets));
    assert.strictEqual(result.secrets['B'], '2');
    assert.deepStrictEqual(result.scopes['web'], ['B']);
  });
});

describe('scope management logic', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'envsafe-scope-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('adds keys to a new scope', () => {
    const key = createTestVault(dir, { A: '1', B: '2', C: '3' });

    const { secrets, scopes } = readVaultSecrets(dir, key);
    scopes['api'] = ['A', 'B'];
    const vault = encryptVault(secrets, scopes, key);
    writeFileSync(join(dir, '.envsafe.vault'), JSON.stringify(vault, null, 2));

    const result = readVaultSecrets(dir, key);
    assert.deepStrictEqual(result.scopes['api'], ['A', 'B']);
  });

  it('removes keys from a scope', () => {
    const key = createTestVault(dir, { A: '1', B: '2' }, { web: ['A', 'B'] });

    const { secrets, scopes } = readVaultSecrets(dir, key);
    scopes['web'] = scopes['web'].filter(k => k !== 'A');
    const vault = encryptVault(secrets, scopes, key);
    writeFileSync(join(dir, '.envsafe.vault'), JSON.stringify(vault, null, 2));

    const result = readVaultSecrets(dir, key);
    assert.deepStrictEqual(result.scopes['web'], ['B']);
  });

  it('deletes empty scope', () => {
    const key = createTestVault(dir, { A: '1' }, { web: ['A'] });

    const { secrets, scopes } = readVaultSecrets(dir, key);
    delete scopes['web'];
    const vault = encryptVault(secrets, scopes, key);
    writeFileSync(join(dir, '.envsafe.vault'), JSON.stringify(vault, null, 2));

    const result = readVaultSecrets(dir, key);
    assert.ok(!('web' in result.scopes));
  });
});

describe('import logic', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'envsafe-import-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('merges new keys without overwriting existing', () => {
    const key = createTestVault(dir, { A: '1', B: '2' });
    const incoming = { B: 'updated', C: '3' };

    const { secrets, scopes } = readVaultSecrets(dir, key);
    for (const [k, v] of Object.entries(incoming)) {
      secrets[k] = v;
    }
    const vault = encryptVault(secrets, scopes, key);
    writeFileSync(join(dir, '.envsafe.vault'), JSON.stringify(vault, null, 2));

    const result = readVaultSecrets(dir, key);
    assert.strictEqual(result.secrets['A'], '1');
    assert.strictEqual(result.secrets['B'], 'updated');
    assert.strictEqual(result.secrets['C'], '3');
  });

  it('overwrites all secrets when overwrite flag is set', () => {
    const key = createTestVault(dir, { A: '1', B: '2' });
    const incoming = { C: '3' };

    const { scopes } = readVaultSecrets(dir, key);
    const vault = encryptVault(incoming, scopes, key);
    writeFileSync(join(dir, '.envsafe.vault'), JSON.stringify(vault, null, 2));

    const result = readVaultSecrets(dir, key);
    assert.ok(!('A' in result.secrets));
    assert.ok(!('B' in result.secrets));
    assert.strictEqual(result.secrets['C'], '3');
  });
});

describe('rotate logic', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'envsafe-rotate-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('re-encrypts vault with new key', () => {
    const oldKey = createTestVault(dir, { SECRET: 'value' }, { web: ['SECRET'] });

    // Simulate rotate
    const { secrets, scopes } = readVaultSecrets(dir, oldKey);
    const newKey = generateMasterKey();
    assert.notStrictEqual(oldKey, newKey);

    const vault = encryptVault(secrets, scopes, newKey);
    writeFileSync(join(dir, '.envsafe.vault'), JSON.stringify(vault, null, 2));

    // Old key should fail
    assert.throws(() => readVaultSecrets(dir, oldKey));

    // New key should work
    const result = readVaultSecrets(dir, newKey);
    assert.strictEqual(result.secrets['SECRET'], 'value');
    assert.deepStrictEqual(result.scopes['web'], ['SECRET']);
  });
});

describe('diff logic', () => {
  it('detects missing and extra keys', () => {
    const vaultKeys = new Set(['A', 'B', 'C']);
    const refKeys = new Set(['B', 'C', 'D']);

    const missing = [...refKeys].filter(k => !vaultKeys.has(k));
    const extra = [...vaultKeys].filter(k => !refKeys.has(k));
    const present = [...refKeys].filter(k => vaultKeys.has(k));

    assert.deepStrictEqual(missing, ['D']);
    assert.deepStrictEqual(extra, ['A']);
    assert.deepStrictEqual(present, ['B', 'C']);
  });
});
