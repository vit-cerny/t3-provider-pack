#!/usr/bin/env node
// One runnable check for the config splicer:  node scripts/selftest.mjs
// Verifies comments/URLs survive, existing keys are untouched, JSON stays
// valid, and a second run is a no-op.
import assert from "node:assert/strict";
import { mergeConfig } from "./merge-config.mjs";
import { providers } from "./providers.mjs";

// Test-only comment stripper (string aware) so we can JSON.parse the result.
function stripJsonc(text) {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      out += c;
      i++;
      while (i < text.length) {
        out += text[i];
        if (text[i] === "\\") {
          out += text[i + 1] ?? "";
          i += 2;
          continue;
        }
        if (text[i] === '"') break;
        i++;
      }
      continue;
    }
    if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i += 1;
      continue;
    }
    if (c === ",") {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (text[j] === "}" || text[j] === "]") continue; // JSONC trailing comma
    }
    out += c;
  }
  return out;
}

const parse = (text) => JSON.parse(stripJsonc(text));

// 1) No "providers" key, comments and a URL containing // that must survive.
const a = `{
  // my global config
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4-5", /* keep this */
  "theme": "tokyonight"
}
`;
const a1 = mergeConfig(a, "\n");
assert.deepEqual(a1.added.sort(), Object.keys(providers).sort());
const aParsed = parse(a1.text);
assert.equal(aParsed.model, "anthropic/claude-sonnet-4-5");
assert.equal(aParsed.theme, "tokyonight");
assert.equal(aParsed.$schema, "https://opencode.ai/config.json");
assert.ok(a1.text.includes("// my global config"), "line comment kept");
assert.ok(a1.text.includes("/* keep this */"), "block comment kept");
for (const id of Object.keys(providers)) assert.ok(aParsed.providers[id], `added ${id}`);

// 2) Existing "providers" object: keep the old one, add the new ones.
const b = `{
  "providers": {
    "vercel": { "name": "Vercel AI Gateway" }
  }
}
`;
const b1 = mergeConfig(b, "\n");
const bParsed = parse(b1.text);
assert.ok(bParsed.providers.vercel, "existing provider kept");
for (const id of Object.keys(providers)) assert.ok(bParsed.providers[id], `added ${id}`);
assert.deepEqual(Object.keys(bParsed.providers), ["vercel", ...Object.keys(providers)]);

// 3) Second run is a no-op.
const again = mergeConfig(b1.text, "\n");
assert.deepEqual(again.added, []);
assert.equal(again.text, b1.text);

// 4) Empty object config.
const c = mergeConfig("{}", "\n");
const cParsed = parse(c.text);
for (const id of Object.keys(providers)) assert.ok(cParsed.providers[id], `added ${id}`);

// 5) Trailing commas already present, and a comment before the closing brace.
const d = `{
  "providers": {
    "vercel": { "name": "Vercel AI Gateway" }, // keep me
  },
  "theme": "dark",
}
`;
const d1 = mergeConfig(d, "\n");
const dParsed = parse(d1.text);
assert.ok(dParsed.providers.vercel);
assert.equal(dParsed.theme, "dark");
assert.ok(d1.text.includes("// keep me"), "comment inside providers kept");
for (const id of Object.keys(providers)) assert.ok(dParsed.providers[id], `added ${id}`);

// 6) CRLF config stays parseable.
const e = '{\r\n  "theme": "dark"\r\n}\r\n';
const eParsed = parse(mergeConfig(e, "\r\n").text);
assert.equal(eParsed.theme, "dark");
for (const id of Object.keys(providers)) assert.ok(eParsed.providers[id], `added ${id}`);

// 7) Root-level trailing comment kept when adding the providers key.
const f = `{
  "theme": "dark" // root note
}
`;
const f1 = mergeConfig(f, "\n");
assert.ok(f1.text.includes("// root note"), "root trailing comment kept");
const fParsed = parse(f1.text);
assert.equal(fParsed.theme, "dark");
for (const id of Object.keys(providers)) assert.ok(fParsed.providers[id], `added ${id}`);

console.log("selftest: ok (7 cases)");
