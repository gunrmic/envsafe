import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { join, resolve, extname } from 'node:path';
import pc from 'picocolors';

const execFile = promisify(execFileCb);

interface Finding {
  level: 'CRITICAL' | 'WARNING' | 'INFO';
  message: string;
  detail?: string;
}

const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'OpenAI API key', pattern: /sk-[a-zA-Z0-9]{20,}/ },
  { name: 'AWS access key', pattern: /AKIA[0-9A-Z]{16}/ },
  { name: 'GitHub token', pattern: /ghp_[a-zA-Z0-9]{36}/ },
  { name: 'GitHub OAuth token', pattern: /gho_[a-zA-Z0-9]{36}/ },
  { name: 'Generic secret assignment', pattern: /(?:api_key|secret|password|token)\s*[:=]\s*['"][^'"]{8,}['"]/i },
];

const SCAN_EXTENSIONS = new Set(['.ts', '.js', '.jsx', '.tsx', '.json', '.yaml', '.yml', '.toml', '.py', '.rb', '.go']);
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'vendor', '__pycache__', '.next', 'build']);

async function isGitRepo(): Promise<boolean> {
  try {
    await execFile('git', ['rev-parse', '--is-inside-work-tree']);
    return true;
  } catch {
    return false;
  }
}

async function isEnvTracked(): Promise<boolean> {
  try {
    const { stdout } = await execFile('git', ['ls-files', '.env']);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

async function envInHistory(): Promise<boolean> {
  try {
    const { stdout } = await execFile('git', ['log', '--all', '--full-history', '--oneline', '--', '.env']);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

function scanFile(filePath: string): Finding[] {
  const findings: Finding[] = [];
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    for (const { name, pattern } of SECRET_PATTERNS) {
      if (pattern.test(lines[i])) {
        findings.push({
          level: 'WARNING',
          message: `Possible ${name} found in ${filePath}:${i + 1}`,
        });
      }
    }
  }

  return findings;
}

function walkDir(dir: string, results: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const fullPath = join(dir, entry);
    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walkDir(fullPath, results);
      } else if (SCAN_EXTENSIONS.has(extname(entry))) {
        results.push(fullPath);
      }
    } catch {
      // Skip inaccessible files
    }
  }

  return results;
}

function checkDockerfile(dir: string): Finding[] {
  const findings: Finding[] = [];
  const dockerfilePath = join(dir, 'Dockerfile');

  if (existsSync(dockerfilePath)) {
    const content = readFileSync(dockerfilePath, 'utf8');
    if (/\b(COPY|ADD)\b.*\.env\b/.test(content)) {
      findings.push({
        level: 'INFO',
        message: '.env referenced in Dockerfile — consider using build args or envsafe',
      });
    }
  }

  return findings;
}

function checkGitHubWorkflows(dir: string): Finding[] {
  const findings: Finding[] = [];
  const workflowDir = join(dir, '.github', 'workflows');

  if (!existsSync(workflowDir)) return findings;

  let files;
  try {
    files = readdirSync(workflowDir);
  } catch {
    return findings;
  }

  for (const file of files) {
    if (!file.endsWith('.yml') && !file.endsWith('.yaml')) continue;
    const filePath = join(workflowDir, file);
    const content = readFileSync(filePath, 'utf8');

    // Look for hardcoded values in env blocks (not ${{ secrets.* }})
    const envBlockPattern = /^\s+env:\s*\n((?:\s+\w+:\s*.+\n?)+)/gm;
    let match;
    while ((match = envBlockPattern.exec(content)) !== null) {
      const block = match[1];
      const lines = block.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const colonIdx = trimmed.indexOf(':');
        if (colonIdx === -1) continue;
        const value = trimmed.slice(colonIdx + 1).trim();
        if (value && !value.startsWith('${{') && value.length > 3) {
          findings.push({
            level: 'WARNING',
            message: `Possible hardcoded env value in ${filePath}: ${trimmed}`,
          });
        }
      }
    }
  }

  return findings;
}

export async function audit(): Promise<void> {
  const dir = resolve('.');
  const findings: Finding[] = [];
  const inGitRepo = await isGitRepo();

  // Check .env tracked by git
  if (inGitRepo) {
    if (await isEnvTracked()) {
      findings.push({
        level: 'CRITICAL',
        message: '.env is tracked by git',
        detail: 'Run: git rm --cached .env',
      });
    }

    if (await envInHistory()) {
      findings.push({
        level: 'CRITICAL',
        message: '.env found in git history',
        detail: 'Consider using git filter-branch or BFG Repo Cleaner to remove it',
      });
    }
  }

  // Check .env exists but not in gitignore
  if (existsSync(join(dir, '.env'))) {
    const gitignorePath = join(dir, '.gitignore');
    if (!existsSync(gitignorePath) || !readFileSync(gitignorePath, 'utf8').includes('.env')) {
      findings.push({
        level: 'WARNING',
        message: '.env file exists but is not in .gitignore',
      });
    }
  }

  // Check Dockerfile
  findings.push(...checkDockerfile(dir));

  // Check GitHub Actions workflows
  findings.push(...checkGitHubWorkflows(dir));

  // Scan source files for hardcoded secrets
  const files = walkDir(dir);
  for (const file of files) {
    findings.push(...scanFile(file));
  }

  // Output report
  if (findings.length === 0) {
    console.log(pc.green('envsafe audit — no issues found'));
    process.exit(0);
  }

  console.log(`\n${pc.bold('envsafe audit')} — ${findings.length} issue(s) found\n`);

  for (const finding of findings) {
    const levelColor =
      finding.level === 'CRITICAL' ? pc.red :
      finding.level === 'WARNING' ? pc.yellow :
      pc.blue;

    console.log(`  ${levelColor(finding.level.padEnd(10))} ${finding.message}`);
    if (finding.detail) {
      console.log(`             ${pc.dim(finding.detail)}`);
    }
  }

  console.log('');

  const hasCritical = findings.some((f) => f.level === 'CRITICAL');
  process.exit(hasCritical ? 1 : 0);
}
