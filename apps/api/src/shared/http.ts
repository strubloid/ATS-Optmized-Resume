import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodSchema } from "zod";

export class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export function asyncHandler(handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown> | unknown) {
  return (request: Request, response: Response, next: NextFunction) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

export function parseBody<T>(schema: ZodSchema<T>, body: unknown): T {
  return schema.parse(body);
}

export function errorHandler(error: unknown, _request: Request, response: Response, _next: NextFunction) {
  if (error instanceof ApiError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }
  if (error instanceof ZodError) {
    response.status(400).json({ error: "Invalid request body", details: error.issues.map((issue) => issue.message) });
    return;
  }
  response.status(500).json({ error: "Internal server error" });
}
