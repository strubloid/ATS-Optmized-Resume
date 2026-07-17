import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodSchema } from "zod";

export interface ApiErrorPayload {
  code?: string;
  message: string;
  path?: string;
  [key: string]: unknown;
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly payload: ApiErrorPayload;

  constructor(statusCode: number, messageOrPayload: string | ApiErrorPayload) {
    if (typeof messageOrPayload === "string") {
      super(messageOrPayload);
      this.payload = { message: messageOrPayload };
    } else {
      super(messageOrPayload.message);
      this.payload = messageOrPayload;
    }
    this.statusCode = statusCode;
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
    response.status(error.statusCode).json({ error: error.payload.message, code: error.payload.code, path: error.payload.path });
    return;
  }
  if (error instanceof ZodError) {
    response.status(400).json({ error: "Invalid request body", details: error.issues.map((issue) => issue.message) });
    return;
  }
  response.status(500).json({ error: "Internal server error" });
}
