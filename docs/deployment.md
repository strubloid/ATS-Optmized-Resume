# Deployment

## Local Docker Compose

This project requires Docker Compose v2. On Ubuntu, install it with:

```sh
sudo apt update
sudo apt install docker-compose-v2
```

Use `docker compose` with a space, not the legacy `docker-compose` command. The
legacy Python client (`docker-compose` 1.x) is incompatible with newer Docker
Engine installations and can fail with `Not supported URL scheme http+docker`.

Run the full app with PostgreSQL, the web/API app, and Adminer:

```sh
docker compose up --build
```

Services:

- App/frontend: `http://localhost:6666`
- API health check: `http://localhost:3333/api/health`
- PostgreSQL: internal to Compose (not published on the host)
- Adminer: `http://localhost:8080`

Database credentials for local compose:

- Server: `postgres` from inside Docker, `localhost` from host programs
- Database: `curriculum_optimizer`
- User: `curriculum`
- Password: `curriculum_password`

Host connection string:

```txt
postgresql://curriculum:curriculum_password@localhost:5432/curriculum_optimizer?schema=public
```

Container connection string:

```txt
postgresql://curriculum:curriculum_password@postgres:5432/curriculum_optimizer?schema=public
```

## Export Files

When `EXPORT_DIR` is set, every export is written to that folder with a readable sidecar JSON metadata file.

Docker Compose stores exports in the `export-data` volume at `/data/exports` inside the app container.

Programs can also read export metadata through:

```txt
GET /api/exports
Authorization: Bearer <token>
```

Clean exports exclude comments. Annotated exports include comments only when explicitly requested.

## Fly.io

1. Create or select the Fly app.
2. Create a Fly Postgres database or provide a managed Postgres `DATABASE_URL`.
3. Set secrets:

```sh
fly secrets set DATABASE_URL="postgresql://..."
fly secrets set GOOGLE_OAUTH_CLIENT_ID="..."
fly secrets set GOOGLE_OAUTH_CLIENT_SECRET="..."
fly secrets set GOOGLE_OAUTH_REDIRECT_URI="https://<your-app>.fly.dev/api/auth/google/callback"
fly secrets set GOOGLE_OAUTH_SUCCESS_REDIRECT="https://<your-app>.fly.dev"
```

4. Create the persistent export volume:

```sh
fly volumes create curriculum_exports --size 1 --region iad
```

5. Deploy:

```sh
fly deploy
```

The Docker command runs `prisma migrate deploy` before starting the API.

## Google OAuth

Configure a Google OAuth web client with this redirect URI:

```txt
https://<your-domain>/api/auth/google/callback
```

For local compose use:

```txt
http://localhost:3333/api/auth/google/callback
```

## Database Model

The app persists the current application store in PostgreSQL through Prisma `AppState`, and export metadata in `ExportedFile`. This keeps the implementation modular while making the database externally readable.

Future production hardening should normalize the snapshot into first-class relational tables for users, resumes, jobs, comments, and score reports.
