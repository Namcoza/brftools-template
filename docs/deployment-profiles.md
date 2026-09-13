# Deployment profiles

Every project uses exactly one of two profiles. The intake checklist decides which. **Default to Cloudflare Pages** — use the P410 only when the project genuinely needs server-side compute or local persistent data.

Both profiles share the same rule: **merging to `main` deploys.** Nothing reaches production any other way.

| | Cloudflare Pages | P410 Docker |
|---|---|---|
| Use when | Output is static HTML, CSS and JavaScript | Needs a server process, PostgreSQL, Redis, background jobs or durable files |
| Built by | Cloudflare, on push | GitHub Actions, on merge to `main` |
| Release unit | Pages deployment | Container image tagged with the commit SHA |
| Pull request preview | Yes, managed by Cloudflare | No (deferred) |
| Rollback | Promote a previous deployment | Re-point at the previous image digest |
| Target rollback time | Under 10 minutes | Under 15 minutes |

---

## Profile A — Cloudflare Pages

### Files

Delete what a static site does not use:

- `Dockerfile`, `.dockerignore`, `compose.yml`
- `src/server.ts`, `src/app.ts`, `src/config.ts` and their tests, unless kept as a local dev server
- the `docker` job in `.github/workflows/ci.yml`

Keep `public/` — it is the site. `npm run build` writes it to `dist/public/`.

### Cloudflare settings

Set up once per project in the Cloudflare dashboard. Exact steps are confirmed during the Phase 2 pilot.

| Setting | Value |
|---|---|
| Production branch | `main` |
| Build command | `npm run build` |
| Output directory | `dist/public` |
| Node version | 24 (from `.nvmrc`; set `NODE_VERSION=24` if not detected) |

The Cloudflare GitHub app is granted access to **this repository only**.

### Verify and roll back

- **Verify:** the pull request shows a preview URL; after merge, the production hostname shows the change.
- **Roll back:** in Cloudflare Pages → Deployments, roll back to the last good deployment. Or revert the commit on `main` and let it redeploy.

---

## Profile B — P410 Docker

### Files

Keep everything. The template's `Dockerfile` and `compose.yml` already satisfy the container rules below.

`.github/workflows/deploy.yml` — building and publishing the image to GHCR — is added in **Phase 3** of the platform build, not by the template.

### Container rules

These are checked in review and must not be relaxed without asking:

- Health check present and passing (`GET /healthz`)
- `mem_limit` and `cpus` set in `compose.yml` — the host also runs the family's Minecraft servers
- Runs as a non-root user; `read_only`, `no-new-privileges`, all capabilities dropped
- Not `privileged`, no host networking, no Docker socket mount
- No published ports — the reverse proxy reaches the app over the shared network
- Persistent data declared as a named volume, and listed in `README.md` with its backup treatment

### How a release reaches the server

1. Merge to `main`.
2. GitHub Actions tests the code and publishes an image to GHCR, tagged with the full commit SHA.
3. The P410's deploy script pulls that image, starts it, and waits for the health check.
4. If the health check fails, the script returns to the previous image automatically.

Routing (reverse proxy and public hostname) is configured on the platform, not in this repository.

### Configuration

Real values live only on the server. The repository holds variable **names** in `.env.example`.

### Verify and roll back

- **Verify:** `GET /healthz` returns `200` with `version` equal to the merged commit SHA.
- **Roll back:** run the deploy script against the previous image digest. Database changes are not reversed by rolling back an image — follow the migration's own recovery note.
