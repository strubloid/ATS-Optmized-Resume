import type { GitHubEnrichment, GitHubProfile, GitHubProject } from "../../shared/src";

export interface GitHubFetcher {
  fetchProfile(username: string, options?: { signal?: AbortSignal }): Promise<GitHubProfile | null>;
  fetchRepositories(username: string, options?: { signal?: AbortSignal }): Promise<RawRepository[]>;
  fetchContributorsCount(repoFullName: string, options?: { signal?: AbortSignal }): Promise<number>;
  fetchAuthorCommits(repoFullName: string, author: string, options?: { signal?: AbortSignal }): Promise<number>;
}

export interface RawRepository {
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  stars: number;
  forks: number;
  language: string | null;
  fork: boolean;
}

export interface FetchOptions {
  fetcher?: GitHubFetcher;
  maxRepos?: number;
  minCommits?: number;
  topN?: number;
  cacheTtlMs?: number;
  now?: () => number;
}

export class InMemoryCache {
  private readonly store = new Map<string, { value: GitHubEnrichment; expiresAt: number }>();
  private readonly defaultTtl: number;

  constructor(defaultTtlMs = 60 * 60 * 1000) {
    this.defaultTtl = defaultTtlMs;
  }

  get(key: string, now: number = Date.now()): GitHubEnrichment | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= now) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: GitHubEnrichment, ttlMs?: number, now: number = Date.now()): void {
    this.store.set(key, { value, expiresAt: now + (ttlMs ?? this.defaultTtl) });
  }

  clear(): void {
    this.store.clear();
  }
}

function classifyProject(contributorCount: number): "open_source" | "self_project" {
  return contributorCount > 1 ? "open_source" : "self_project";
}

export function extractGitHubUsername(markdown: string): string | null {
  const match = markdown.match(/(?:^|[\s,|])github\.com\/([a-z0-9](?:-?[a-z0-9]){0,38})/i);
  if (!match) return null;
  const username = match[1]?.replace(/[)\].,;]+$/, "");
  return username && username.length > 0 ? username : null;
}

export async function enrichGitHubProfile(
  username: string,
  options: FetchOptions = {}
): Promise<GitHubEnrichment> {
  const now = options.now ?? Date.now;
  const maxRepos = options.maxRepos ?? 100;
  const minCommits = options.minCommits ?? 4;
  const topN = options.topN ?? 7;

  const profile = await options.fetcher!.fetchProfile(username);
  if (!profile) {
    return emptyEnrichment(username, "skipped", "Profile not found");
  }

  const rawRepos = (await options.fetcher!.fetchRepositories(username)).slice(0, maxRepos);
  const projects: GitHubProject[] = [];
  for (const repo of rawRepos) {
    if (repo.fork && repo.forks < 5) continue;
    let contributors = 1;
    let authorCommits = 0;
    try {
      contributors = await options.fetcher!.fetchContributorsCount(repo.fullName);
      authorCommits = await options.fetcher!.fetchAuthorCommits(repo.fullName, username);
    } catch {
      continue;
    }
    if (authorCommits < minCommits) continue;
    projects.push({
      name: repo.name,
      description: repo.description ?? "",
      url: repo.url,
      stars: repo.stars,
      forks: repo.forks,
      contributors,
      authorCommits,
      totalCommits: authorCommits,
      type: classifyProject(contributors),
      language: repo.language ?? ""
    });
  }

  const openSourceCount = projects.filter((p) => p.type === "open_source").length;
  const selfProjectCount = projects.length - openSourceCount;
  const topProjects = [...projects]
    .sort((a, b) => b.stars + b.authorCommits - (a.stars + a.authorCommits))
    .slice(0, topN);

  return {
    username,
    profile,
    projects,
    totalRepos: rawRepos.length,
    openSourceCount,
    selfProjectCount,
    topProjects,
    fetchedAt: new Date(now()).toISOString(),
    source: "live"
  };
}

export async function enrichGitHubFromResume(
  resumeMarkdown: string,
  options: FetchOptions = {}
): Promise<GitHubEnrichment> {
  const username = extractGitHubUsername(resumeMarkdown);
  if (!username) return emptyEnrichment(null, "skipped", "No GitHub username found in resume");
  if (!options.fetcher) return emptyEnrichment(username, "skipped", "GitHub fetcher not configured");
  try {
    return await enrichGitHubProfile(username, options);
  } catch (error) {
    return emptyEnrichment(username, "error", error instanceof Error ? error.message : String(error));
  }
}

function emptyEnrichment(username: string | null, source: GitHubEnrichment["source"], error?: string): GitHubEnrichment {
  return {
    username,
    profile: null,
    projects: [],
    totalRepos: 0,
    openSourceCount: 0,
    selfProjectCount: 0,
    topProjects: [],
    fetchedAt: new Date().toISOString(),
    source,
    error
  };
}

export async function enrichGitHubCached(
  resumeMarkdown: string,
  cache: InMemoryCache,
  options: FetchOptions = {}
): Promise<GitHubEnrichment> {
  const username = extractGitHubUsername(resumeMarkdown);
  const cacheKey = username ? `gh:${username}` : "gh:none";
  const cached = cache.get(cacheKey);
  if (cached) {
    return { ...cached, source: "cache" as const };
  }
  const enrichment = await enrichGitHubFromResume(resumeMarkdown, options);
  if (enrichment.source === "live") {
    cache.set(cacheKey, enrichment);
  }
  return enrichment;
}
