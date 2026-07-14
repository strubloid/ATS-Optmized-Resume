import type { NextFunction, Request, Response } from "express";
import type { AppStore, UserRecord } from "./store";
import { ApiError } from "./http";

export interface AuthenticatedRequest extends Request {
  user: UserRecord;
}

export function requireAuth(store: AppStore) {
  return (request: Request, _response: Response, next: NextFunction) => {
    const header = request.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
    const session = token ? store.sessions.get(token) : undefined;
    if (!session || !session.active || Date.now() > Date.parse(session.expiresAt)) {
      next(new ApiError(401, "Authentication required"));
      return;
    }
    const user = store.users.get(session.userId);
    if (!user) {
      next(new ApiError(401, "Authentication required"));
      return;
    }
    (request as AuthenticatedRequest).user = user;
    next();
  };
}
