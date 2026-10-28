ARG JELLYFIN_WEB_COMMIT_SHA
ARG JELLYFIN_SERVER_IMAGE=jellyfin-server-hdr10:10.10.7-r2

FROM docker.io/library/node:20-bookworm-slim@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0 AS web-build

ARG JELLYFIN_WEB_COMMIT_SHA

WORKDIR /workspace

COPY package.json package-lock.json ./
RUN npm ci --no-audit

COPY . .
RUN test -n "$JELLYFIN_WEB_COMMIT_SHA"
ENV JELLYFIN_WEB_COMMIT_SHA=${JELLYFIN_WEB_COMMIT_SHA}
RUN npm test
RUN npm run build:check
RUN npm run build:production
RUN test -s dist/index.html
RUN test -s dist/serviceworker.js
RUN test -s dist/main.jellyfin.bundle.js
RUN grep -Fq "$JELLYFIN_WEB_COMMIT_SHA" dist/main.jellyfin.bundle.js

FROM ${JELLYFIN_SERVER_IMAGE}

ARG JELLYFIN_WEB_COMMIT_SHA
LABEL org.opencontainers.image.revision=${JELLYFIN_WEB_COMMIT_SHA}

COPY --from=web-build /workspace/dist/ /jellyfin/jellyfin-web/
