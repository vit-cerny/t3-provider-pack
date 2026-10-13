// Single source of truth for the providers this pack adds to OpenCode V2.
// Consumed by merge-config.mjs and install.ps1. Keep ASCII only.
//
// Shape is OpenCode V2 "providers" (see opencode.ai docs, migrate-v1):
//   providers.<id>.name / .package / .env / .settings.baseURL / .models
// V1 used: "provider" + "npm" + "options"; V2 renamed and moved settings.
//
// Every entry here is an OpenAI-compatible endpoint, so one runtime package
// (aisdk:@ai-sdk/openai-compatible) covers all three.

export const providers = {
  openrouter: {
    name: "OpenRouter",
    package: "aisdk:@ai-sdk/openai-compatible",
    env: ["OPENROUTER_API_KEY"],
    settings: {
      baseURL: "https://openrouter.ai/api/v1",
    },
  },
  deepseek: {
    name: "DeepSeek API",
    package: "aisdk:@ai-sdk/openai-compatible",
    env: ["DEEPSEEK_API_KEY"],
    settings: {
      baseURL: "https://api.deepseek.com/v1",
    },
  },
  nvidia: {
    name: "NVIDIA NIM",
    package: "aisdk:@ai-sdk/openai-compatible",
    env: ["NVIDIA_API_KEY"],
    settings: {
      baseURL: "https://integrate.api.nvidia.com/v1",
    },
  },
};

// Env var each provider reads its credential from (used by verify.ps1).
export const providerEnvVars = Object.fromEntries(
  Object.entries(providers).map(([id, p]) => [id, p.env?.[0] ?? ""]),
);
