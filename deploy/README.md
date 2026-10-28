# Jellyfin Server and Web HDR10 candidate images

The candidate keeps Jellyfin Server at version 10.10.7. The Server build starts from the exact base image digest below and overlays only binaries published from the matching 10.10.7 source plus the global client-policy setting. The Web image then replaces the complete `/jellyfin/jellyfin-web` static directory with the production build. Existing configuration, database, media, mounts, and networks remain in the base service.

The Server build runs the model tests and publishes the 10.10.7 Server project with a pinned .NET SDK image. The Web build uses Node 20 from a pinned image digest, runs all Web tests and type checks, and creates the production bundle.

Build both images in the same Docker daemon. The Web build uses the locally tagged Server image as its final base.

## Build the Server image

Run from the checked out `jellyfin` Server fork root:

```sh
docker build --pull --build-arg JELLYFIN_SERVER_COMMIT_SHA="$(git rev-parse HEAD)" -f deploy/Dockerfile.server -t jellyfin-server-hdr10:10.10.7-r2 .
```

The Server Dockerfile uses `dockerproxy.wopd.dpdns.org/nyanmisaka/jellyfin@sha256:b29e623bc37dd346ca27f8c4360fdb27aaebb9732ca0e6e2fbbe9e5033cc80b7` as its runtime base. It does not update Jellyfin Server beyond 10.10.7.

## Build the Web image

Run from the checked out `jellyfin-web` Web fork root:

```sh
docker build --build-arg JELLYFIN_SERVER_IMAGE=jellyfin-server-hdr10:10.10.7-r2 --build-arg JELLYFIN_WEB_COMMIT_SHA="$(git rev-parse HEAD)" -f deploy/Dockerfile -t jellyfin-web-hdr10:10.10.7-251212-hdr10-r2 .
```

## Compose deployment example

The override changes only the `jellyfin` image. Compose merges the existing ports, volumes, networks, and other service settings from `/data/appdata/docker-compose.yml`.

Validate the merged Compose model without printing its configuration:

```sh
docker compose -f /data/appdata/docker-compose.yml -f deploy/compose.hdr10.yml config --quiet
```

Deploy the candidate after reviewing the validation result:

```sh
docker compose -f /data/appdata/docker-compose.yml -f deploy/compose.hdr10.yml up -d --no-deps --pull never --force-recreate jellyfin
```

Recreating Jellyfin is required for it to use the derived image. This interrupts active Jellyfin sessions while the server restarts. The Compose override leaves the base service's persistent mounts and network configuration in place.

## Rollback

The rollback override selects the exact base image digest observed on the current container:

```sh
docker compose -f /data/appdata/docker-compose.yml -f deploy/compose.rollback.yml up -d --no-deps --pull never --force-recreate jellyfin
```

This restarts Jellyfin on the original Server 10.10.7 image. It does not delete or recreate volumes. If the global HDR10 setting was changed, the old Server will ignore that setting; the client defaults to automatic detection when the setting is unavailable.
