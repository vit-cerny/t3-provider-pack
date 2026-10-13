# T3 provider pack - installer.
# Windows PowerShell 5.1 compatible, ASCII only.
#
# Adds OpenRouter, DeepSeek API and NVIDIA NIM to your global OpenCode config so
# T3 Code sees them through its OpenCode provider. Backs the config up first.
#
#   powershell -ExecutionPolicy Bypass -File install.ps1
#   powershell -ExecutionPolicy Bypass -File install.ps1 -DryRun
[CmdletBinding()]
param(
  [string]$ConfigPath = (Join-Path $env:USERPROFILE ".config\opencode\opencode.jsonc"),
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$merge = Join-Path $root "scripts\merge-config.mjs"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is required but 'node' was not found on PATH."
}

$dir = Split-Path -Parent $ConfigPath
if (-not (Test-Path $dir)) {
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
}

if (-not (Test-Path $ConfigPath)) {
  Write-Host "No config found. Creating $ConfigPath"
  $seed = "{`n  `"`$schema`": `"https://opencode.ai/config.json`"`n}`n"
  [System.IO.File]::WriteAllText($ConfigPath, $seed)
}

if ($DryRun) {
  Write-Host "Dry run: checking $ConfigPath"
  node $merge --check $ConfigPath
  exit $LASTEXITCODE
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = "$ConfigPath.bak.$stamp"
Copy-Item -Path $ConfigPath -Destination $backup -Force
Write-Host "Backup: $backup"

node $merge $ConfigPath
if ($LASTEXITCODE -ne 0) {
  throw "Merge failed. Your config is unchanged; backup at $backup"
}

Write-Host ""
Write-Host "Next steps"
Write-Host "  1. Set the API keys in the environment T3 runs in (machine or user scope):"
Write-Host "       setx OPENROUTER_API_KEY ""..."""
Write-Host "       setx DEEPSEEK_API_KEY   ""..."""
Write-Host "       setx NVIDIA_API_KEY     ""..."""
Write-Host "  2. Restart T3 Code (and OpenCode if it is running)."
Write-Host "  3. In T3: Settings -> Providers -> add or open an OpenCode instance."
Write-Host "     Set the OpenCode binary path if T3 cannot find it."
Write-Host "  4. Pick a model in the composer. If a provider shows no models, add model"
Write-Host "     IDs under the provider's 'models' key (see README and list-models.ps1)."
Write-Host ""
Write-Host "Verify with:  powershell -ExecutionPolicy Bypass -File verify.ps1"
