FROM node:24-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/ai-core/package.json packages/ai-core/package.json
COPY packages/comments-core/package.json packages/comments-core/package.json
COPY packages/document-exporter/package.json packages/document-exporter/package.json
COPY packages/resume-core/package.json packages/resume-core/package.json
COPY packages/scoring-core/package.json packages/scoring-core/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

FROM deps AS tooling
COPY . .
RUN npm run db:generate

FROM tooling AS build
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
ENV API_HOST=0.0.0.0
ENV API_PORT=3333
ENV WEB_DIST_DIR=/app/apps/web/dist
ENV EXPORT_DIR=/data/exports
COPY --from=build /app /app
RUN mkdir -p /data/exports && chown -R node:node /data
USER node
EXPOSE 3333
CMD ["sh", "-c", "npm run db:deploy && npm run start --workspace @curriculum/api"]
