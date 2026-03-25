import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import type { KeychainBackend } from '../types.js';

const execFile = promisify(execFileCb);

export class MacOSKeychain implements KeychainBackend {
  async getPassword(service: string, account: string): Promise<string | null> {
    try {
      const { stdout } = await execFile('/usr/bin/security', [
        'find-generic-password', '-s', service, '-a', account, '-w',
      ]);
      return stdout.trim();
    } catch {
      return null;
    }
  }

  async setPassword(service: string, account: string, password: string): Promise<void> {
    await execFile('/usr/bin/security', [
      'add-generic-password', '-U', '-s', service, '-a', account, '-w', password,
    ]);
  }

  async deletePassword(service: string, account: string): Promise<boolean> {
    try {
      await execFile('/usr/bin/security', [
        'delete-generic-password', '-s', service, '-a', account,
      ]);
      return true;
    } catch {
      return false;
    }
  }
}

export class LinuxKeychain implements KeychainBackend {
  async getPassword(service: string, account: string): Promise<string | null> {
    try {
      const { stdout } = await execFile('secret-tool', [
        'lookup', 'service', service, 'account', account,
      ]);
      return stdout.trim() || null;
    } catch {
      return null;
    }
  }

  async setPassword(service: string, account: string, password: string): Promise<void> {
    const child = execFileCb('secret-tool', [
      'store', '--label', `${service}:${account}`, 'service', service, 'account', account,
    ]);
    child.stdin?.write(password);
    child.stdin?.end();
    await new Promise<void>((resolve, reject) => {
      child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`secret-tool exited with ${code}`)));
      child.on('error', reject);
    });
  }

  async deletePassword(service: string, account: string): Promise<boolean> {
    try {
      await execFile('secret-tool', [
        'clear', 'service', service, 'account', account,
      ]);
      return true;
    } catch {
      return false;
    }
  }
}

export class WindowsKeychain implements KeychainBackend {
  private targetName(service: string, account: string): string {
    return `${service}/${account}`;
  }

  async getPassword(service: string, account: string): Promise<string | null> {
    const target = this.targetName(service, account);
    const script = `
      $cred = Get-StoredCredential -Target '${target.replace(/'/g, "''")}' -ErrorAction SilentlyContinue
      if ($cred) { $cred.GetNetworkCredential().Password } else { exit 1 }
    `;
    try {
      // Try CredentialManager module first, fall back to cmdkey
      const { stdout } = await execFile('powershell', ['-NoProfile', '-Command', script]);
      return stdout.trim() || null;
    } catch {
      return this.getPasswordCmdkey(target);
    }
  }

  private async getPasswordCmdkey(target: string): Promise<string | null> {
    // cmdkey /list doesn't expose passwords; use Win32 CredRead via PowerShell
    const script = `
Add-Type -Namespace Win32 -Name Credential -MemberDefinition @'
[DllImport("advapi32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
public static extern bool CredRead(string target, int type, int flags, out IntPtr cred);
[DllImport("advapi32.dll")]
public static extern void CredFree(IntPtr cred);
[StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
public struct CREDENTIAL {
  public int Flags; public int Type; public string TargetName; public string Comment;
  public long LastWritten; public int CredentialBlobSize; public IntPtr CredentialBlob;
  public int Persist; public int AttributeCount; public IntPtr Attributes;
  public string TargetAlias; public string UserName;
}
'@
$ptr = [IntPtr]::Zero
if ([Win32.Credential]::CredRead('${target.replace(/'/g, "''")}', 1, 0, [ref]$ptr)) {
  $cred = [Runtime.InteropServices.Marshal]::PtrToStructure($ptr, [Type][Win32.Credential+CREDENTIAL])
  $bytes = New-Object byte[] $cred.CredentialBlobSize
  [Runtime.InteropServices.Marshal]::Copy($cred.CredentialBlob, $bytes, 0, $cred.CredentialBlobSize)
  [Win32.Credential]::CredFree($ptr)
  [Text.Encoding]::Unicode.GetString($bytes)
} else { exit 1 }
`;
    try {
      const { stdout } = await execFile('powershell', ['-NoProfile', '-Command', script]);
      return stdout.trim() || null;
    } catch {
      return null;
    }
  }

  async setPassword(service: string, account: string, password: string): Promise<void> {
    const target = this.targetName(service, account);
    await execFile('cmdkey', [
      `/generic:${target}`, `/user:${account}`, `/pass:${password}`,
    ]);
  }

  async deletePassword(service: string, account: string): Promise<boolean> {
    const target = this.targetName(service, account);
    try {
      await execFile('cmdkey', [`/delete:${target}`]);
      return true;
    } catch {
      return false;
    }
  }
}

export class EnvKeychain implements KeychainBackend {
  async getPassword(): Promise<string | null> {
    return process.env.ENVSAFE_KEY ?? null;
  }

  async setPassword(): Promise<void> {
    // No-op: env-based keychain is read-only
  }

  async deletePassword(): Promise<boolean> {
    return false;
  }
}

export function createKeychain(): KeychainBackend {
  if (process.env.ENVSAFE_KEY) {
    return new EnvKeychain();
  }

  switch (process.platform) {
    case 'darwin':
      return new MacOSKeychain();
    case 'linux':
      return new LinuxKeychain();
    case 'win32':
      return new WindowsKeychain();
    default:
      throw new Error(
        `Unsupported platform: ${process.platform}. ` +
        'Set the ENVSAFE_KEY environment variable as a fallback.'
      );
  }
}
