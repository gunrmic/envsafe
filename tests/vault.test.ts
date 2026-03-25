import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { encryptVault, decryptVault, generateMasterKey } from '../src/crypto/vault.js';

describe('vault encryption', () => {
  it('round-trips secrets through encrypt/decrypt', () => {
    const secrets = { DB_URL: 'postgres://localhost/test', API_KEY: 'sk-12345' };
    const key = generateMasterKey();
    const vault = encryptVault(secrets, {}, key);
    const result = decryptVault(vault, key);
    assert.deepStrictEqual(result, secrets);
  });

  it('preserves scopes metadata', () => {
    const secrets = { A: '1', B: '2' };
    const scopes = { web: ['A'], worker: ['B'] };
    const key = generateMasterKey();
    const vault = encryptVault(secrets, scopes, key);
    assert.deepStrictEqual(vault.scopes, scopes);
  });

  it('generates unique IVs on each encryption', () => {
    const secrets = { KEY: 'value' };
    const key = generateMasterKey();
    const v1 = encryptVault(secrets, {}, key);
    const v2 = encryptVault(secrets, {}, key);
    assert.notStrictEqual(v1.iv, v2.iv);
  });

  it('fails to decrypt with wrong key', () => {
    const secrets = { KEY: 'value' };
    const key1 = generateMasterKey();
    const key2 = generateMasterKey();
    const vault = encryptVault(secrets, {}, key1);
    assert.throws(() => decryptVault(vault, key2));
  });

  it('fails on tampered ciphertext', () => {
    const secrets = { KEY: 'value' };
    const key = generateMasterKey();
    const vault = encryptVault(secrets, {}, key);

    // Tamper with encrypted data
    const buf = Buffer.from(vault.data, 'base64');
    buf[0] ^= 0xff;
    vault.data = buf.toString('base64');

    assert.throws(() => decryptVault(vault, key));
  });

  it('fails on tampered auth tag', () => {
    const secrets = { KEY: 'value' };
    const key = generateMasterKey();
    const vault = encryptVault(secrets, {}, key);

    const buf = Buffer.from(vault.authTag, 'base64');
    buf[0] ^= 0xff;
    vault.authTag = buf.toString('base64');

    assert.throws(() => decryptVault(vault, key));
  });

  it('generates 64-char hex master keys', () => {
    const key = generateMasterKey();
    assert.strictEqual(key.length, 64);
    assert.match(key, /^[0-9a-f]{64}$/);
  });

  it('handles empty secrets', () => {
    const key = generateMasterKey();
    const vault = encryptVault({}, {}, key);
    const result = decryptVault(vault, key);
    assert.deepStrictEqual(result, {});
  });

  it('handles secrets with special characters', () => {
    const secrets = {
      URL: 'postgres://user:p@ss=w0rd@host:5432/db?ssl=true&timeout=30',
      MULTILINE: 'line1\nline2\nline3',
      UNICODE: 'hello world',
      EMPTY: '',
    };
    const key = generateMasterKey();
    const vault = encryptVault(secrets, {}, key);
    const result = decryptVault(vault, key);
    assert.deepStrictEqual(result, secrets);
  });
});
