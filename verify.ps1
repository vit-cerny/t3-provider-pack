# T3 provider pack - verify.
# Windows PowerShell 5.1 compatible, ASCII only. Never prints key values.
#
#   powershell -ExecutionPolicy Bypass -File verify.ps1
[CmdletBinding()]
param(
  [string]$ConfigPath = (Join-Path $env:USERPROFILE ".config\opencode\opencode.jsonc")
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$merge = Join-Path $root "scripts\merge-config.mjs"

Write-Host "== Config"
if (-not (Test-Path $ConfigPath)) {
  Write-Host "  NOT FOUND: $ConfigPath  (run install.ps1)"
} elseif (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "  node not on PATH; cannot inspect the config"
} else {
  Write-Host "  $ConfigPath"
  node $merge --check $ConfigPath
  if ($LASTEXITCODE -eq 0) { Write-Host "  all providers present" }
  else { Write-Host "  some providers missing (run install.ps1)" }
}

Write-Host "== API keys in this environment (values are never printed)"
foreach ($name in @("OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "NVIDIA_API_KEY")) {
  $value = [Environment]::GetEnvironmentVariable($name)
  $state = if ([string]::IsNullOrEmpty($value)) { "MISSING" } else { "set" }
  Write-Host ("  {0,-20} {1}" -f $name, $state)
}

Write-Host "== OpenCode model catalog"
if (Get-Command opencode -ErrorAction SilentlyContinue) {
  $out = ""
  try { $out = (& opencode models 2>&1 | Out-String) } catch { $out = "" }
  foreach ($id in @("openrouter", "deepseek", "nvidia")) {
    if ($out -match [regex]::Escape($id)) { Write-Host "  listed:    $id" }
    else { Write-Host "  not shown: $id (add model IDs under that provider's 'models' key)" }
  }
} else {
  Write-Host "  opencode not on PATH; check with /models inside the OpenCode TUI instead"
}
