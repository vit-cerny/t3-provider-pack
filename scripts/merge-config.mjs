#!/usr/bin/env node
// JSONC-aware splice for OpenCode config. No dependencies.
// It reads a config file that may contain comments and only rewrites the
// top-level "providers" member, leaving everything else byte-for-byte.
//
//   node scripts/merge-config.mjs --print               emit the fragment
//   node scripts/merge-config.mjs --check <config>      report presence
//   node scripts/merge-config.mjs         <config>      merge missing providers
//
// ponytail: a hand-rolled scanner (comments + strings) instead of a JSONC
// dependency, because a naive comment stripper corrupts URLs like https://.
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { providers } from "./providers.mjs";

const WS = " \t\r\n";
const isWs = (c) => WS.includes(c);

function skipTrivia(t, i) {
  for (;;) {
    while (i < t.length && isWs(t[i])) i++;
    if (t[i] === "/" && t[i + 1] === "/") {
      i += 2;
      while (i < t.length && t[i] !== "\n") i++;
      continue;
    }
    if (t[i] === "/" && t[i + 1] === "*") {
      i += 2;
      while (i < t.length && !(t[i] === "*" && t[i + 1] === "/")) i++;
      i = Math.min(i + 2, t.length);
      continue;
    }
    return i;
  }
}

function readString(t, i) {
  let out = "";
  i++;
  while (i < t.length) {
    const c = t[i];
    if (c === "\\") {
      out += t[i + 1] ?? "";
      i += 2;
      continue;
    }
    if (c === '"') return { value: out, end: i + 1 };
    out += c;
    i++;
  }
  throw new Error("unterminated string");
}

function skipValue(t, i) {
  i = skipTrivia(t, i);
  const c = t[i];
  if (c === '"') return readString(t, i).end;
  if (c === "{" || c === "[") {
    const stack = [c === "{" ? "}" : "]"];
    i++;
    while (i < t.length && stack.length) {
      const ch = t[i];
      if (ch === '"') {
        i = readString(t, i).end;
        continue;
      }
      if (ch === "/" && t[i + 1] === "/") {
        i += 2;
        while (i < t.length && t[i] !== "\n") i++;
        continue;
      }
      if (ch === "/" && t[i + 1] === "*") {
        i += 2;
        while (i < t.length && !(t[i] === "*" && t[i + 1] === "/")) i++;
        i = Math.min(i + 2, t.length);
        continue;
      }
      if (ch === "{") stack.push("}");
      else if (ch === "[") stack.push("]");
      else if (ch === "}" || ch === "]") {
        if (ch !== stack[stack.length - 1]) throw new Error("mismatched bracket");
        stack.pop();
      }
      i++;
    }
    if (stack.length) throw new Error("unbalanced value");
    return i;
  }
  while (i < t.length && !",}] \t\r\n".includes(t[i])) i++;
  return i;
}

function parseObject(t, open) {
  if (t[open] !== "{") throw new Error("expected {");
  let i = skipTrivia(t, open + 1);
  const entries = [];
  for (;;) {
    i = skipTrivia(t, i);
    if (t[i] === "}") return { open, close: i, entries };
    if (t[i] === undefined) throw new Error("unexpected end of config");
    const keyStart = i;
    const s = readString(t, i);
    i = skipTrivia(t, s.end);
    if (t[i] !== ":") throw new Error("expected : after key " + s.value);
    const valueStart = skipTrivia(t, i + 1);
    const valueEnd = skipValue(t, valueStart);
    entries.push({ key: s.value, keyStart, valueStart, valueEnd });
    i = skipTrivia(t, valueEnd);
    if (t[i] === ",") {
      i++;
      continue;
    }
    if (t[i] === "}") return { open, close: i, entries };
    throw new Error("expected , or }");
  }
}

function lineIndent(t, idx) {
  let j = idx;
  while (j > 0 && (t[j - 1] === " " || t[j - 1] === "\t")) j--;
  const atStart = j === 0 || t[j - 1] === "\n";
  return { indent: atStart ? t.slice(j, idx) : "", atStart };
}

function eol(t) {
  return t.includes("\r\n") ? "\r\n" : "\n";
}

// Returns the provider member lines (no outer braces). `memberIndent` is the
// absolute indentation of each top-level provider key.
function serializeProviders(ids, nl, memberIndent) {
  const picked = {};
  for (const id of ids) picked[id] = providers[id];
  const lines = JSON.stringify(picked, null, 2).split("\n").slice(1, -1);
  return lines.map((line) => memberIndent + line.slice(2)).join(nl);
}

// Insert `block` after a member's value, adding a separating comma only when the
// file does not already have one. Everything after the member (comments, the
// closing brace) is left untouched.
function insertAfterMember(text, member, block, nl) {
  const next = skipTrivia(text, member.valueEnd);
  const hasComma = text[next] === ",";
  const at = hasComma ? next + 1 : member.valueEnd;
  return text.slice(0, at) + (hasComma ? "" : ",") + nl + block + text.slice(at);
}

function mergeConfig(text, nl) {
  const root = parseObject(text, skipTrivia(text, 0));
  const rootIndent = lineIndent(text, root.close).indent;
  const provMember = root.entries.find((e) => e.key === "providers");
  const ids = Object.keys(providers);

  if (!provMember) {
    const entryIndent =
      (root.entries[0] && lineIndent(text, root.entries[0].keyStart).indent) ||
      rootIndent + "  ";
    const block =
      entryIndent +
      JSON.stringify("providers") +
      ": {" +
      nl +
      serializeProviders(ids, nl, entryIndent + "  ") +
      nl +
      entryIndent +
      "}";
    if (!root.entries.length) {
      return {
        text: text.slice(0, root.open + 1) + nl + block + nl + rootIndent + text.slice(root.close),
        added: ids,
      };
    }
    return {
      text: insertAfterMember(text, root.entries[root.entries.length - 1], block, nl),
      added: ids,
    };
  }

  const obj = parseObject(text, skipTrivia(text, provMember.valueStart));
  const existing = new Set(obj.entries.map((e) => e.key));
  const missing = ids.filter((id) => !existing.has(id));
  if (!missing.length) return { text, added: [] };

  const objIndent = lineIndent(text, obj.close).indent;
  const entryIndent =
    (obj.entries[0] && lineIndent(text, obj.entries[0].keyStart).indent) ||
    objIndent + "  ";
  const block = serializeProviders(missing, nl, entryIndent);

  if (!obj.entries.length) {
    return {
      text: text.slice(0, obj.open + 1) + nl + block + nl + objIndent + text.slice(obj.close),
      added: missing,
    };
  }
  return {
    text: insertAfterMember(text, obj.entries[obj.entries.length - 1], block, nl),
    added: missing,
  };
}

function load(path) {
  return readFileSync(path, "utf8").replace(/^\uFEFF/, "");
}

export { mergeConfig };

function main(argv) {
  const mode = argv[0] || "";

  if (mode === "--print") {
  const nl = "\n";
  process.stdout.write(
    "// T3 provider pack - OpenCode V2 providers." + nl +
      "// Merge this object into the top-level \"providers\" key of your" + nl +
      "// ~/.config/opencode/opencode.jsonc (see README for the one-command path)." + nl +
      "{" + nl +
      "  \"providers\": {" + nl +
      serializeProviders(Object.keys(providers), nl, "    ") + nl +
      "  }" + nl +
      "}" + nl,
  );
  process.exit(0);
}

  if (mode === "--check") {
    const path = argv[1];
    if (!path) throw new Error("--check needs a config path");
    const text = load(path);
    const root = parseObject(text, skipTrivia(text, 0));
    const provMember = root.entries.find((e) => e.key === "providers");
    const present = new Set();
    if (provMember) {
      const obj = parseObject(text, skipTrivia(text, provMember.valueStart));
      for (const e of obj.entries) present.add(e.key);
    }
    const wanted = Object.keys(providers);
    for (const id of wanted) {
      process.stdout.write((present.has(id) ? "present  " : "MISSING  ") + id + "\n");
    }
    process.exit(wanted.every((id) => present.has(id)) ? 0 : 1);
  }

  const path = mode;
  if (!path) {
    process.stderr.write("usage: merge-config.mjs --print | --check <config> | <config>\n");
    process.exit(2);
  }
  const text = load(path);
  const result = mergeConfig(text, eol(text));
  if (!result.added.length) {
    process.stdout.write("no change: all providers already present\n");
    process.exit(0);
  }
  writeFileSync(path, result.text, "utf8");
  process.stdout.write("added: " + result.added.join(", ") + "\n");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
