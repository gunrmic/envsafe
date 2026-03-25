import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generateMasterKey, encryptVault, decryptVault } from '../src/crypto/vault.js';
import { parseDotenv } from '../src/parser/dotenv.js';
import { ensureGitignore, getVaultPath, findVaultFile } from '../src/utils.js';
import type { VaultFile } from '../src/types.js';

describe('integration: init flow', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'envsafe-test-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('full init → set → get round-trip via vault operations', () => {
    // Simulate init: parse .env, encrypt, write vault
    const envContent = 'DATABASE_URL=postgres://localhost/mydb\nAPI_KEY=sk-test-123';
    writeFileSync(join(dir, '.env'), envContent);

    const secrets = parseDotenv(envContent);
    assert.strictEqual(Object.keys(secrets).length, 2);

    const masterKey = generateMasterKey();
    const vault = encryptVault(secrets, {}, masterKey);
    const vaultPath = getVaultPath(dir);
    writeFileSync(vaultPath, JSON.stringify(vault, null, 2));

    // Simulate get: read vault, decrypt, retrieve key
    const raw = readFileSync(vaultPath, 'utf8');
    const loaded: VaultFile = JSON.parse(raw);
    const decrypted = decryptVault(loaded, masterKey);

    assert.strictEqual(decrypted.DATABASE_URL, 'postgres://localhost/mydb');
    assert.strictEqual(decrypted.API_KEY, 'sk-test-123');

    // Simulate set: add new key, re-encrypt
    decrypted.NEW_KEY = 'new-value';
    const updated = encryptVault(decrypted, {}, masterKey);
    writeFileSync(vaultPath, JSON.stringify(updated, null, 2));

    const raw2 = readFileSync(vaultPath, 'utf8');
    const loaded2: VaultFile = JSON.parse(raw2);
    const decrypted2 = decryptVault(loaded2, masterKey);

    assert.strictEqual(decrypted2.NEW_KEY, 'new-value');
    assert.strictEqual(Object.keys(decrypted2).length, 3);
  });
});

describe('ensureGitignore', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'envsafe-gitignore-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('creates .gitignore if it does not exist', () => {
    ensureGitignore(dir, ['.env', '.envsafe.vault']);
    const content = readFileSync(join(dir, '.gitignore'), 'utf8');
    assert.ok(content.includes('.env'));
    assert.ok(content.includes('.envsafe.vault'));
  });

  it('appends to existing .gitignore without duplicates', () => {
    writeFileSync(join(dir, '.gitignore'), 'node_modules/\n.env\n');
    ensureGitignore(dir, ['.env', '.envsafe.vault']);
    const content = readFileSync(join(dir, '.gitignore'), 'utf8');
    const envOccurrences = content.split('\n').filter((l) => l.trim() === '.env').length;
    assert.strictEqual(envOccurrences, 1);
    assert.ok(content.includes('.envsafe.vault'));
  });
});

describe('findVaultFile', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'envsafe-find-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('finds vault in current directory', () => {
    writeFileSync(join(dir, '.envsafe.vault'), '{}');
    const found = findVaultFile(dir);
    assert.strictEqual(found, join(dir, '.envsafe.vault'));
  });

  it('finds vault in parent directory', () => {
    const subDir = join(dir, 'sub');
    mkdirSync(subDir, { recursive: true });
    writeFileSync(join(dir, '.envsafe.vault'), '{}');
    const found = findVaultFile(subDir);
    assert.strictEqual(found, join(dir, '.envsafe.vault'));
  });

  it('returns null when no vault found', () => {
    const found = findVaultFile(dir);
    assert.strictEqual(found, null);
  });
});
