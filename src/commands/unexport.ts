export function unexportCmd(options: { shell?: string }): void {
  const keysStr = process.env._ENVSAFE_KEYS;
  if (!keysStr) return;

  const keys = keysStr.split(',');
  const shell = options.shell || 'posix';
  const isPowerShell = shell === 'powershell';

  const lines: string[] = [];

  for (const key of keys) {
    if (isPowerShell) {
      lines.push(`Remove-Item Env:${key} -ErrorAction SilentlyContinue`);
    } else {
      lines.push(`unset ${key}`);
    }
  }

  // Clean up metadata
  if (isPowerShell) {
    lines.push('Remove-Item Env:_ENVSAFE_ACTIVE -ErrorAction SilentlyContinue');
    lines.push('Remove-Item Env:_ENVSAFE_KEYS -ErrorAction SilentlyContinue');
    lines.push('Remove-Item Env:_ENVSAFE_VAULT -ErrorAction SilentlyContinue');
  } else {
    lines.push('unset _ENVSAFE_ACTIVE');
    lines.push('unset _ENVSAFE_KEYS');
    lines.push('unset _ENVSAFE_VAULT');
  }

  console.log(lines.join('\n'));
  console.error('envsafe: unloaded secrets');
}
