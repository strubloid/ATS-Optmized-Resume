import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { ApiError } from "../../shared/http";
import { createId } from "../../shared/ids";
import type { AppStore, UserRecord } from "../../shared/store";

const LOCK_AFTER_ATTEMPTS = 5;
const LOCK_FOR_MS = 60_000;

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function publicUser(user: UserRecord) {
  return { id: user.id, nickname: user.nickname ?? user.username.split("@")[0], username: user.username, createdAt: user.createdAt };
}

export async function registerUser(store: AppStore, username: string, password: string, nickname = username.split("@")[0] ?? username) {
  const normalized = normalizeUsername(username);
  if (store.usernameIndex.has(normalized)) throw new ApiError(409, "Username already exists");
  const now = new Date().toISOString();
  const user: UserRecord = {
    id: createId("user"),
    nickname,
    username: normalized,
    passwordHash: await bcrypt.hash(password, 12),
    createdAt: now
  };
  store.users.set(user.id, user);
  store.usernameIndex.set(normalized, user.id);
  return { user: publicUser(user), token: createSession(store, user.id) };
}

export async function loginUser(store: AppStore, username: string, password: string) {
  const normalized = normalizeUsername(username);
  const attempt = store.loginAttempts.get(normalized) ?? { count: 0 };
  if (attempt.lockedUntil && attempt.lockedUntil > Date.now()) {
    throw new ApiError(429, "Too many failed attempts. Try again later.");
  }
  const userId = store.usernameIndex.get(normalized);
  const user = userId ? store.users.get(userId) : undefined;
  const passwordValid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !passwordValid) {
    const count = attempt.count + 1;
    store.loginAttempts.set(normalized, {
      count,
      lockedUntil: count >= LOCK_AFTER_ATTEMPTS ? Date.now() + LOCK_FOR_MS : undefined
    });
    throw new ApiError(401, "Invalid username or password");
  }
  store.loginAttempts.delete(normalized);
  return { user: publicUser(user), token: createSession(store, user.id) };
}

export function createSession(store: AppStore, userId: string): string {
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  store.sessions.set(token, {
    token,
    userId,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 8).toISOString(),
    active: true
  });
  return token;
}

export function logout(store: AppStore, token: string): void {
  const session = store.sessions.get(token);
  if (session) session.active = false;
}

export function createGoogleOAuthState(store: AppStore, redirectTo?: string): string {
  const state = randomBytes(24).toString("hex");
  store.oauthStates.set(state, { createdAt: Date.now(), redirectTo });
  return state;
}

function requireGoogleConfig() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new ApiError(500, "Google OAuth is not configured");
  }
  return { clientId, clientSecret, redirectUri };
}

export function buildGoogleOAuthUrl(store: AppStore, redirectTo?: string): { state: string; authUrl: string } {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  const state = createGoogleOAuthState(store, redirectTo);
  if (!clientId || !redirectUri) {
    return { state, authUrl: `local-google-oauth-disabled?state=${state}` };
  }
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return { state, authUrl: url.toString() };
}

async function exchangeGoogleCodeForEmail(code: string): Promise<string> {
  const { clientId, clientSecret, redirectUri } = requireGoogleConfig();
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });
  if (!tokenResponse.ok) throw new ApiError(401, "Google OAuth token exchange failed");
  const tokenPayload = await tokenResponse.json() as { access_token?: string };
  if (!tokenPayload.access_token) throw new ApiError(401, "Google OAuth access token missing");
  const userInfoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokenPayload.access_token}` }
  });
  if (!userInfoResponse.ok) throw new ApiError(401, "Google userinfo request failed");
  const userInfo = await userInfoResponse.json() as { email?: string; email_verified?: boolean };
  if (!userInfo.email || userInfo.email_verified === false) throw new ApiError(401, "Google email is not verified");
  return userInfo.email;
}

export async function loginWithGoogleCallback(store: AppStore, state: string, options: { email?: string; code?: string }) {
  const stateRecord = store.oauthStates.get(state);
  if (!stateRecord || Date.now() - stateRecord.createdAt > 1000 * 60 * 10) {
    throw new ApiError(400, "Invalid OAuth state");
  }
  store.oauthStates.delete(state);
  const email = options.email ?? (options.code ? await exchangeGoogleCodeForEmail(options.code) : undefined);
  if (!email) throw new ApiError(400, "Google OAuth callback requires a code");
  const normalized = normalizeUsername(email);
  const existingUserId = store.usernameIndex.get(normalized);
  if (existingUserId) {
    const existingUser = store.users.get(existingUserId);
    if (!existingUser) throw new ApiError(401, "Authentication failed");
    return { user: publicUser(existingUser), token: createSession(store, existingUser.id) };
  }
  return registerUser(store, normalized, randomBytes(24).toString("hex"), normalized.split("@")[0]);
}
