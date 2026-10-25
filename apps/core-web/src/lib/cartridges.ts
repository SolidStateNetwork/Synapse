import fs from "fs";
import path from "path";

export interface CartridgeMeta {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
}

function resolveCartridgesDir(): string {
  const candidates = [
    process.env.SYNAPSE_CARTRIDGES_DIR || "",
    path.resolve(process.cwd(), "../../cartridges"),
    path.resolve(process.cwd(), "cartridges"),
    "/app/cartridges",
  ].filter(Boolean);

  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      return dir;
    }
  }
  return path.resolve(process.cwd(), "../../cartridges");
}

export function listCartridges(): CartridgeMeta[] {
  const dir = resolveCartridgesDir();
  if (!fs.existsSync(dir)) {
    return [];
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  const result: CartridgeMeta[] = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), "utf8");
    const id = file.replace(/\.md$/, "");
    let name = id;
    let description = "Modular Synapse Rule Cartridge";
    let category = "general";

    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    let body = raw;
    if (fmMatch) {
      const fm = fmMatch[1];
      body = fmMatch[2].trim();
      for (const line of fm.split("\n")) {
        const [k, ...rest] = line.split(":");
        const val = rest.join(":").trim();
        if (k?.trim() === "name" && val) name = val;
        if (k?.trim() === "description" && val) description = val;
        if (k?.trim() === "category" && val) category = val;
      }
    }

    result.push({
      id,
      name,
      description,
      category,
      content: body,
    });
  }
  return result;
}
