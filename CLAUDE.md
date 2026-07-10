# WATCHY — map

Self-hosted MongoDB backup app. Next.js 14 App Router + custom server + node-cron. Docker on RPi 4 arm64 via Coolify. Dumps → USB stick bind-mount.

## Stack
- Next 14.2 App Router, TS strict, React 18
- Tailwind, lucide-react, tailwind-merge, clsx
- jose (JWT), hash-wasm (argon2id), mongodb driver
- node-cron, nodemailer, check-disk-space
- **No native deps** (arm64 safe). No SQLite. No bcrypt.
- Storage = single JSON file `${DATA_DIR}/db.json`

## Boot flow
1. `server.js` (JS, root) wraps `next()` in a bare http server
2. Next's `instrumentation.ts` (root) → `startScheduler()` + `warnIfSmtpDisabled()`
3. Scheduler = `node-cron` schedules `runAllTargets` on `BACKUP_CRON`

## File map (only what's non-obvious)

### `lib/`
- `env.ts` — **lazy getters** (build-time safe). `isProd()`, `smtpEnabled()`, `defaultMongoConfigured()` are **functions not consts**
- `session.ts` — JWT HS256, cookie `watchy_session`, **15 min sliding**, `requireSession()` re-issues cookie every call. Uses `next/headers` cookies → route handlers only, NOT edge
- `password.ts` — argon2id via hash-wasm. `hashPassword`, `verifyPassword`, `timingSafeStringEqual`
- `rate-limit.ts` — in-memory Map, 5 tries / 15min → 15min lockout
- `storage.ts` — JSON DB, atomic writes (tmp + rename, 0600), serial write queue. Types: `Target`, `BackupRun`. `newId(prefix)` returns `<prefix>_<base64url>`
- `mongo.ts` — `buildUri(target)` (URL-encodes creds, respects `customUri`), `testConnection`
- `mongodump.ts` — spawns `mongodump`, **URI passed via 0600 YAML temp file** (never argv). Output = `${BACKUP_DIR}/<db>/<db>_<iso>.gz`
- `retention.ts` — group success by db+YM, protect most-recent of each past month, delete non-protected > `BACKUP_RETENTION_DAYS`. `deleteBackupWithFile()` has path traversal guard
- `runner.ts` — `runTargetById`, `runAllTargets`, `runningTargetIds()` (in-memory Set). Runs **serial** (RPi + one USB). Calls retention + mailer after run
- `mailer.ts` — nodemailer. Single email per failed run. No-op if SMTP not configured
- `scheduler.ts` — starts once, `startScheduler()` guarded by `started` flag
- `disk.ts` — `check-disk-space` on `BACKUP_DIR`
- `http.ts` — `json()`, `errorResponse()`, `getClientIp()` (x-forwarded-for → x-real-ip → 'unknown')
- `ui/{cn,fetcher,format}.ts` — `apiFetch` auto-adds `X-Watchy-CSRF: 1` on non-GET

### `middleware.ts` (EDGE runtime)
- **Cannot import from `lib/*`** (uses node:path/fs). Uses `jose` + `process.env` directly
- Public paths: `/login`, `/api/auth/login`, `/api/healthz`, `/_next/*`, favicon
- Rejects mutations without `X-Watchy-CSRF: 1` header (defense in depth on top of SameSite=Strict)
- Sets X-Content-Type-Options / X-Frame-Options: DENY / Referrer-Policy: no-referrer

### `app/api/`
- `auth/login` POST — rate-limit → timingSafeStringEqual(user) + argon2Verify(pw) → sets cookie
- `auth/logout` POST
- `targets` GET/POST, `targets/[id]` GET/PATCH/DELETE, `targets/[id]/test` POST, `targets/[id]/backup` POST
- `backups` GET (filters: `targetId`, `dbName`), `backups/[id]` DELETE (refuses `protected` and `running`), `backups/[id]/download` GET (streams file, ID lookup, path guard)
- `backups/run` POST (all)
- `config/export` GET, `config/import` POST (`{payload, mode: 'merge'|'replace'}`)
- `status` GET — dashboard aggregate
- `healthz` GET — public
- All protected routes call `requireSession()` first. `export const dynamic = 'force-dynamic'`

### `app/`
- `layout.tsx` — loads Inter + JetBrains Mono from Google Fonts
- `login/page.tsx` — wrapped in `<Suspense>` (useSearchParams)
- `page.tsx` dashboard, `targets/`, `history/`, `settings/` — all `'use client'`, poll or fetch on mount

### `components/`
- `AppShell` — sidebar desktop / top-nav mobile
- `LED` — status dot with pulse animation (`animate-pulse-led` keyframe in tailwind config)
- `DiskGauge` — SVG analog dial (needle rotates -90°→+90°, zones ok/warn/crit)
- `Panel`, `Button` (variants: primary/ghost/subtle/danger), `Input`+`Textarea`+`Label`, `Modal`

## Env vars (see `.env.example`)
Required at runtime: `APP_USERNAME`, `APP_PASSWORD_HASH` (argon2id encoded), `SESSION_SECRET` (hex, ≥48 bytes)
Storage: `DATA_DIR` (small, SD card volume), `BACKUP_DIR` (bind mount to USB — the ONLY path the app writes dumps to)
Mongo defaults: `MONGO_HOST/PORT/USERNAME/PASSWORD/AUTH_SOURCE/EXTRA_OPTIONS`. Overridden per-target by `customUri`.
Schedule: `BACKUP_CRON`, `BACKUP_RETENTION_DAYS`, `TZ`
SMTP (all optional): `SMTP_HOST/PORT/SECURE/USER/PASS/FROM/TO`. `SMTP_HOST` empty → notifications silently disabled.

## Docker
- `Dockerfile` multi-stage node:20-bookworm-slim
- `mongodump` installed from **fastdl.mongodb.org** `mongodb-database-tools-ubuntu2204-<arch>-100.10.0.deb`. Arch detected via `uname -m` (aarch64/arm64 → ubuntu2204-arm64, x86_64 → ubuntu2204-x86_64). **No debian12-arm64 build exists** — ubuntu2204-arm64 is glibc-compatible with bookworm.
- Non-root user `watchy` UID/GID 1000 (matches typical Pi user, required for exFAT/NTFS uid= mount option)
- `tini` as PID 1
- HEALTHCHECK hits `/api/healthz`
- `docker-compose.yml`: volume `watchy-data` for `/app/data`, **bind mount `/mnt/usb-backup:/app/backups`** — user MUST adapt host path

## Security invariants (do not break)
- Password: argon2id only, hash in env, never plaintext
- Session: HttpOnly + SameSite=Strict + Secure(prod). No "remember me". 15 min sliding.
- CSRF: middleware requires `X-Watchy-CSRF: 1` on mutations. `apiFetch` adds it automatically.
- Rate limit: login only, per IP (x-forwarded-for first)
- `mongodump` URI → never in argv, always via temp `--config=` YAML 0600
- File access: NEVER accept a path from URL. Look up by ID → resolve within `BACKUP_DIR` → refuse if outside
- Container non-root
- No file system access outside `BACKUP_DIR` + `DATA_DIR`
- No restore endpoint (out of scope)

## Design system (dark only)
- Colors: `bg-base #12151A`, `bg-panel #1A1F27`, `bg-raised #20262F`, `bg-border #262D38`, `fg #E7ECF2`, `fg-muted #8B95A5`, `fg-faint #5A6472`, `accent-{cyan,green,amber,red}`
- Fonts: `font-sans` = Inter (prose), `font-mono` = JetBrains Mono (data: db names, sizes, timestamps, cron)
- Signatures: analog SVG disk gauge, LED with pulse for running state, grid bg on login
- No emojis. Focus ring = cyan. Sparing animation.

## Scripts
- `npm run dev` / `start` — both via `server.js` (custom server)
- `npm run build` — `next build`
- `npm run hash-password` — `scripts/hash-password.js`, prompts stdin no-echo, outputs argon2id encoded string

## Gotchas
- `env.ts` uses **getters**; call as `env.FOO` not `env.FOO()`. Feature flags ARE functions: `smtpEnabled()`.
- Middleware is Edge — never import `lib/*` from it
- `useSearchParams` needs Suspense boundary (already done in login)
- `next.config.js`: `experimental.instrumentationHook: true` (needed on Next 14), `serverComponentsExternalPackages: ['mongodb', 'nodemailer']`
- Storage cache is per-process — safe because single container / single process
- `runningTargetIds` is in-memory; a container restart mid-run leaves stale `status:'running'` rows (acceptable; user can delete)
- Dashboard polls `/api/status` every 5s → session cookie extended continuously while a tab is open (by design)

## Out of scope
No restore. No multi-user. No dump encryption. No PWA/offline. No i18n.
