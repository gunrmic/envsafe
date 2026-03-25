import pc from 'picocolors';

const ZSH_HOOK = `
_envsafe_hook() {
  local vault
  vault="$(envsafe _export --shell posix 2>/dev/null)"
  if [ -n "$vault" ]; then
    eval "$vault"
  elif [ -n "$_ENVSAFE_ACTIVE" ]; then
    eval "$(envsafe _unexport --shell posix 2>/dev/null)"
  fi
}
if [[ -z "\${chpwd_functions[(r)_envsafe_hook]}" ]]; then
  chpwd_functions=(_envsafe_hook \${chpwd_functions[@]})
fi
_envsafe_hook
`.trim();

const BASH_HOOK = `
_envsafe_hook() {
  local vault
  vault="$(envsafe _export --shell posix 2>/dev/null)"
  if [ -n "$vault" ]; then
    eval "$vault"
  elif [ -n "$_ENVSAFE_ACTIVE" ]; then
    eval "$(envsafe _unexport --shell posix 2>/dev/null)"
  fi
}
if [[ ! "$PROMPT_COMMAND" == *"_envsafe_hook"* ]]; then
  PROMPT_COMMAND="_envsafe_hook;\${PROMPT_COMMAND:-}"
fi
_envsafe_hook
`.trim();

const POWERSHELL_HOOK = `
if (-not (Get-Variable -Name _envsafe_original_prompt -Scope Global -ErrorAction SilentlyContinue)) {
  $global:_envsafe_original_prompt = $function:prompt
  function global:prompt {
    $vault = envsafe _export --shell powershell 2>$null
    if ($vault) { Invoke-Expression $vault }
    elseif ($env:_ENVSAFE_ACTIVE) {
      $unexport = envsafe _unexport --shell powershell 2>$null
      if ($unexport) { Invoke-Expression $unexport }
    }
    & $global:_envsafe_original_prompt
  }
  # Run once on init
  $vault = envsafe _export --shell powershell 2>$null
  if ($vault) { Invoke-Expression $vault }
}
`.trim();

const HOOKS: Record<string, string> = {
  zsh: ZSH_HOOK,
  bash: BASH_HOOK,
  powershell: POWERSHELL_HOOK,
};

export function hook(shell: string): void {
  const script = HOOKS[shell.toLowerCase()];

  if (!script) {
    console.error(pc.red(`Unknown shell: ${shell}`));
    console.error(pc.dim(`Supported: ${Object.keys(HOOKS).join(', ')}`));
    process.exit(1);
  }

  console.log(script);
}
