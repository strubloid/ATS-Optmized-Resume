import { expect, test } from "@playwright/test";

test("user can generate, review, block unsupported skills, and hide comments in clean preview", async ({ page }) => {
  await page.goto("/");
  const username = `e2e-${Date.now()}@example.com`;
  await page.getByLabel("Email").fill(username);
  await page.getByLabel("Password").fill("secure-pass-123");
  await page.getByRole("button", { name: "Register" }).click();
  await page.getByLabel("Nickname").fill("E2E User");
  await page.getByLabel("Confirm email").fill(username);
  await page.getByLabel("Confirm password").fill("secure-pass-123");
  await page.getByRole("button", { name: "Create account" }).click();

  await page.getByRole("button", { name: "Master Resume" }).click();
  await page.getByRole("button", { name: "Save resume.md" }).click();
  await expect(page.getByText("Master resume saved as a new version.")).toBeVisible();

  await page.getByRole("button", { name: "Job Applications" }).click();
  await page.getByTestId("generate-cv").click();
  await expect(page.getByText("Generated CV Review")).toBeVisible();
  await expect(page.getByTestId("comment-margin")).toBeVisible();
  await expect(page.getByTestId("improvement-panel")).toBeVisible();

  await page.getByTestId("improvement-category").filter({ hasText: "Optimize Skills" }).click();
  await expect(page.getByTestId("suggestion-detail")).toContainText("Restructure skills for relevance");

  await page.getByTestId("margin-comment").first().click();
  await expect(page.getByTestId("highlighted-section")).toBeVisible();

  await page.getByTestId("accept-suggestion").click();
  await page.getByTestId("improvement-category").filter({ hasText: "Formatting Safety" }).click();
  await page.getByTestId("reject-suggestion").click();

  await page.getByTestId("mode-source").click();
  await expect(page.getByTestId("source-comparison")).toContainText("Rafael Silva");

  await page.getByTestId("mode-unsupported").click();
  await expect(page.getByTestId("unsupported-requirements")).toContainText("Kubernetes");

  await page.getByTestId("mode-questionnaire").click();
  await expect(page.getByTestId("evidence-questionnaire")).toBeVisible();

  await page.getByTestId("mode-review").click();
  const unsupportedCategory = page.getByTestId("improvement-category").filter({ hasText: "Unsupported Requirements" });
  if (await unsupportedCategory.count()) {
    await unsupportedCategory.first().click();
    await expect(page.getByTestId("edit-manually")).toBeVisible();
    await expect(page.getByTestId("ask-ai-with-context")).toBeVisible();
    await page.getByTestId("ask-ai-with-context").click();
    await expect(page.getByTestId("ask-ai-dialog")).toBeVisible();
    await expect(page.getByTestId("ask-ai-submit")).toBeVisible();
    await page.getByTestId("ask-ai-dialog").getByRole("button", { name: "Cancel" }).click();
  }

  await page.getByTestId("mode-review").click();
  const experienceCategory = page.getByTestId("improvement-category").filter({ hasText: "Enhance Experience" });
  if (await experienceCategory.count()) {
    await experienceCategory.first().click();
    const editButton = page.getByTestId("edit-manually");
    if (await editButton.count()) {
      await editButton.first().click();
      await expect(page.getByTestId("editing-section-").first()).toBeVisible();
      await expect(page.getByTestId(/^cancel-edit-/).first()).toBeVisible();
      await page.getByTestId(/^cancel-edit-/).first().click();
    }
  }

  const cleanDownload = page.waitForEvent("download");
  await page.getByTestId("export-clean-pdf").click();
  expect((await cleanDownload).suggestedFilename()).toContain("pdf");

  const annotatedDownload = page.waitForEvent("download");
  await page.getByTestId("export-annotated-pdf").click();
  expect((await annotatedDownload).suggestedFilename()).toContain("pdf");

  await page.getByTestId("mode-clean").click();
  await expect(page.getByTestId("comment-margin")).toHaveCount(0);
  await expect(page.getByTestId("improvement-panel")).toHaveCount(0);
  await expect(page.getByTestId("resume-document")).toBeVisible();

  await page.getByRole("button", { name: "Score Review" }).click();
  await expect(page.getByText("Estimated Applicant Tracking System compatibility score")).toBeVisible();

  await page.getByRole("button", { name: "Master Resume" }).click();
  expect(await page.getByLabel("resume.md").inputValue()).not.toContain("Kubernetes");
});
