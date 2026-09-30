import { z } from 'zod';
import { projectIdSchema, stageSchema } from './common.js';

export const listProjectsInput = z.object({
  area: z.string().trim().min(1).max(80).optional(),
  stage: stageSchema.optional(),
  status: z.enum(['active', 'completed']).optional()
}).strict();

export const getProjectInput = z.object({
  projectId: projectIdSchema.optional(),
  name: z.string().trim().min(1).max(120).optional()
}).refine((value) => Boolean(value.projectId || value.name), 'projectId or name is required').strict();