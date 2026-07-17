import { describe, expect, it } from "vitest";
import { htmlToMarkdown, markdownToHtml } from "../../apps/web/src/features/resumeEditor/markdownRichText";

describe("markdownRichText", () => {
  it("converts a simple heading and paragraph to HTML", () => {
    const html = markdownToHtml("## Experience\n\nBuilt things.");
    expect(html).toContain("<h2");
    expect(html).toContain("Experience");
    expect(html).toContain("<p>Built things.</p>");
  });

  it("converts bullet lists to ul/li", () => {
    const html = markdownToHtml("- React\n- TypeScript\n");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>React</li>");
    expect(html).toContain("<li>TypeScript</li>");
  });

  it("renders an empty string to an empty string", () => {
    expect(markdownToHtml("")).toBe("");
  });

  it("converts a heading HTML back to a markdown heading", () => {
    const md = htmlToMarkdown("<h2>Experience</h2><p>Built things.</p>");
    expect(md).toContain("## Experience");
    expect(md).toContain("Built things.");
  });

  it("converts bullet list HTML back to a markdown list", () => {
    const md = htmlToMarkdown("<ul><li>React</li><li>TypeScript</li></ul>");
    expect(md).toMatch(/-\s+React/);
    expect(md).toMatch(/-\s+TypeScript/);
  });

  it("returns an empty string for empty HTML", () => {
    expect(htmlToMarkdown("")).toBe("");
  });

  it("preserves bold and links through a roundtrip", () => {
    const source = "**bold** and [GitHub](https://github.com/rafael)";
    const html = markdownToHtml(source);
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain('href="https://github.com/rafael"');
    const md = htmlToMarkdown(html);
    expect(md).toContain("**bold**");
    expect(md).toContain("[GitHub](https://github.com/rafael)");
  });
});
