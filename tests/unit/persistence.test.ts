import { describe, expect, it } from "vitest";
import { hydrateStore, serializeStore } from "../../apps/api/src/shared/persistence";
import { createStore } from "../../apps/api/src/shared/store";

describe("database snapshot persistence", () => {
  it("serializes and hydrates the modular store without losing ownership data", () => {
    const original = createStore();
    original.users.set("user_1", { id: "user_1", username: "rafael@example.com", passwordHash: "hash", createdAt: "2026-07-09T00:00:00Z" });
    original.usernameIndex.set("rafael@example.com", "user_1");
    original.resumes.set("resume_1", { id: "resume_1", userId: "user_1", currentVersionId: "version_1", createdAt: "2026-07-09T00:00:00Z", updatedAt: "2026-07-09T00:00:00Z" });
    original.resumeVersions.set("version_1", { id: "version_1", resumeId: "resume_1", userId: "user_1", markdown: "# Rafael", createdAt: "2026-07-09T00:00:00Z" });
    original.cvProfiles.set("version_1", { resumeVersionId: "version_1", summary: "Backend engineer.", skills: ["Node.js"], roleHeadings: ["Experience"], focusAreas: ["Built APIs"], evidence: [{ id: "bullet_1", sectionId: "experience", bulletId: "bullet_1", text: "Built APIs" }], createdAt: "2026-07-09T00:00:00Z" });

    const snapshot = serializeStore(original);
    const restored = createStore();
    hydrateStore(restored, snapshot);

    expect(restored.users.get("user_1")?.username).toBe("rafael@example.com");
    expect(restored.usernameIndex.get("rafael@example.com")).toBe("user_1");
    expect(restored.resumes.get("resume_1")?.userId).toBe("user_1");
    expect(restored.resumeVersions.get("version_1")?.markdown).toBe("# Rafael");
    expect(restored.cvProfiles.get("version_1")?.skills).toEqual(["Node.js"]);
  });
});
