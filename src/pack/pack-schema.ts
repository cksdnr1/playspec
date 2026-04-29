import { z } from 'zod';

export const PACK_MANIFEST_FILE = 'playspec-pack.yaml';

export const PackIdSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9._-]*$/, 'Pack id must be slug-safe.');

export const PackVariableDefinitionSchema = z.object({
  default: z.string().optional(),
  description: z.string().optional(),
  required: z.boolean().optional(),
});

export const PackWorkflowEntrySchema = z.object({
  path: z.string().min(1),
  variables: z.record(z.string(), PackVariableDefinitionSchema).optional(),
});

export const PackRootSchema = z.object({
  root: z.string().min(1).optional(),
});

export const PackManifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: PackIdSchema,
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  variables: z.record(z.string(), PackVariableDefinitionSchema).optional(),
  workflows: z
    .record(z.string(), PackWorkflowEntrySchema)
    .refine((value) => Object.keys(value).length > 0, 'At least one workflow is required.'),
  templates: PackRootSchema.optional(),
  rules: PackRootSchema.optional(),
});

export type PackVariableDefinition = z.infer<typeof PackVariableDefinitionSchema>;
export type PackWorkflowEntry = z.infer<typeof PackWorkflowEntrySchema>;
export type PackManifest = z.infer<typeof PackManifestSchema>;
