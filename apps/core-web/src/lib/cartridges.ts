import fs from "fs";
import path from "path";

export interface CartridgeMeta {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
}

export interface StackBlueprint {
  id: string;
  name: string;
  category: "Full-Stack" | "Database & Cache" | "Automation & AI" | "Monitoring";
  description: string;
  defaultPort: number;
  recommendedCartridges: string[];
  promptCommand: string;
}

export const OFFICIAL_STACK_BLUEPRINTS: StackBlueprint[] = [
  {
    id: "bp-node-microservice",
    name: "Node.js Zero-Trust API Service",
    category: "Full-Stack",
    description:
      "Provisions a production-ready HTTP JSON microservice bound to 127.0.0.1:4050 with automated health probes, rollback snapshot, and Live-Preview tunnel.",
    defaultPort: 4050,
    recommendedCartridges: ["zero-trust-networking"],
    promptCommand: "deploy microservice 4050",
  },
  {
    id: "bp-postgres-redis",
    name: "PostgreSQL 16 + Redis Cache Stack",
    category: "Database & Cache",
    description:
      "Generates a 32-char AES-256-GCM DB secret in Secrets.enc, provisions a Docker Compose Postgres + Redis stack on 127.0.0.1, and registers TCP health checks.",
    defaultPort: 5432,
    recommendedCartridges: ["docker-first", "zero-trust-networking"],
    promptCommand:
      "deploy blueprint postgres-redis: generate secret DB_PASSWORD, write docker-compose.yml for PostgreSQL 16 and Redis on 127.0.0.1:5432, and register health check",
  },
  {
    id: "bp-n8n-automation",
    name: "n8n Workflow Automation Hub",
    category: "Automation & AI",
    description:
      "Deploys a self-hosted n8n workflow automation server on 127.0.0.1:5678 and exposes it through the Yamux Stream 3 Live-Preview proxy.",
    defaultPort: 5678,
    recommendedCartridges: ["docker-first", "zero-trust-networking"],
    promptCommand: "deploy microservice 5678",
  },
  {
    id: "bp-uptime-status",
    name: "Status & Telemetry Dashboard",
    category: "Monitoring",
    description:
      "Deploys a real-time service status & metrics endpoint on 127.0.0.1:4080 with Proactive Auto-Watchdog self-healing enabled.",
    defaultPort: 4080,
    recommendedCartridges: ["native-systemd", "zero-trust-networking"],
    promptCommand: "deploy microservice 4080",
  },
];

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
  const fallback = path.resolve(process.cwd(), "../../cartridges");
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
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

    const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    let body = raw;
    if (fmMatch) {
      const fm = fmMatch[1];
      body = fmMatch[2].trim();
      for (const line of fm.split(/\r?\n/)) {
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

export function saveCustomCartridge(input: {
  id?: string;
  name: string;
  description: string;
  category?: string;
  content: string;
}): CartridgeMeta {
  const dir = resolveCartridgesDir();
  fs.mkdirSync(dir, { recursive: true });

  const slug = (input.id || input.name)
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const safeId = slug || `custom-rule-${Date.now()}`;
  const category = (input.category || "custom").trim();
  const bodyContent = input.content.trim().startsWith("#")
    ? input.content.trim()
    : `# ${input.name.trim()}\n\n${input.content.trim()}`;

  const rawMd = `---
name: ${input.name.trim()}
description: ${input.description.trim() || "Custom DevOps Rule Cartridge"}
category: ${category}
---

${bodyContent}
`;

  fs.writeFileSync(path.join(dir, `${safeId}.md`), rawMd, "utf8");
  return {
    id: safeId,
    name: input.name.trim(),
    description: input.description.trim() || "Custom DevOps Rule Cartridge",
    category,
    content: bodyContent,
  };
}

export function deleteCustomCartridge(cartridgeId: string): boolean {
  const builtIns = new Set([
    "docker-first",
    "zero-trust-networking",
    "native-systemd",
    "auto-ssl-caddy",
  ]);
  if (builtIns.has(cartridgeId)) {
    return false;
  }
  const dir = resolveCartridgesDir();
  const target = path.join(dir, `${ path.basename(cartridgeId) }.md`);
  if (fs.existsSync(target)) {
    fs.unlinkSync(target);
    return true;
  }
  return false;
}
