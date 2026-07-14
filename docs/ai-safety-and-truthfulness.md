# AI Safety And Truthfulness

AI input is untrusted resume and job-description data. Provider calls are server-side only. API keys never enter browser bundles, logs, exports, or API responses.

Responses must be structured, schema-validated, evidence-ID based, and checked after parsing. Every evidence ID must belong to the authenticated user's current resume version. Excerpts must be safe substrings of stored evidence. Employers, dates, metrics, tools, certifications, and seniority cannot be introduced without source evidence.

Direct, equivalent, transferable, incomplete, and unsupported classifications receive different score treatment. A qualified transferable sentence may mention a target technology only as a target or relationship; it must not use direct-experience claims such as `built`, `managed`, or `expert in` for an unsupported technology.

When the provider is unavailable, the deterministic rules-only workflow remains available. Raw prompts and responses are not stored by default.
