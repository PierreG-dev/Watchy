# Watchy

A self-hosted MongoDB backup scheduler designed to run in a single Docker
container on a Raspberry Pi 4, deployed via Coolify (or any Docker host).

Watchy connects to a MongoDB server, runs `mongodump --gzip` on a schedule
against a list of user-defined *targets* (database names), and writes the
resulting archives to a USB stick mounted on the host. It comes with a small
dark-themed web UI to manage targets, watch history, and download dumps.

## Feature summary

- Single MongoDB server, multiple databases, single set of credentials
  (with optional per-target URI override).
- Node-cron scheduler running in the same Node.js process as the Next.js
  server (no separate cron container).
- Manual "back up now" per target, or "back up all" globally.
- Retention: keeps everything for `BACKUP_RETENTION_DAYS` (default 90),
  automatically promotes the most recent successful backup of each past
  month to a permanent "monthly" copy.
- Optional SMTP notification on any run that includes at least one failure
  (a single email per run — never one per target).
- Download dumps from the browser (auth-protected stream).
- Import / export the configuration + backup index as JSON.
- Dashboard with an analog-style disk-space gauge and LED status per target.
- Session cookies signed with HS256, `HttpOnly` + `SameSite=Strict`, a 15-min
  sliding window, argon2id-hashed password, IP-based rate limiting (5 tries
  per 15 min then a 15-min lockout), CSRF header check on mutating routes.

## Getting started

### 1. Prepare the Raspberry Pi USB mount

Identify the stick:

```bash
lsblk -o NAME,SIZE,FSTYPE,LABEL,MOUNTPOINT
sudo blkid /dev/sda1
```

Create a mount point and add a durable entry to `/etc/fstab`. Use `UUID=` (not
`/dev/sda1`, which can shift between reboots) and `nofail` so a missing stick
does not block boot:

```
# /etc/fstab
UUID=XXXX-XXXX  /mnt/usb-backup  exfat  defaults,nofail,uid=1000,gid=1000,umask=022  0  0
```

Adjust the filesystem type (`ext4`, `exfat`, `ntfs`, …) to match your stick.
The `uid=1000,gid=1000` options make the mount readable/writable by the
non-root `watchy` user inside the container — they are only meaningful for
filesystems without native Unix ownership (exFAT, NTFS, FAT32).

Create the mount point and mount it:

```bash
sudo mkdir -p /mnt/usb-backup
sudo mount /mnt/usb-backup
```

### 2. Configure environment

```bash
cp .env.example .env
# Generate the password hash (asks for the password on stdin without echo):
npm install
npm run hash-password
# Paste the result as APP_PASSWORD_HASH=...
# Also generate SESSION_SECRET:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Fill in the MongoDB credentials and (optionally) the SMTP block.

### 3. Docker-compose bind mount (already set up)

`docker-compose.yml` bind-mounts the host's entire `/mnt` into the container so
Watchy can see *any* disk mounted under `/mnt` and let you pick one from the UI:

```yaml
    volumes:
      - watchy-data:/app/data
      - { type: bind, source: /mnt, target: /app/mounts, bind: { propagation: rslave } }
```

You do NOT need to edit this file when you plug in a new disk — just mount it
under `/mnt/<something>` on the host and click **Rescan** in Settings.

### 3bis. Pick the destination in the UI

After first boot, log in → **Settings** → **Backup storage** → click on the
disk you want to use. The choice is persisted in `data/db.json`. The dashboard
shows a warning banner as long as no disk is selected.

### 4. Deploy

**Coolify** — create a new *Docker Compose* application, point it at this
repository, set the environment variables via the Coolify UI (they override
`.env` inside the container), and deploy. The healthcheck at
`GET /api/healthz` is used by Coolify to mark the deployment ready.

**Plain Docker** — from the project root:

```bash
docker compose up -d --build
```

Then open <http://raspberrypi.local:3000>, log in with `APP_USERNAME` and the
password you hashed above.

## Architecture notes

- `server.js` wraps Next.js with a small Node HTTP server. The scheduler is
  started once at boot via Next's `instrumentation.ts` hook.
- `mongodump` is spawned with the URI written to a temporary 0600 YAML config
  file so the password never appears in `ps aux`.
- Data on the SD card (targets + backup index) is stored in a single
  `data/db.json` file — no native compilation dependencies, easy to back up
  or move by exporting from the UI.
- The Docker image installs `mongodb-database-tools` from the official
  `ubuntu2204-arm64` build for arm64 hosts (works on Debian 12 too) and the
  `ubuntu2204-x86_64` build for amd64 dev machines.

## Retention policy in detail

After every backup run (manual or scheduled):

1. Successful backups are grouped by database name and calendar month
   (`YYYY-MM`).
2. For each **past** month with no protected backup, the most recent
   successful run is marked as `protected` — the "monthly permanent" copy.
   Working from the group (rather than "the last day of the month") tolerates
   missed cron slots.
3. Non-protected backups older than `BACKUP_RETENTION_DAYS` (default 90) are
   deleted — both the record and the file on disk.

## Security notes

- Read-only browser sessions still require the CSRF header on all mutating
  API calls; combined with `SameSite=Strict`, a cross-site form POST cannot
  hit any protected route.
- The web UI is the *only* interface to the file system on the host: no
  arbitrary path parameters, downloads look up backups by ID and refuse any
  resolved path that escapes `BACKUP_DIR`.
- The container runs as UID 1000 (`watchy`), not root.
- The password is stored only as an argon2id hash (hex `salt:hash` format, no
  `$` so env-var interpolation can't corrupt it). Rate limiting locks out
  the offending IP for 15 minutes after 5 failed attempts.

## Out of scope

- No `mongorestore` — restoring is deliberately a manual, off-tool operation.
- No multi-user support.
- No encryption of dump files at rest (protect the USB stick itself).
