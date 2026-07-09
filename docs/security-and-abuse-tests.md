# Security and Abuse Tests

CurriculumOptimizer handles sensitive personal data and generated career documents. Security is a core product requirement.

## Required protections

- Password hashing with Argon2 or bcrypt
- Secure session handling
- CSRF protection for cookie sessions
- Rate limiting and lockout or progressive delay
- Google OAuth state validation
- Ownership checks on every user-owned resource
- Request validation with strict schemas
- File type, size, and path validation
- HTML escaping and Markdown sanitization
- Prompt-injection resistance
- Safe AI output validation
- No secrets in frontend code
- Redacted logging
- Signed or temporary export URLs if files are stored

## Abuse test categories

- Authentication abuse
- Authorization bypass attempts
- Upload abuse
- Prompt injection abuse
- ATS rule abuse like keyword stuffing and unsupported skill insertion
- Comment abuse including XSS and cross-user access
- Export abuse including script injection and accidental comment leakage
- API abuse including injection payloads and oversized inputs
- Browser abuse across tabs, logout, back button, and stale state

## Required malicious cases

- Wrong password repeated many times
- User A accesses User B data
- Upload renamed binaries or huge files
- Resume content tries to override system instructions
- Job description asks to fabricate skills
- Clean export accidentally contains comments
- Annotated export accidentally contains hidden secrets

## CI expectation

- Security tests must run in CI.
- Tests must verify both prevention and safe failure behavior.
