import { z } from "zod";

export const createJobSchema = z.object({
  companyId: z.string().min(1).optional(),
  companyName: z.string().min(1).max(160),
  roleTitle: z.string().min(1).max(180),
  location: z.string().max(180).optional(),
  description: z.string().min(1).max(80_000),
  recruiterNotes: z.string().max(5000).optional()
}).strict();
