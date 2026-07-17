import { marked } from "marked";
import TurndownService from "turndown";

let cachedTurndown: TurndownService | undefined;

function getTurndown(): TurndownService {
  if (cachedTurndown) return cachedTurndown;
  const service = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "_",
    strongDelimiter: "**"
  });
  service.addRule("strikethrough", {
    filter: (node) => {
      const name = node.nodeName;
      return name === "DEL" || name === "S" || name === "STRIKE";
    },
    replacement: (content) => `~~${content}~~`
  });
  cachedTurndown = service;
  return service;
}

export function markdownToHtml(markdown: string): string {
  if (!markdown) return "";
  const html = marked.parse(markdown, { async: false, breaks: true, gfm: true });
  return typeof html === "string" ? html : "";
}

export function htmlToMarkdown(html: string): string {
  if (!html) return "";
  return getTurndown().turndown(html).replace(/\n{3,}/g, "\n\n").trim();
}

export function stripHtml(html: string): string {
  if (typeof document === "undefined") return html.replace(/<[^>]+>/g, "");
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent ?? "").replace(/\u00a0/g, " ").trim();
}
