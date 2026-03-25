export interface VaultFile {
  version: number;
  algorithm: string;
  salt: string;
  iv: string;
  authTag: string;
  data: string;
  scopes: Record<string, string[]>;
}

export interface KeychainBackend {
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(service: string, account: string, password: string): Promise<void>;
  deletePassword(service: string, account: string): Promise<boolean>;
}

export class VaultNotFoundError extends Error {
  constructor(path: string) {
    super(`Vault file not found: ${path}`);
    this.name = 'VaultNotFoundError';
  }
}

export class KeychainAccessError extends Error {
  constructor(message: string) {
    super(`Keychain access failed: ${message}`);
    this.name = 'KeychainAccessError';
  }
}

export class DecryptionError extends Error {
  constructor(message: string = 'Failed to decrypt vault — wrong key or corrupted data') {
    super(message);
    this.name = 'DecryptionError';
  }
}
