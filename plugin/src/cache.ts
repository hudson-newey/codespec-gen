import { readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import * as path from "node:path";
import writeFileAtomic from "write-file-atomic";
import type {
  ArtifactMetadata,
  ArtifactManifest,
  ArtifactEntry,
} from "@codespec/shared";
import {
  ArtifactManifestSchema,
  ArtifactEntrySchema,
  SCHEMA_VERSION,
} from "@codespec/shared";

const MANIFEST_FILE = "manifest.json";
const PLUGIN_VERSION = "0.1.0";

export class CacheManager {
  private cacheDir: string;
  private manifest: ArtifactManifest | null = null;
  private initialized = false;

  constructor(cacheDir: string) {
    this.cacheDir = path.resolve(cacheDir);
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    await mkdir(this.cacheDir, { recursive: true });
    this.manifest = await this.loadManifest();
    this.initialized = true;
  }

  /** Look up a cached generated code string by cache key. Returns null on miss. */
  async get(cacheKey: string): Promise<string | null> {
    await this.init();
    const filename = this.manifest?.[cacheKey];
    if (!filename) return null;

    const filePath = path.join(this.cacheDir, filename);
    if (!existsSync(filePath)) {
      // Manifest points to a missing file — treat as cache miss
      delete this.manifest![cacheKey];
      return null;
    }

    try {
      const raw = await readFile(filePath, "utf-8");
      const entry = ArtifactEntrySchema.safeParse(JSON.parse(raw));
      if (!entry.success) {
        // Corrupted entry — treat as miss
        delete this.manifest![cacheKey];
        return null;
      }
      return entry.data.code;
    } catch {
      return null;
    }
  }

  /** Persist a generated code artifact for a given cache key. Writes atomically. */
  async set(
    cacheKey: string,
    code: string,
    metadata: Omit<ArtifactMetadata, "pluginVersion" | "schemaVersion" | "generatedAt">,
  ): Promise<void> {
    await this.init();

    const filename = safeFilename(cacheKey, metadata.promptBlockType);
    const filePath = path.join(this.cacheDir, filename);

    const entry: ArtifactEntry = {
      code,
      metadata: {
        ...metadata,
        pluginVersion: PLUGIN_VERSION,
        schemaVersion: SCHEMA_VERSION,
        generatedAt: new Date().toISOString(),
      },
    };

    await writeFileAtomic(filePath, JSON.stringify(entry, null, 2) + "\n");

    this.manifest![cacheKey] = filename;
    await this.saveManifest(this.manifest!);
  }

  /** Remove all artifacts and reset the manifest. */
  async clear(): Promise<void> {
    await this.init();
    const entries = Object.values(this.manifest ?? {});
    await Promise.allSettled(
      entries.map(async (filename) => {
        const filePath = path.join(this.cacheDir, filename);
        if (existsSync(filePath)) {
          const { unlink } = await import("node:fs/promises");
          await unlink(filePath);
        }
      }),
    );
    this.manifest = {};
    await this.saveManifest({});
  }

  private async loadManifest(): Promise<ArtifactManifest> {
    const manifestPath = path.join(this.cacheDir, MANIFEST_FILE);
    if (!existsSync(manifestPath)) return {};
    try {
      const raw = await readFile(manifestPath, "utf-8");
      const parsed = ArtifactManifestSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : {};
    } catch {
      return {};
    }
  }

  private async saveManifest(manifest: ArtifactManifest): Promise<void> {
    const manifestPath = path.join(this.cacheDir, MANIFEST_FILE);
    await writeFileAtomic(
      manifestPath,
      JSON.stringify(manifest, null, 2) + "\n",
    );
  }
}

/** Generate a deterministic, filesystem-safe artifact filename */
function safeFilename(cacheKey: string, promptBlockType: string): string {
  const safeType = promptBlockType.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${cacheKey.slice(0, 16)}-${safeType}.json`;
}
