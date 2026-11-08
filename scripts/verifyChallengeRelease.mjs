import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hash = async file => createHash("sha256").update(await fs.readFile(path.join(root, file))).digest("hex");
const manifestFile = "release/gate-v1-reviewed-manifest.json";
const reviewedHash = "029ed24fe934b28051e072f1f873ce58d3e604a37f628de0c43d8d5ae15dac43";
if (await hash(manifestFile) !== reviewedHash) throw new Error("Challenge review manifest changed.");
const manifest = JSON.parse(await fs.readFile(path.join(root, manifestFile), "utf8"));
const forbidden = [
  /[A-Z]:[\\/]+Users[\\/]/i,
  /["'`]\/api\//i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /(?:ghp_|github_pat_|sk-proj-)[a-zA-Z0-9_]{20,}/,
];

for (const [group, base] of [["source", "challenge-source"], ["site", "docs/challenge"]]) {
  const expected = manifest.files[group].map(entry => `${base}/${entry.path}`).sort();
  const tracked = execFileSync("git", ["ls-files", "-z", "--", base], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean).sort();
  if (JSON.stringify(tracked) !== JSON.stringify(expected)) throw new Error(`Unexpected tracked inventory: ${base}`);
  for (const entry of manifest.files[group]) {
    const relative = `${base}/${entry.path}`;
    if (!(await fs.lstat(path.join(root, relative))).isFile()) throw new Error(`Not a regular file: ${relative}`);
    if (await hash(relative) !== entry.sha256) throw new Error(`Reviewed file changed: ${relative}`);
    const text = await fs.readFile(path.join(root, relative), "utf8");
    if (forbidden.some(pattern => pattern.test(text))) throw new Error(`Boundary scan failed: ${relative}`);
    if (group === "site" && await hash(`challenge-source/dist/gate-challenge/${entry.path}`) !== entry.sha256) throw new Error(`Rebuilt challenge changed: ${entry.path}`);
  }
}

for (const name of ["LICENSE", "NOTICE", "COMMERCIAL-LICENSE"]) {
  for (const file of [`challenge-source/${name}.md`, `docs/challenge/${name}.txt`]) {
    if (await hash(`${name}.md`) !== await hash(file)) throw new Error(`Company notice changed: ${file}`);
  }
}
if (await hash("THIRD-PARTY-NOTICES.txt") !== await hash("challenge-source/THIRD-PARTY-NOTICES.txt")) throw new Error("Dependency notices changed.");
console.log("Reviewed challenge inventory, source, hosted files, rebuilt assets and notices match.");
