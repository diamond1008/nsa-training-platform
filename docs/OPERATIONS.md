# Operations runbook

## Health and logs

- `/health` confirms the process is alive; `/ready` also verifies PostgreSQL.
- API logs are JSON in staging/production. Container logs rotate at 10 MB with three files.
- Investigate elevated 5xx counts, readiness failures, and sustained response latency. The API includes a request ID on its structured request log.

Useful commands (prefix all Compose commands with `--env-file .env.production -f compose.production.yaml`):

```sh
docker compose --env-file .env.production -f compose.production.yaml ps
docker compose --env-file .env.production -f compose.production.yaml logs --since 30m api caddy postgres
docker compose --env-file .env.production -f compose.production.yaml exec postgres \
  sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

## Backup

Backups contain personal data. Encrypt them, restrict access, define retention, and test restoration regularly.

```sh
mkdir -p backups
docker compose --env-file .env.production -f compose.production.yaml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl' \
  > "backups/nsa-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_restore --list backups/nsa-YYYYMMDDTHHMMSSZ.dump >/dev/null
```

Move the dump to encrypted off-host storage, verify checksum and size, then remove the unencrypted local copy according to policy.

## Restore rehearsal

Restore into an empty, isolated database first. Never test a restore over production.

```sh
docker compose --env-file .env.production -f compose.production.yaml exec -T postgres \
  sh -c 'createdb -U "$POSTGRES_USER" nsa_restore_test'
docker compose --env-file .env.production -f compose.production.yaml exec -T postgres \
  sh -c 'pg_restore -U "$POSTGRES_USER" -d nsa_restore_test --clean --if-exists --no-owner --no-acl' \
  < backups/nsa-YYYYMMDDTHHMMSSZ.dump
docker compose --env-file .env.production -f compose.production.yaml exec -T postgres \
  sh -c 'psql -U "$POSTGRES_USER" -d nsa_restore_test -c "SELECT COUNT(*) FROM goose_db_version;"'
```

Delete the rehearsal database after verification. For a production restore, stop API writes, preserve the failed database, record the incident timeline, restore into a new database, validate counts/health, then switch the API connection.

## Read-path load smoke test

Against a non-production environment with a dedicated student account:

```sh
export LOADTEST_EMAIL=loadtest-student@example.invalid
export LOADTEST_PASSWORD='from-secret-store'
cd apps/api
go run ./cmd/loadtest -base-url https://staging.example.com/api/v1 -requests 500 -concurrency 20
```

The command fails on any non-2xx response and reports total duration and p95 latency. It never prints credentials or access tokens.
