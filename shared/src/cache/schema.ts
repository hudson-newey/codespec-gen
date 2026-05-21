import { z } from "zod";

export const SCHEMA_VERSION = "1";

export const ArtifactMetadataSchema = z.object({
  cacheKey: z.string(),
  promptBlockType: z.string(),
  instruction: z.string(),
  effectiveContext: z.array(z.string()),
  modelId: z.string(),
  generationOptions: z.record(z.string(), z.unknown()),
  pluginVersion: z.string(),
  schemaVersion: z.string(),
  generatedAt: z.string(),
});

export type ArtifactMetadata = z.infer<typeof ArtifactMetadataSchema>;

export const ArtifactEntrySchema = z.object({
  metadata: ArtifactMetadataSchema,
  code: z.string(),
});

export type ArtifactEntry = z.infer<typeof ArtifactEntrySchema>;

export const ArtifactManifestSchema = z.record(z.string(), z.string().optional());

/** cacheKey → artifact filename */
export type ArtifactManifest = z.infer<typeof ArtifactManifestSchema>;
