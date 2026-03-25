import { execFileSync } from 'node:child_process';

const STDIO: ['pipe', 'pipe', 'pipe'] = ['pipe', 'pipe', 'pipe'];

export function getPasswordSync(service: string, account: string): string | null {
  if (process.env.ENVSAFE_KEY) {
    return process.env.ENVSAFE_KEY;
  }

  try {
    switch (process.platform) {
      case 'darwin':
        return execFileSync('/usr/bin/security', [
          'find-generic-password', '-s', service, '-a', account, '-w',
        ], { stdio: STDIO }).toString().trim();

      case 'linux':
        return execFileSync('secret-tool', [
          'lookup', 'service', service, 'account', account,
        ], { stdio: STDIO }).toString().trim() || null;

      case 'win32': {
        const target = `${service}/${account}`;
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
        return execFileSync('powershell', ['-NoProfile', '-Command', script],
          { stdio: STDIO }).toString().trim() || null;
      }

      default:
        return null;
    }
  } catch {
    return null;
  }
}
