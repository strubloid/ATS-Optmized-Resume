# Things Missing And How To Get Them

## Required Before Real Production

1. Real Google OAuth credentials

Create a Google Cloud OAuth web client and set:

```sh
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=https://<your-domain>/api/auth/google/callback
GOOGLE_OAUTH_SUCCESS_REDIRECT=https://<your-domain>
```

2. Production PostgreSQL URL

For Fly.io, attach Fly Postgres or another managed PostgreSQL provider and set:

```sh
fly secrets set DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require"
```

For local Docker Compose, PostgreSQL is exposed to host programs at:

```txt
postgresql://curriculum:curriculum_password@localhost:5432/curriculum_optimizer?schema=public
```

3. Export storage size and backup policy

Exports are written to `EXPORT_DIR` with JSON sidecar files. On Fly, create a volume:

```sh
fly volumes create curriculum_exports --size 1 --region iad
```

Increase the size if many PDFs/DOCX files will be stored.

4. Database backups

For local Docker:

```sh
docker exec curriculum-postgres pg_dump -U curriculum curriculum_optimizer > backup.sql
```

For Fly Postgres, use Fly's backup/snapshot tooling for the attached database.

5. Relational Prisma models

Current production persistence uses a Prisma-backed `AppState` snapshot plus an `ExportedFile` table. It works and is database-backed, but the next maintainability step is normalized relational models for `User`, `Resume`, `ResumeVersion`, `Company`, `JobApplication`, `GeneratedResume`, `ScoreReport`, `ResumeComment`, and `ExportedDocument`.

6. Real AI providers

The app currently works with the rules-only fallback. To add AI providers, implement `ResumeAiProvider` in `packages/ai-core` and keep Zod validation plus unsupported-claim filtering.

## Local Commands

Install dependencies:

```sh
npm install
```

Generate Prisma client:

```sh
npm run db:generate
```

Run local app without Docker:

```sh
npm run dev
```

Run with Docker Compose:

```sh
docker compose up --build
```

Run migrations locally against Docker Postgres:

```sh
DATABASE_URL="postgresql://curriculum:curriculum_password@localhost:5432/curriculum_optimizer?schema=public" npm run db:deploy
```

## Programmatic Access

Database access from host tools:

```txt
Host: localhost
Port: 5432
Database: curriculum_optimizer
User: curriculum
Password: curriculum_password
```

Export metadata API:

```txt
GET /api/exports
Authorization: Bearer <token>
```

Export files in Docker:

```txt
/data/exports/<export-id>.pdf
/data/exports/<export-id>.docx
/data/exports/<export-id>.md
/data/exports/<export-id>.json
```

## Rafael Should Decide

- Fly app name and region.
- Whether exports should be retained forever or expire after a period.
- Whether to normalize all Prisma models immediately or keep snapshot persistence for the first deploy.
- Which AI provider should be implemented first.
- Whether database access should stay open on localhost only or be exposed through a secure tunnel/VPN in production.
