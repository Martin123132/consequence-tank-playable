import { mergeConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import publicConfig from "./vite.public.config";

const root = path.dirname(fileURLToPath(import.meta.url));
export default mergeConfig(publicConfig, {
  root: path.join(root, "challenge"),
  cacheDir: path.join(root, ".tmp/gate-challenge/vite"),
  build: { outDir: path.join(root, "dist/gate-challenge") },
  server: { port: 5182 },
  preview: { port: 4182 },
  test: { include: ["src/challenge/*.test.ts"] },
});
