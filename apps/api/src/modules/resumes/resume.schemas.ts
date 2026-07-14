import { z } from "zod";

export const upsertResumeSchema = z.object({
  markdown: z.string().max(80_000),
  filename: z.string().max(180).optional()
}).strict();
