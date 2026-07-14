import { Prisma, PrismaClient } from "@prisma/client";
import type { Express } from "express";
import type { AppStore } from "./store";

const SNAPSHOT_KEY = "app-store-v1";

let prisma: PrismaClient | null = null;
let pendingSnapshotSave: Promise<void> = Promise.resolve();

export function getPrismaClient(): PrismaClient | null {
  if (!process.env.DATABASE_URL) return null;
  prisma ??= new PrismaClient();
  return prisma;
}

type Entries = Array<[string, unknown]>;

export interface StoreSnapshot {
  users?: Entries;
  usernameIndex?: Array<[string, string]>;
  sessions?: Entries;
  oauthStates?: Entries;
  loginAttempts?: Entries;
  resumes?: Entries;
  resumeVersions?: Entries;
  companies?: Entries;
  jobs?: Entries;
  generatedResumes?: Entries;
  scoreReports?: Entries;
  comments?: Entries;
  exports?: Entries;
  aiSettings?: Entries;
}

function mapToEntries<V>(map: Map<string, V>): Array<[string, V]> {
  return Array.from(map.entries());
}

function entriesToMap<V>(entries: Array<[string, V]> | undefined): Map<string, V> {
  return new Map(entries ?? []);
}

export function serializeStore(store: AppStore): StoreSnapshot {
  return {
    users: mapToEntries(store.users),
    usernameIndex: mapToEntries(store.usernameIndex),
    sessions: mapToEntries(store.sessions),
    oauthStates: mapToEntries(store.oauthStates),
    loginAttempts: mapToEntries(store.loginAttempts),
    resumes: mapToEntries(store.resumes),
    resumeVersions: mapToEntries(store.resumeVersions),
    companies: mapToEntries(store.companies),
    jobs: mapToEntries(store.jobs),
    generatedResumes: mapToEntries(store.generatedResumes),
    scoreReports: mapToEntries(store.scoreReports),
    comments: mapToEntries(store.comments),
    exports: mapToEntries(store.exports)
    ,aiSettings: mapToEntries(store.aiSettings)
  };
}

export function hydrateStore(store: AppStore, snapshot: StoreSnapshot): void {
  store.users = entriesToMap(snapshot.users) as AppStore["users"];
  store.usernameIndex = entriesToMap(snapshot.usernameIndex);
  store.sessions = entriesToMap(snapshot.sessions) as AppStore["sessions"];
  store.oauthStates = entriesToMap(snapshot.oauthStates) as AppStore["oauthStates"];
  store.loginAttempts = entriesToMap(snapshot.loginAttempts) as AppStore["loginAttempts"];
  store.resumes = entriesToMap(snapshot.resumes) as AppStore["resumes"];
  store.resumeVersions = entriesToMap(snapshot.resumeVersions) as AppStore["resumeVersions"];
  store.companies = entriesToMap(snapshot.companies) as AppStore["companies"];
  store.jobs = entriesToMap(snapshot.jobs) as AppStore["jobs"];
  store.generatedResumes = entriesToMap(snapshot.generatedResumes) as AppStore["generatedResumes"];
  store.scoreReports = entriesToMap(snapshot.scoreReports) as AppStore["scoreReports"];
  store.comments = entriesToMap(snapshot.comments) as AppStore["comments"];
  store.exports = entriesToMap(snapshot.exports) as AppStore["exports"];
  store.aiSettings = entriesToMap(snapshot.aiSettings) as AppStore["aiSettings"];
}

export async function loadStoreSnapshot(store: AppStore): Promise<void> {
  const client = getPrismaClient();
  if (!client) return;
  const row = await client.appState.findUnique({ where: { key: SNAPSHOT_KEY } });
  if (row?.value && typeof row.value === "object") hydrateStore(store, row.value as StoreSnapshot);
}

export async function saveStoreSnapshot(store: AppStore): Promise<void> {
  pendingSnapshotSave = pendingSnapshotSave.then(async () => {
    const client = getPrismaClient();
    if (!client) return;
    const value = serializeStore(store) as unknown as Prisma.InputJsonValue;
    await client.appState.upsert({
      where: { key: SNAPSHOT_KEY },
      create: { key: SNAPSHOT_KEY, value },
      update: { value }
    });
  });
  await pendingSnapshotSave;
}

export function installPersistenceHooks(store: AppStore, app: Express): void {
  if (!getPrismaClient()) return;
  app.use((request, response, next) => {
    response.on("finish", () => {
      if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method) && response.statusCode < 500) {
        saveStoreSnapshot(store).catch((error) => console.error("Failed to persist store snapshot", error));
      }
    });
    next();
  });
}
