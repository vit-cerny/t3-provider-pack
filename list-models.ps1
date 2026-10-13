# T3 provider pack - list live model IDs.
# Windows PowerShell 5.1 compatible, ASCII only. Never prints key values.
#
# NVIDIA NIM and OpenRouter rotate model IDs, so fetch the current list instead
# of trusting a hardcoded one:
#
#   powershell -ExecutionPolicy Bypass -File list-models.ps1
#   powershell -ExecutionPolicy Bypass -File list-models.ps1 -Provider nvidia
[CmdletBinding()]
param(
  [ValidateSet("openrouter", "deepseek", "nvidia", "all")]
  [string]$Provider = "all"
)

$endpoints = @{
  openrouter = @{ Url = "https://openrouter.ai/api/v1/models";       Key = "OPENROUTER_API_KEY" }
  deepseek   = @{ Url = "https://api.deepseek.com/models";           Key = "DEEPSEEK_API_KEY" }
  nvidia     = @{ Url = "https://integrate.api.nvidia.com/v1/models"; Key = "NVIDIA_API_KEY" }
}

$keys = if ($Provider -eq "all") { @("openrouter", "deepseek", "nvidia") } else { @($Provider) }

foreach ($id in $keys) {
  $endpoint = $endpoints[$id]
  Write-Host "== $id"
  $key = [Environment]::GetEnvironmentVariable($endpoint.Key)
  if ([string]::IsNullOrEmpty($key)) {
    Write-Host "  $($endpoint.Key) is not set; skipping"
    continue
  }
  try {
    $response = Invoke-RestMethod -Uri $endpoint.Url -Headers @{ Authorization = "Bearer $key" } -TimeoutSec 30
    $models = @($response.data) | ForEach-Object { $_.id } | Where-Object { $_ }
    if (-not $models) {
      Write-Host "  endpoint returned no models"
      continue
    }
    $models | Sort-Object | ForEach-Object { Write-Host "  $_" }
    Write-Host ""
    Write-Host "  Paste a model ID into the provider's 'models' key, for example:"
    $first = @($models | Sort-Object)[0]
    Write-Host "    `"$id`": { `"models`": { `"$first`": { `"name`": `"$first`" } } }"
  } catch {
    Write-Host "  request failed: $($_.Exception.Message)"
  }
}
