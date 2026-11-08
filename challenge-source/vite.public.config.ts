import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const dependencies = ["react", "react-dom", "lucide-react", "pathfinding", "heap", "scheduler", "loose-envify", "js-tokens"];

export default defineConfig({
  root: path.join(root, "playground"),
  base: "./",
  publicDir: false,
  plugins: [react(), {
    name: "public-licence-notices",
    async generateBundle() {
      for (const name of ["LICENSE", "NOTICE", "COMMERCIAL-LICENSE"]) {
        this.emitFile({ type: "asset", fileName: `${name}.txt`, source: await fs.readFile(path.join(root, `${name}.md`), "utf8") });
      }
      const notices = ["Third-party dependencies retain their own licences. These are not replaced by the company licence.\n"];
      for (const name of dependencies) {
        const dir = path.join(root, "node_modules", name);
        const metadata = JSON.parse(await fs.readFile(path.join(dir, "package.json"), "utf8"));
        const source = await fs.readFile(path.join(dir, ["pathfinding", "heap"].includes(name) ? "README.md" : "LICENSE"), "utf8");
        const notice = ["pathfinding", "heap"].includes(name) ? source.slice(source.lastIndexOf("\nLicense")) : source;
        if (notice.length < 200) throw new Error(`Missing dependency notice: ${name}`);
        notices.push(`\n${name} ${metadata.version}\n${notice}`);
      }
      this.emitFile({ type: "asset", fileName: "THIRD-PARTY-NOTICES.txt", source: notices.join("\n") });
    },
  }],
  build: { outDir: path.join(root, "dist", "public-playable"), emptyOutDir: true, sourcemap: false },
  server: { host: "127.0.0.1", port: 5180, fs: { allow: [root] } },
  preview: { host: "127.0.0.1", port: 4180 },
  test: { root, include: ["src/playground/*.test.ts", "src/simulation/warehouse.test.ts", "src/simulation/controlledRevision.test.ts", "src/simulation/oracleNavigation.test.ts", "src/simulation/candidateRecovery.test.ts", "src/evaluation/modeLiveness.test.ts"], testTimeout: 60000 },
});
