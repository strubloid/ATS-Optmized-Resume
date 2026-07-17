import type { GitHubFetcher, RawRepository } from "./githubEnrichment";

interface OctokitLike {
  rest: {
    users: { getByUsername: (args: { username: string }) => Promise<{ data: OctokitUser }> };
    repos: {
      listForUser: (args: { username: string; per_page: number; sort: string; direction: string }) => Promise<{ data: OctokitRepo[] }>;
      getContributors: (args: { owner: string; repo: string; per_page: number }) => Promise<{ data: OctokitContributor[] }>;
    };
  };
}

interface OctokitUser {
  login: string;
  name: string | null;
  bio: string | null;
  created_at: string;
  followers: number;
  following: number;
  public_repos: number;
}

interface OctokitRepo {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  fork: boolean;
}

interface OctokitContributor {
  login: string;
  contributions: number;
}

export interface OctokitFetcherOptions {
  auth?: string;
  userAgent?: string;
}

export function createOctokitFetcher(options: OctokitFetcherOptions = {}): GitHubFetcher {
  const headers: Record<string, string> = {
    "User-Agent": options.userAgent ?? "curriculum-optimizer",
    Accept: "application/vnd.github+json"
  };
  if (options.auth) headers.Authorization = `Bearer ${options.auth}`;

  async function call<T>(url: string, signal?: AbortSignal): Promise<T> {
    const response = await fetch(url, { headers, signal });
    if (!response.ok) {
      if (response.status === 404) throw new NotFoundError(`Not found: ${url}`);
      throw new Error(`GitHub API error ${response.status}: ${response.statusText}`);
    }
    return (await response.json()) as T;
  }

  return {
    async fetchProfile(username, opts) {
      try {
        const data = await call<OctokitUser>(`https://api.github.com/users/${encodeURIComponent(username)}`, opts?.signal);
        return {
          login: data.login,
          name: data.name,
          bio: data.bio,
          createdAt: data.created_at,
          followers: data.followers,
          following: data.following,
          publicRepos: data.public_repos
        };
      } catch (error) {
        if (error instanceof NotFoundError) return null;
        throw error;
      }
    },
    async fetchRepositories(username, opts) {
      const data = await call<OctokitRepo[]>(
        `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated&direction=desc`,
        opts?.signal
      );
      return data.map<RawRepository>((repo) => ({
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        url: repo.html_url,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        language: repo.language,
        fork: repo.fork
      }));
    },
    async fetchContributorsCount(repoFullName, opts) {
      const [owner, name] = repoFullName.split("/");
      if (!owner || !name) return 1;
      try {
        const data = await call<OctokitContributor[]>(
          `https://api.github.com/repos/${owner}/${name}/contributors?per_page=100`,
          opts?.signal
        );
        return data.length;
      } catch (error) {
        if (error instanceof NotFoundError) return 1;
        return 1;
      }
    },
    async fetchAuthorCommits(repoFullName, author, opts) {
      const [owner, name] = repoFullName.split("/");
      if (!owner || !name) return 0;
      try {
        const data = await call<OctokitContributor[]>(
          `https://api.github.com/repos/${owner}/${name}/contributors?per_page=100&anon=true`,
          opts?.signal
        );
        const me = data.find((contributor) => contributor.login === author);
        return me?.contributions ?? 0;
      } catch {
        return 0;
      }
    }
  };
}

class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export function createStubFetcher(repos: ReadonlyArray<{ username: string; projects: ReadonlyArray<{ name: string; fullName: string; stars?: number; forks?: number; contributors?: number; authorCommits?: number; description?: string; language?: string; fork?: boolean }> }>): GitHubFetcher {
  const repoMap = new Map<string, { username: string; stars: number; forks: number; contributors: number; authorCommits: number; description: string; language: string; fork: boolean; fullName: string; name: string }>();
  for (const user of repos) {
    for (const project of user.projects) {
      repoMap.set(project.fullName, {
        username: user.username,
        stars: project.stars ?? 0,
        forks: project.forks ?? 0,
        contributors: project.contributors ?? 1,
        authorCommits: project.authorCommits ?? 0,
        description: project.description ?? "",
        language: project.language ?? "",
        fork: project.fork ?? false,
        fullName: project.fullName,
        name: project.name
      });
    }
  }
  const profileFor = new Map<string, { login: string; createdAt: string }>();
  for (const user of repos) {
    if (!profileFor.has(user.username)) {
      profileFor.set(user.username, { login: user.username, createdAt: new Date(Date.now() - 5 * 365.25 * 24 * 60 * 60 * 1000).toISOString() });
    }
  }

  return {
    async fetchProfile(username) {
      const profile = profileFor.get(username);
      if (!profile) return null;
      return {
        login: profile.login,
        name: profile.login,
        bio: null,
        createdAt: profile.createdAt,
        followers: 1,
        following: 1,
        publicRepos: repoMap.size
      };
    },
    async fetchRepositories(username) {
      const out: RawRepository[] = [];
      for (const repo of repoMap.values()) {
        if (repo.username === username) {
          out.push({ name: repo.name, fullName: repo.fullName, description: repo.description, url: `https://github.com/${repo.fullName}`, stars: repo.stars, forks: repo.forks, language: repo.language, fork: repo.fork });
        }
      }
      return out;
    },
    async fetchContributorsCount(repoFullName) {
      return repoMap.get(repoFullName)?.contributors ?? 1;
    },
    async fetchAuthorCommits(repoFullName, author) {
      const repo = repoMap.get(repoFullName);
      if (!repo) return 0;
      return repo.username === author ? repo.authorCommits : 0;
    }
  };
}
