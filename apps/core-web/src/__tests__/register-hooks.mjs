import { registerHooks } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(srcRoot, "../..");

function tryResolveTsFile(candidatePath) {
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const full = `${candidatePath}${ext}`;
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      return pathToFileURL(full).href;
    }
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/server") {
      return nextResolve("next/server.js", context);
    }
    if (specifier.startsWith("@/")) {
      const target = path.join(srcRoot, specifier.slice(2));
      const resolved = tryResolveTsFile(target);
      if (resolved) {
        return { url: resolved, shortCircuit: true };
      }
    }
    if (specifier.startsWith("@proto/")) {
      const target = path.join(repoRoot, "proto", specifier.slice(7));
      const resolved = tryResolveTsFile(target);
      if (resolved) {
        return { url: resolved, shortCircuit: true };
      }
    }
    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL?.startsWith("file:")
    ) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      const target = path.resolve(parentDir, specifier);
      const resolved = tryResolveTsFile(target);
      if (resolved) {
        return { url: resolved, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
});
