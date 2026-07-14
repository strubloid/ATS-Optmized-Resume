import { createHash } from "node:crypto";

export interface SanitizedTextResult {
  text: string;
  warnings: string[];
}

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const HTML_COMMENT_PATTERN = /<!--[\s\S]*?-->/g;
const SCRIPT_BLOCK_PATTERN = /<script[\s\S]*?>[\s\S]*?<\/script>/gi;
const RAW_HTML_TAG_PATTERN = /<[^>]+>/g;
const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*\]\([^)]*\)/g;
const JAVASCRIPT_LINK_PATTERN = /\]\(\s*javascript:[^)]+\)/gi;

export function stableHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(value: string): string {
  const normalized = normalizeText(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || `section_${stableHash(value)}`;
}

export function containsBinaryLikeContent(value: string): boolean {
  if (value.includes("\0")) return true;
  const suspicious = value.match(CONTROL_CHARACTER_PATTERN);
  return Boolean(suspicious && suspicious.length > 2);
}

export function sanitizeMarkdownInput(markdown: string): SanitizedTextResult {
  const warnings: string[] = [];
  let text = markdown.replace(/\r\n/g, "\n");

  if (containsBinaryLikeContent(text)) {
    warnings.push("Binary or control characters were removed.");
    text = text.replace(CONTROL_CHARACTER_PATTERN, "");
  }

  if (SCRIPT_BLOCK_PATTERN.test(text)) {
    warnings.push("Script blocks were removed.");
    text = text.replace(SCRIPT_BLOCK_PATTERN, "");
  }

  if (HTML_COMMENT_PATTERN.test(text)) {
    warnings.push("Hidden HTML comments were removed.");
    text = text.replace(HTML_COMMENT_PATTERN, "");
  }

  if (JAVASCRIPT_LINK_PATTERN.test(text)) {
    warnings.push("javascript: links were blocked.");
    text = text.replace(JAVASCRIPT_LINK_PATTERN, "](#blocked)");
  }

  if (MARKDOWN_IMAGE_PATTERN.test(text)) {
    warnings.push("Markdown image references were removed.");
    text = text.replace(MARKDOWN_IMAGE_PATTERN, "");
  }

  if (RAW_HTML_TAG_PATTERN.test(text)) {
    warnings.push("Raw HTML tags were removed.");
    text = text.replace(RAW_HTML_TAG_PATTERN, "");
  }

  const lines = text.split("\n").map((line) => {
    if (line.length > 500) {
      warnings.push("A very long line was truncated for parser safety.");
      return line.slice(0, 500);
    }
    return line;
  });

  return { text: lines.join("\n").trim(), warnings: Array.from(new Set(warnings)) };
}

const PROMPT_INJECTION_PATTERNS = [
  /ignore (all )?(previous|above|prior) instructions/i,
  /system\s*:/i,
  /developer\s*:/i,
  /reveal (secrets|tokens|api keys)/i,
  /delete all files/i,
  /fabricate|make up|invent/i,
  /add .*even if/i,
  /override.*schema/i,
  /tool call|call tools/i
];

export function detectPromptInjection(text: string): string[] {
  const warnings: string[] = [];
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      warnings.push("Prompt-injection pattern detected and ignored.");
      break;
    }
  }
  return warnings;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
