import { describe, expect, it } from "vitest";
import {
  createStubFetcher,
  enrichGitHubFromResume,
  enrichGitHubCached,
  extractGitHubUsername,
  InMemoryCache
} from "../../packages/github-core/src";

describe("extractGitHubUsername", () => {
  it("finds github.com/<user> anywhere in markdown", () => {
    expect(extractGitHubUsername("# Rafael\ngithub.com/rafael-silva")).toBe("rafael-silva");
  });

  it("returns null when no GitHub link is present", () => {
    expect(extractGitHubUsername("# Rafael\nemail@me.com")).toBeNull();
  });

  it("strips trailing punctuation", () => {
    expect(extractGitHubUsername("github.com/rafael-silva.")).toBe("rafael-silva");
  });
});

describe("enrichGitHubFromResume with stub fetcher", () => {
  it("classifies repos with contributors > 1 as open_source", async () => {
    const fetcher = createStubFetcher([
      {
        username: "rafael",
        projects: [
          { name: "k8s-tool", fullName: "rafael/k8s-tool", stars: 100, forks: 10, contributors: 5, authorCommits: 20, language: "Go" }
        ]
      }
    ]);
    const enrichment = await enrichGitHubFromResume("github.com/rafael", { fetcher });
    expect(enrichment.source).toBe("live");
    expect(enrichment.projects).toHaveLength(1);
    expect(enrichment.projects[0]?.type).toBe("open_source");
    expect(enrichment.openSourceCount).toBe(1);
  });

  it("classifies repos with only 1 contributor as self_project", async () => {
    const fetcher = createStubFetcher([
      {
        username: "rafael",
        projects: [
          { name: "personal-blog", fullName: "rafael/personal-blog", stars: 0, forks: 0, contributors: 1, authorCommits: 10, language: "TS" }
        ]
      }
    ]);
    const enrichment = await enrichGitHubFromResume("github.com/rafael", { fetcher });
    expect(enrichment.projects[0]?.type).toBe("self_project");
    expect(enrichment.selfProjectCount).toBe(1);
    expect(enrichment.openSourceCount).toBe(0);
  });

  it("filters repos with fewer than 4 author commits", async () => {
    const fetcher = createStubFetcher([
      {
        username: "rafael",
        projects: [
          { name: "tiny-fork", fullName: "rafael/tiny-fork", stars: 0, forks: 0, contributors: 1, authorCommits: 1, language: "TS" }
        ]
      }
    ]);
    const enrichment = await enrichGitHubFromResume("github.com/rafael", { fetcher });
    expect(enrichment.projects).toHaveLength(0);
  });

  it("picks top 7 by stars + authorCommits", async () => {
    const fetcher = createStubFetcher([
      {
        username: "rafael",
        projects: [
          { name: "a", fullName: "rafael/a", stars: 1000, forks: 100, contributors: 5, authorCommits: 50, language: "Go" },
          { name: "b", fullName: "rafael/b", stars: 100, forks: 10, contributors: 5, authorCommits: 5, language: "TS" },
          { name: "c", fullName: "rafael/c", stars: 10, forks: 1, contributors: 1, authorCommits: 5, language: "TS" }
        ]
      }
    ]);
    const enrichment = await enrichGitHubFromResume("github.com/rafael", { fetcher, topN: 2 });
    expect(enrichment.topProjects).toHaveLength(2);
    expect(enrichment.topProjects[0]?.name).toBe("a");
  });

  it("returns empty enrichment when no username is found", async () => {
    const enrichment = await enrichGitHubFromResume("# Rafael\nemail@me.com");
    expect(enrichment.source).toBe("skipped");
    expect(enrichment.username).toBeNull();
  });

  it("returns error enrichment when fetcher throws", async () => {
    const fetcher = {
      fetchProfile: async () => { throw new Error("network down"); },
      fetchRepositories: async () => [],
      fetchContributorsCount: async () => 0,
      fetchAuthorCommits: async () => 0
    };
    const enrichment = await enrichGitHubFromResume("github.com/rafael", { fetcher });
    expect(enrichment.source).toBe("error");
    expect(enrichment.error).toMatch(/network down/);
  });
});

describe("enrichGitHubCached", () => {
  it("caches a live result and serves it as 'cache' on the second call", async () => {
    let calls = 0;
    const fetcher = {
      fetchProfile: async () => { calls += 1; return { login: "rafael", name: "Rafael", bio: null, createdAt: new Date().toISOString(), followers: 1, following: 1, publicRepos: 1 }; },
      fetchRepositories: async () => [],
      fetchContributorsCount: async () => 1,
      fetchAuthorCommits: async () => 5
    };
    const cache = new InMemoryCache(60_000);
    const first = await enrichGitHubCached("github.com/rafael", cache, { fetcher });
    const second = await enrichGitHubCached("github.com/rafael", cache, { fetcher });
    expect(first.source).toBe("live");
    expect(second.source).toBe("cache");
    expect(calls).toBe(1);
  });
});
