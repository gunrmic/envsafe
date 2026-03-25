# envsafe

Encrypted, keychain-backed secret storage. Replaces `.env` files.

## The Problem

The [LiteLLM/Trivy supply chain attack](https://www.bleepingcomputer.com/news/security/) (March 2025) showed how trivially malicious dependencies can read `.env` files from disk. Every package you install has full filesystem access to your plaintext secrets.

`envsafe` eliminates the plaintext file. Your secrets are encrypted at rest, and the encryption key lives in your OS keychain — not on disk.

## What envsafe protects against

- Malicious dependencies scanning the filesystem for `.env` files
- Secrets accidentally committed to git
- Static CI tokens stored in plaintext repo secrets
- Log leakage of secret values in stdout/stderr

## What envsafe does NOT protect against

- A malicious dependency reading `process.env` at runtime — this is inherent to how environment variables work in any OS process
- Root-level process memory scraping
- A fully compromised machine

The threat model is **filesystem-level exposure**, not in-process memory access. Use `--scope` and `--only` to limit which secrets each command can access.

## Installation

```bash
npm install -g @gunrmic/envsafe
```

Or use directly:

```bash
npx @gunrmic/envsafe init
```

## Quick Start

```bash
# 1. Import your .env and encrypt it
envsafe init

# 2. Add more secrets
envsafe set STRIPE_KEY sk-live-...

# 3. Run your app with injected secrets
envsafe run -- npm start

# 4. Scope secrets to limit blast radius
envsafe run --only DATABASE_URL,PORT -- node server.js
```

## Commands

### `envsafe init`

Import an existing `.env` file, encrypt it, and store the encryption key in your OS keychain.

```bash
envsafe init          # Import .env if present, or create empty vault
envsafe init --force  # Overwrite existing vault
```

### `envsafe run -- <command>`

Run a command with decrypted secrets injected as environment variables.

```bash
envsafe run -- npm start
envsafe run --only DATABASE_URL,PORT -- node server.js
envsafe run --scope web -- npm start
```

| Flag | Description |
|------|-------------|
| `--only <keys>` | Only inject these keys (comma-separated) |
| `--scope <name>` | Only inject keys in this scope |

### `envsafe set <KEY> [VALUE]`

Add or update a secret. If no value is provided, you'll be prompted with masked input.

```bash
envsafe set DATABASE_URL postgres://localhost/mydb
envsafe set API_KEY  # prompts for value
```

### `envsafe get <KEY>`

Print a secret value to stdout (for debugging).

```bash
envsafe get DATABASE_URL
```

### `envsafe list`

List all secret key names (never values).

```bash
envsafe list
envsafe list --json
```

### `envsafe audit`

Scan your repository for secret exposure risks.

```bash
envsafe audit
```

Checks for:
- `.env` tracked by git
- `.env` in git history
- `.env` referenced in Dockerfile
- Hardcoded API keys in source files
- Static tokens in GitHub Actions workflows

Exit code 0 if clean, 1 if issues found (CI-friendly).

### `envsafe ci --platform <name>`

Generate CI/CD integration snippets.

```bash
envsafe ci --platform github
envsafe ci --platform gitlab
envsafe ci --platform circleci
```

## Security Design

- **Encryption**: AES-256-GCM with scrypt key derivation
- **Key storage**: OS keychain (macOS Keychain, Linux libsecret, Windows Credential Manager)
- **No vendor storage**: Everything stays local. No accounts, no servers, no SaaS
- **CI/CD**: Set `ENVSAFE_KEY` environment variable to decrypt without a keychain
- **Zero native dependencies**: Uses OS-native credential CLIs, no compiled addons

### Vault Format

Secrets are stored in `.envsafe.vault` as encrypted JSON. The encryption key is stored in your OS keychain, never on disk alongside the vault.

A fresh IV is generated on every write to prevent nonce reuse.

## Contributing

```bash
git clone https://github.com/gunrmic/envsafe
cd envsafe
yarn install
yarn test
```

## License

MIT
