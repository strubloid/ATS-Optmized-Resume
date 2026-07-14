import { z } from "zod";

const usernameSchema = z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9_.@-]+$/);

export const registerSchema = z.object({
  nickname: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  confirmEmail: z.string().trim().email().max(254),
  password: z.string().min(12, "Password must be at least 12 characters").max(200)
  ,confirmPassword: z.string().min(1).max(200)
}).strict().superRefine((value, context) => {
  if (value.email.toLowerCase() !== value.confirmEmail.toLowerCase()) context.addIssue({ code: z.ZodIssueCode.custom, path: ["confirmEmail"], message: "Email addresses must match" });
  if (value.password !== value.confirmPassword) context.addIssue({ code: z.ZodIssueCode.custom, path: ["confirmPassword"], message: "Passwords must match" });
});

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1).max(200)
}).strict();

export const googleCallbackSchema = z.object({
  state: z.string().min(16),
  email: z.string().email().optional(),
  issuer: z.literal("accounts.google.com").optional(),
  code: z.string().min(8).optional()
}).strict();
