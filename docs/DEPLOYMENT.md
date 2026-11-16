# Deployment (single VPS)

The Go server's production home after the cutover: one VPS running the server
and Postgres under Kamal, with backups going to S3-compatible object storage
(habitcraft-vxln.9). The current production setup, Cloud Run plus Cloud SQL, is
in [GCP_ARCHITECTURE.md](GCP_ARCHITECTURE.md) until the cutover
(habitcraft-vxln.10) removes it.

This guide is being built one piece at a time. The Kamal configuration and the
deploy runbook arrive with habitcraft-vxln.9.2. So far it covers the database
backups.

## Database backups

Cloud SQL came with point-in-time recovery. A VPS comes with nothing, so the
database is backed up by two scripts:

| Script | What it does |
|---|---|
| `scripts/db-backup.sh` | `pg_dump`s the database in custom format and checks that the dump reads back. It uploads it as `<prefix>habitcraft-<UTC timestamp>.dump`, for example `habitcraft/habitcraft-20261115T030000Z.dump`, then deletes all but the newest `BACKUP_KEEP` dumps. |
| `scripts/db-restore.sh` | Lists the dumps, or fetches one and restores it into an **empty** database. |

Both scripts source `scripts/db-backup-lib.sh`, so copy all three together.
They need only bash, curl 7.75 or later (for its built-in S3 signing), and the
Postgres client tools. Those tools run in the database container, so the host
needs none. `scripts/db-backup.test.sh` proves the round trip against a local
S3-compatible store; see
[TESTING.md](TESTING.md#database-backup-round-trip).

Safety properties, each covered by that test:

- **A failed run exits non-zero and never loses a backup.** A dump that
  `pg_dump` failed to write, or that does not read back, is never uploaded.
  Pruning runs only after a successful upload.
- **Pruning deletes only its own dumps.** It deletes only keys under the prefix
  named `habitcraft-<timestamp>.dump`, oldest first. Other objects in the
  bucket are left alone.
- **A restore never merges into live data.** It runs as one transaction that
  stops at the first error. Restoring over existing tables therefore fails and
  changes nothing.

### Settings

Each setting is an environment variable, so any S3-compatible provider works
(Backblaze B2, Cloudflare R2, Hetzner, Wasabi, AWS). The real bucket and keys
come from habitcraft-vxln.9.4.

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | The database, as `pg_dump` and `pg_restore` see it. Inside the database container this is `localhost`. |
| `BACKUP_S3_ENDPOINT` | The provider's S3 endpoint, e.g. `https://s3.eu-central-003.backblazeb2.com`. Requests use path-style URLs. |
| `BACKUP_S3_BUCKET` | The bucket. It must already exist. |
| `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY` | A key scoped to that bucket. It is handed to curl in a private config file, never on the command line. |
| `BACKUP_S3_REGION` | Default `us-east-1`. Some providers require their own region, e.g. `eu-central-003`; R2 uses `auto`. |
| `BACKUP_S3_PREFIX` | Key prefix, default `habitcraft/`. |
| `BACKUP_KEEP` | How many dumps to keep, 1 to 999. Default 14. |
| `PG_DUMP`, `PG_RESTORE` | The commands to run. Default `pg_dump` and `pg_restore`. |

Run the Postgres tools inside the database accessory with
`PG_DUMP="docker exec -i <db container> pg_dump"`, and the same for
`PG_RESTORE`. The data goes through stdin and stdout, so that is all it takes.
This also keeps the client version the same as the server's, which `pg_dump`
requires.

### Schedule: host cron

**Use cron on the host, not a Kamal accessory.** An accessory needs an image
that has cron, the Postgres client and an S3 client, which we would have to
build and keep patched. The host already has cron, curl and docker, and the
scripts need nothing else.

1. Copy `scripts/db-backup.sh`, `scripts/db-restore.sh` and
   `scripts/db-backup-lib.sh` to `/opt/habitcraft/bin/` on the host.
2. Write the settings to `/etc/habitcraft/backup.env`, readable only by root
   (`chmod 600`). Add one `export NAME=value` line for each setting above:

   ```bash
   export DATABASE_URL=postgresql://habituser:<password>@localhost:5432/habitcraft
   export PG_DUMP="docker exec -i habitcraft-db pg_dump"
   export PG_RESTORE="docker exec -i habitcraft-db pg_restore"
   export BACKUP_S3_ENDPOINT=https://...
   export BACKUP_S3_BUCKET=...
   export BACKUP_S3_ACCESS_KEY_ID=...
   export BACKUP_S3_SECRET_ACCESS_KEY=...
   export BACKUP_S3_REGION=...
   ```

   `habitcraft-db` is the database accessory's container name. Check it with
   `docker ps`.
3. Install the schedule with `crontab -e` as root. This runs daily at 03:17
   UTC:

   ```cron
   17 3 * * * . /etc/habitcraft/backup.env && /opt/habitcraft/bin/db-backup.sh >> /var/log/habitcraft-backup.log 2>&1
   ```

4. Run it once by hand, then check that the dump arrived:

   ```bash
   sudo bash -c '. /etc/habitcraft/backup.env && /opt/habitcraft/bin/db-backup.sh'
   sudo bash -c '. /etc/habitcraft/backup.env && /opt/habitcraft/bin/db-restore.sh --list'
   ```

A failed run is recorded only as an error in the log, so check it. Wiring
failures to an alert is a separate step.

### Restoring

`db-restore.sh` restores into an empty database and refuses anything else. To
recover production, restore into a new database and then switch the server to
it. Never restore over the database that is in use.

1. **Pick the dump.**

   ```bash
   . /etc/habitcraft/backup.env
   /opt/habitcraft/bin/db-restore.sh --list      # oldest first
   ```

2. **Create an empty database** next to the current one:

   ```bash
   docker exec habitcraft-db createdb -U habituser habitcraft_restored
   ```

3. **Restore into it.** Give either a name from the list or `latest`:

   ```bash
   DATABASE_URL=postgresql://habituser:<password>@localhost:5432/habitcraft_restored \
     /opt/habitcraft/bin/db-restore.sh latest
   ```

   A non-zero exit means nothing was restored, because the transaction rolled
   back. The message says why. If it says the target is not empty, you pointed
   it at the wrong database.

4. **Check the data:**

   ```bash
   docker exec habitcraft-db psql -U habituser -d habitcraft_restored \
     -c 'SELECT count(*) FROM users' -c 'SELECT max(version) FROM schema_migrations'
   ```

5. **Switch over.** Stop the server (`kamal app stop`). Rename the databases,
   keeping the old one until you are satisfied:

   ```bash
   docker exec habitcraft-db psql -U habituser -d postgres \
     -c 'ALTER DATABASE habitcraft RENAME TO habitcraft_old' \
     -c 'ALTER DATABASE habitcraft_restored RENAME TO habitcraft'
   ```

   Then start the server (`kamal app boot`). Drop `habitcraft_old` once the
   app is confirmed healthy.

The restore does not bring back ownership or grants (`--no-owner --no-acl`).
Every object belongs to the role in `DATABASE_URL`, so restore as the role the
server connects as.

### Restore drill

The first deploy (habitcraft-vxln.9.6) does steps 1–4 against the real
bucket. Repeat the drill after any change to the scripts, the Postgres version,
or the provider. A backup that has never been restored is not a backup.
