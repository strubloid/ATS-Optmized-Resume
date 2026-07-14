import { ApiError } from "../../shared/http";
import { containsBinaryLikeContent } from "../../../../../packages/resume-core/src";

const ALLOWED_EXTENSIONS = [".md", ".markdown", ".txt"];
const MAX_FILE_SIZE = 80_000;

export function validateResumeUpload(filename: string | undefined, markdown: string): void {
  if (filename) {
    const normalized = filename.toLowerCase();
    if (filename.includes("/") || filename.includes("\\") || filename.includes("..") || filename.includes("\0")) {
      throw new ApiError(400, "Unsafe filename");
    }
    if (!ALLOWED_EXTENSIONS.some((extension) => normalized.endsWith(extension))) {
      throw new ApiError(400, "Unsupported file type");
    }
  }
  if (!markdown.trim()) {
    throw new ApiError(400, "Resume content is required");
  }
  if (Buffer.byteLength(markdown, "utf8") > MAX_FILE_SIZE) {
    throw new ApiError(413, "Resume file is too large");
  }
  if (containsBinaryLikeContent(markdown)) {
    throw new ApiError(400, "Resume content appears to be binary or malformed");
  }
}

export function validateJobDescription(description: string): void {
  if (!description.trim()) throw new ApiError(400, "Job description is required");
  if (Buffer.byteLength(description, "utf8") > MAX_FILE_SIZE) throw new ApiError(413, "Job description is too large");
}
