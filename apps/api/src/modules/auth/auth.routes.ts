import { Router } from "express";
import type { AppStore } from "../../shared/store";
import { asyncHandler, parseBody } from "../../shared/http";
import { requireAuth, type AuthenticatedRequest } from "../../shared/authMiddleware";
import { buildGoogleOAuthUrl, loginUser, loginWithGoogleCallback, logout, registerUser } from "./auth.service";
import { googleCallbackSchema, loginSchema, registerSchema } from "./auth.schemas";
import { loginRateLimit, registrationRateLimit } from "./auth.rateLimit";

export function createAuthRouter(store: AppStore): Router {
  const router = Router();

  router.post("/register", registrationRateLimit, asyncHandler(async (request, response) => {
    const body = parseBody(registerSchema, request.body);
    response.status(201).json(await registerUser(store, body.email, body.password, body.nickname));
  }));

  router.post("/login", loginRateLimit, asyncHandler(async (request, response) => {
    const body = parseBody(loginSchema, request.body);
    response.json(await loginUser(store, body.username, body.password));
  }));

  router.post("/logout", requireAuth(store), asyncHandler(async (request, response) => {
    const header = request.header("authorization") ?? "";
    logout(store, header.replace(/^Bearer\s+/, ""));
    response.status(204).send();
  }));

  router.get("/google/start", asyncHandler(async (_request, response) => {
    response.json(buildGoogleOAuthUrl(store));
  }));

  router.post("/google/callback", asyncHandler(async (request, response) => {
    const body = parseBody(googleCallbackSchema, request.body);
    if (body.issuer && body.issuer !== "accounts.google.com") response.status(400).json({ error: "Invalid OAuth issuer" });
    else response.json(await loginWithGoogleCallback(store, body.state, { email: body.email, code: body.code }));
  }));

  router.get("/google/callback", asyncHandler(async (request, response) => {
    const state = String(request.query.state ?? "");
    const code = String(request.query.code ?? "");
    const auth = await loginWithGoogleCallback(store, state, { code });
    const redirect = new URL(process.env.GOOGLE_OAUTH_SUCCESS_REDIRECT ?? process.env.WEB_ORIGIN ?? "http://127.0.0.1:6688");
    redirect.searchParams.set("token", auth.token);
    response.redirect(redirect.toString());
  }));

  router.get("/me", requireAuth(store), asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user;
    response.json({ user: { id: user.id, username: user.username, createdAt: user.createdAt } });
  }));

  return router;
}
