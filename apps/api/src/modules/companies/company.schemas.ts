import { z } from "zod";

export const createCompanySchema = z.object({
  name: z.string().min(1).max(160),
  website: z.string().url().max(300).optional().or(z.literal("")),
  notes: z.string().max(2000).optional()
}).strict();
