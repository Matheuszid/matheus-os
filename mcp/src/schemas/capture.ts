import { z } from 'zod';

export const addCaptureInput = z.object({ text: z.string().trim().min(1).max(500) }).strict();
