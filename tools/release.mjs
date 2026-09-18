/**
 * Cut a release of Atlas Character Sync.
 *
 *   node tools/release.mjs patch     0.1.0 -> 0.1.1
 *   node tools/release.mjs minor     0.1.0 -> 0.2.0
 *   node tools/release.mjs major     0.1.0 -> 1.0.0
 *   node tools/release.mjs 0.4.2     set an explicit version
 *
 * It bumps module.json's `version`, re-points `download`/`manifest` at the new tag,
 * then runs the build to produce module.zip. It does NOT git commit/tag/push — that
 * stays in your hands (or GitHub Actions once the module has its own public repo).
 */

import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = join(ROOT, "module.json");

function bump(version, kind) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!m) throw new Error(`current version "${version}" is not semver x.y.z`);
  let [major, minor, patch] = m.slice(1).map(Number);
  if (kind === "major") return `${major + 1}.0.0`;
  if (kind === "minor") return `${major}.${minor + 1}.0`;
  if (kind === "patch") return `${major}.${minor}.${patch + 1}`;
  throw new Error(`unknown bump "${kind}" (use patch|minor|major or an explicit x.y.z)`);
}

const arg = process.argv[2];
if (!arg) {
  console.error("usage: node tools/release.mjs <patch|minor|major|x.y.z>");
  process.exit(1);
}

const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
const next = /^\d+\.\d+\.\d+$/.test(arg) ? arg : bump(manifest.version, arg);

// The `latest` download URL means it never changes per release; the per-tag form below
// is more explicit and lets old installs pin a version. We keep the repo coordinates and
// rewrite the version segment so both styles stay correct.
const repo = "JDR-Ninja/jdr-ninja-atlas-sync";
manifest.version = next;
manifest.manifest = `https://github.com/${repo}/releases/latest/download/module.json`;
manifest.download = `https://github.com/${repo}/releases/download/v${next}/module.zip`;

await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(`✓ module.json -> v${next}`);

execFileSync(process.execPath, [join(ROOT, "tools", "build.mjs")], { stdio: "inherit" });

console.log("");
console.log("Next steps:");
console.log(`  git add module.json && git commit -m "release: v${next}"`);
console.log(`  git tag v${next} && git push --follow-tags`);
console.log(`  → create a GitHub release for tag v${next}, attach module.json + module.zip`);
