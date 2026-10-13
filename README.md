# T3 provider pack

Add **OpenRouter**, **DeepSeek API** and **NVIDIA NIM** to [T3 Code](https://t3.codes) by
configuring the harness T3 already drives: **OpenCode**.

## Why this is a config pack and not a T3 plugin

T3 Code is an agent harness control surface, not a model client. It holds no model API keys
and talks to no model API directly. Each thread runs one harness that is installed and
authenticated on your machine (`codex`, `claude`, `cursor`, `grok`, `opencode`, `pi`,
`antigravity`, or any ACP agent).

So a model provider reaches T3 only through a harness that supports it. OpenRouter,
DeepSeek and NVIDIA NIM are all OpenAI-compatible endpoints, and OpenCode already runs
arbitrary compatible providers from its config. This pack writes those providers into your
global OpenCode config. T3 then lists them through its existing **OpenCode** provider.

Nothing about T3 itself is modified, so there is no fork to maintain and it keeps working
after T3 updates.

## What it adds

| Provider ID | Endpoint | Key env var | Package |
| --- | --- | --- | --- |
| `openrouter` | `https://openrouter.ai/api/v1` | `OPENROUTER_API_KEY` | `aisdk:@ai-sdk/openai-compatible` |
| `deepseek` | `https://api.deepseek.com/v1` | `DEEPSEEK_API_KEY` | `aisdk:@ai-sdk/openai-compatible` |
| `nvidia` | `https://integrate.api.nvidia.com/v1` | `NVIDIA_API_KEY` | `aisdk:@ai-sdk/openai-compatible` |

Written to `~/.config/opencode/opencode.jsonc` as OpenCode **V2** provider entries
(`providers` + `package` + `env` + `settings.baseURL`). On V1 configs the keys were
`provider` + `npm` + `options`; this pack targets V2 (verified against OpenCode v2.0.27).

## Install

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1
```

The script backs up your config (`opencode.jsonc.bak.<timestamp>`), merges in any missing
provider, and leaves the rest of the file byte-for-byte. Preview without writing:

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1 -DryRun
```

Manual path, if you prefer: `node scripts/merge-config.mjs --print` prints the fragment to
paste under your top-level `"providers"` key. `scripts/selftest.mjs` exercises the merge
logic (6 cases: comments, existing providers, trailing commas, CRLF, idempotency).

## Set the keys

Keys are read from the environment, never stored in the config:

```powershell
setx OPENROUTER_API_KEY "..."
setx DEEPSEEK_API_KEY   "..."
setx NVIDIA_API_KEY     "..."
```

Use the same environment T3 Code runs in, then restart T3. Check without exposing values:

```powershell
powershell -ExecutionPolicy Bypass -File verify.ps1
```

## Use it from T3

1. Settings -> Providers -> add or open an **OpenCode** instance. Set the OpenCode binary
   path if T3 cannot find it.
2. Pick a model in the composer. T3 lists whatever OpenCode reports.

## If a provider shows no models

OpenRouter, DeepSeek and NVIDIA NIM are catalog providers in OpenCode, so their model lists
usually appear automatically. If one does not, add IDs explicitly. Fetch the current ones:

```powershell
powershell -ExecutionPolicy Bypass -File list-models.ps1 -Provider nvidia
```

Then add them under that provider's `"models"` key:

```jsonc
"nvidia": {
  "package": "aisdk:@ai-sdk/openai-compatible",
  "env": ["NVIDIA_API_KEY"],
  "settings": { "baseURL": "https://integrate.api.nvidia.com/v1" },
  "models": {
    "some/current-model-id": { "name": "Some Model" }
  }
}
```

This matters most for NVIDIA NIM, whose catalog IDs churn often (for example
`deepseek-ai/deepseek-r1` reached end of life in January 2026). That is why this pack ships
no hardcoded NIM model IDs and gives you the fetch script instead.

## Using the keys outside OpenCode

The three keys and endpoints are harness-agnostic. Any harness that accepts an
OpenAI-compatible provider can use them:

- **Pi**: point a custom provider at the same `baseURL` with the same env var.
- **Any ACP agent**: Settings -> Providers -> Add provider -> **Local ACP command**, then add
  the agent's own provider config or environment. T3 passes instance environment through.

T3 also injects its orchestration MCP server into whatever harness runs, so these models get
T3's delegation tools without any extra wiring.

## Notes

- Verified on OpenCode **v2.0.27**: `opencode models` already lists built-in `deepseek` and
  `nvidia` catalog entries, so for those two a key alone may be enough. This pack makes all
  three explicit and deterministic (pinned endpoint, package and env var) and adds
  `openrouter`; it does not depend on the catalog either way.
- T3 auth pages, OAuth and sign-in belong to each harness. OpenCode's own `/connect` OAuth
  providers (GitHub Copilot device flow, Anthropic, and so on) already work in T3 through the
  OpenCode provider; this pack is for API-key providers that OpenCode does not ship a login
  for.
- `deepseek-chat` and `deepseek-reasoner` were retired on 2026-07-24. Current DeepSeek API
  model names come from `https://api-docs.deepseek.com`; list them with `list-models.ps1`.

## License

MIT. See [LICENSE](LICENSE).
