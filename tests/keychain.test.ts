import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EnvKeychain, createKeychain } from '../src/crypto/keychain.js';

describe('EnvKeychain', () => {
  it('returns ENVSAFE_KEY from environment', async () => {
    const original = process.env.ENVSAFE_KEY;
    try {
      process.env.ENVSAFE_KEY = 'test-master-key-hex';
      const kc = new EnvKeychain();
      const result = await kc.getPassword('envsafe', '/test');
      assert.strictEqual(result, 'test-master-key-hex');
    } finally {
      if (original === undefined) delete process.env.ENVSAFE_KEY;
      else process.env.ENVSAFE_KEY = original;
    }
  });

  it('returns null when ENVSAFE_KEY not set', async () => {
    const original = process.env.ENVSAFE_KEY;
    try {
      delete process.env.ENVSAFE_KEY;
      const kc = new EnvKeychain();
      const result = await kc.getPassword('envsafe', '/test');
      assert.strictEqual(result, null);
    } finally {
      if (original !== undefined) process.env.ENVSAFE_KEY = original;
    }
  });

  it('setPassword is a no-op', async () => {
    const kc = new EnvKeychain();
    await kc.setPassword('envsafe', '/test', 'value'); // should not throw
  });

  it('deletePassword returns false', async () => {
    const kc = new EnvKeychain();
    assert.strictEqual(await kc.deletePassword('envsafe', '/test'), false);
  });
});

describe('createKeychain', () => {
  it('returns EnvKeychain when ENVSAFE_KEY is set', () => {
    const original = process.env.ENVSAFE_KEY;
    try {
      process.env.ENVSAFE_KEY = 'test-key';
      const kc = createKeychain();
      assert.ok(kc instanceof EnvKeychain);
    } finally {
      if (original === undefined) delete process.env.ENVSAFE_KEY;
      else process.env.ENVSAFE_KEY = original;
    }
  });
});
