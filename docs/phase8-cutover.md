# Command v3 Phase 8 production cutover

This is the operator runbook for the first Command v3 production release. It
implements the ordering in ADR 0003. It does not authorize a release: do not run
anything labelled **production** or **external write** until the owner explicitly
authorizes production access and the cutover.

The original starting state for this runbook was a Phase 4 public site and
production migrations through `0012` only.

## Current recovery checkpoint — 2026-09-03

The export, maintenance, migration, idempotent backfill, verification, and both
function stages have now passed. Production has migrations `0013`–`0037`, the
verified canonical backfill, and both v3 Edge Functions. The first frontend
candidate failed owner visual acceptance before any v3 canonical user write, so
the public alias was restored to exact Phase 4 deployment
`dpl_5kno5iFZBxZh7ArWRV55bQMqZAwH` from `e2d5d15`. Legacy tables are intact,
the maintenance window has ended, and the private encrypted export/cutover
record remain outside the repository.

For the corrected frontend release, restart at the safe local release gate with
a new immutable commit. Do not rerun already-applied migrations or the backfill
merely to publish CSS/React changes. First obtain owner visual acceptance on the
new Vercel candidate, then explicit authorization to move the public alias.
Resume the smoke sequence at authenticated read-only checks and record the first
successful v3 canonical write as the fix-forward boundary. Keep MCP clients
idle until that sequence passes.

## Safety properties

- Take and verify the encrypted production export before the first migration.
- Keep the decrypted dump and all reports outside the repository in a private
  directory on an encrypted local volume. Never upload them as CI artifacts.
- Use one release SHA for migrations, functions, and the frontend.
- Keep the Phase 4 frontend live while migrations and the backfill are checked.
- Run the backfill twice inside one serializable transaction. Any failed
  assertion rolls the transaction back.
- Do not deploy functions until the backfill report passes.
- Do not make a v3 canonical write until authenticated read-only smoke checks
  pass. Record the first successful write as the fix-forward boundary.
- Do not edit an applied migration or remove a legacy table. A database problem
  is repaired with the next append-only migration.

## Command boundary

The labels below are part of the procedure.

| Label | Effect | Examples |
|---|---|---|
| **Safe local** | Reads or verifies only the local checkout/local services | Git status/diff, tests, typecheck, build, local database tests/lint |
| **Production read** | Authenticates to or reads production without changing it | `supabase link`, migration/secret listing, pre-migration report, database dump, aggregate monitoring queries, public HTTP smoke |
| **Production write** | Changes the production database, auth configuration, or Edge Functions | migration workflow, backfill SQL, function workflow |
| **External write** | Changes GitHub/Vercel state | pushing `command-v3`, pushing `main`, promoting or restoring a Vercel deployment |

No production or external command in this document is a safe local
verification command. `git push origin main` is also the frontend production
deployment trigger. A branch push may create a Vercel preview, but must not move
the production alias.

## 1. Safe local release gate

Remain on `command-v3`. These commands must all pass before requesting or using
cutover authorization:

```bash
git switch command-v3
git status --short --branch
git diff --check
npm test
npx tsc -b
npm run build
npm run test:e2e
npm run test:db
npx supabase db lint --local --level warning
deno check --no-config --no-lock supabase/functions/google-calendar/index.ts
deno check --config supabase/functions/deno.json --no-lock \
  supabase/functions/command-mcp/index.ts
psql --version
openssl version
```

Record the full release commit locally. It must not change for the rest of the
cutover:

```bash
COMMAND_RELEASE_SHA="$(git rev-parse HEAD)"
test "$(git branch --show-current)" = "command-v3"
test -z "$(git status --porcelain)"
test "$(git rev-parse "$COMMAND_RELEASE_SHA^{commit}")" = "$COMMAND_RELEASE_SHA"
```

Confirm that the workflow has two independent stages and that the release is a
fast-forward of the production branch:

```bash
git merge-base --is-ancestor main "$COMMAND_RELEASE_SHA"
git diff --check main..."$COMMAND_RELEASE_SHA"
rg -n "stage:|migrations|functions|release_sha" .github/workflows/deploy-supabase.yml
```

Stop if any command fails. Do not solve a failed gate during the maintenance
window unless it is genuinely environment-specific.

## 2. Authorization and private record

After explicit production-cutover authorization, create a private cutover
record containing:

- release SHA and authorization time;
- maintenance start/end time in `Asia/Kolkata`;
- encrypted backup path, byte size, and SHA-256;
- migration and function workflow run URLs;
- pre-migration and post-backfill reports;
- Vercel deployment URL and deployed commit;
- every smoke result, the first successful v3 write time, and any incident.

Do not put this record, production UUIDs, downloaded exports, tokens, database
URLs, or screenshots containing personal data in Git, GitHub Actions logs, an
issue, or a pull request.

## 3. Encrypted export gate

Everything in this section is a **production read** and requires the explicit
authorization. Run it from the verified checkout on the operator's encrypted
machine, not in GitHub Actions.

Use the repository-pinned Supabase CLI (`2.115.0`). Enter secrets at hidden
prompts so they do not enter shell history or process arguments:

```bash
printf 'Supabase project ref: '
IFS= read -r COMMAND_SUPABASE_PROJECT_REF
printf 'Supabase access token: '
IFS= read -r -s SUPABASE_ACCESS_TOKEN
printf '\n'
printf 'Production database password: '
IFS= read -r -s SUPABASE_DB_PASSWORD
printf '\n'
export SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD
```

Use the direct database connection by default. If the operator network cannot
reach the direct host, copy the non-secret pooler host, port, and user from the
Supabase Connect panel instead; never copy a URL containing the password:

```bash
COMMAND_PRODUCTION_DB_HOST="db.$COMMAND_SUPABASE_PROJECT_REF.supabase.co"
COMMAND_PRODUCTION_DB_PORT="5432"
COMMAND_PRODUCTION_DB_USER="postgres"
```

Choose an absolute location outside the checkout. The location itself should be
on FileVault or another encrypted volume. The archive is encrypted again before
plaintext is removed:

```bash
COMMAND_REPO_ROOT="$(git rev-parse --show-toplevel)"
COMMAND_CUTOVER_ID="$(date -u +%Y%m%dT%H%M%SZ)"
COMMAND_CUTOVER_DIR="/absolute/private/path/command-v3-$COMMAND_CUTOVER_ID"
case "$COMMAND_CUTOVER_DIR/" in
  "$COMMAND_REPO_ROOT/"*) echo "Cutover data must be outside the repository" >&2; exit 1 ;;
esac
umask 077
mkdir -p "$COMMAND_CUTOVER_DIR"
chmod 700 "$COMMAND_CUTOVER_DIR"
```

Linking stores only ignored CLI metadata locally. It does not modify the remote
database, but it does authenticate to production:

```bash
SUPABASE_TELEMETRY_DISABLED=1 npx supabase link \
  --project-ref "$COMMAND_SUPABASE_PROJECT_REF"
SUPABASE_TELEMETRY_DISABLED=1 npx supabase migration list --linked \
  > "$COMMAND_CUTOVER_DIR/migration-list-before.txt"
SUPABASE_TELEMETRY_DISABLED=1 npx supabase secrets list \
  --project-ref "$COMMAND_SUPABASE_PROJECT_REF" \
  > "$COMMAND_CUTOVER_DIR/function-secret-names.txt"
```

Stop unless remote migration history ends at `0012`, local history continues
contiguously through `0037`, and the secret-name list contains
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_KEY`, and `APP_ORIGIN`.
The list cannot verify secret values; verify `APP_ORIGIN` in the Supabase
dashboard without copying it into the cutover record. A Calendar smoke test is
the value-level check for the exact 32-byte `GOOGLE_TOKEN_KEY`.

Capture the bounded count report, then dump the complete `public` schema and
its data. Redirection keeps the report out of terminal/transcript logs:

```bash
PGPASSWORD="$SUPABASE_DB_PASSWORD" PGSSLMODE=require \
  psql --no-psqlrc --set ON_ERROR_STOP=1 \
  --host "$COMMAND_PRODUCTION_DB_HOST" \
  --port "$COMMAND_PRODUCTION_DB_PORT" \
  --username "$COMMAND_PRODUCTION_DB_USER" --dbname postgres \
  --file supabase/cutover/phase8-pre-migration-check.sql \
  > "$COMMAND_CUTOVER_DIR/command-v3.production-report.txt"
SUPABASE_TELEMETRY_DISABLED=1 npx supabase db dump --linked \
  --schema public \
  --file "$COMMAND_CUTOVER_DIR/command-v3.production-schema.sql"
SUPABASE_TELEMETRY_DISABLED=1 npx supabase db dump --linked \
  --schema public --data-only --use-copy \
  --file "$COMMAND_CUTOVER_DIR/command-v3.production-data.sql"
test -s "$COMMAND_CUTOVER_DIR/command-v3.production-schema.sql"
test -s "$COMMAND_CUTOVER_DIR/command-v3.production-data.sql"
```

Bundle and encrypt with AES-256-CBC and PBKDF2. OpenSSL prompts for the
passphrase; use a unique passphrase held separately from the archive. Do not use
`-pass env:...`, `-k`, or a command-line password:

```bash
tar -C "$COMMAND_CUTOVER_DIR" -cf \
  "$COMMAND_CUTOVER_DIR/command-v3.production-backup.tar" \
  migration-list-before.txt function-secret-names.txt \
  command-v3.production-report.txt command-v3.production-schema.sql \
  command-v3.production-data.sql
shasum -a 256 "$COMMAND_CUTOVER_DIR/command-v3.production-backup.tar" \
  > "$COMMAND_CUTOVER_DIR/plaintext.sha256"
openssl enc -aes-256-cbc -salt -pbkdf2 -iter 600000 -md sha256 \
  -in "$COMMAND_CUTOVER_DIR/command-v3.production-backup.tar" \
  -out "$COMMAND_CUTOVER_DIR/command-v3.production-backup.enc"
chmod 600 "$COMMAND_CUTOVER_DIR/command-v3.production-backup.enc"
shasum -a 256 "$COMMAND_CUTOVER_DIR/command-v3.production-backup.enc" \
  > "$COMMAND_CUTOVER_DIR/command-v3.production-backup.enc.sha256"
```

Verify both encryption and byte-for-byte recovery before removing plaintext:

```bash
shasum -a 256 -c \
  "$COMMAND_CUTOVER_DIR/command-v3.production-backup.enc.sha256"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -md sha256 \
  -in "$COMMAND_CUTOVER_DIR/command-v3.production-backup.enc" \
  -out "$COMMAND_CUTOVER_DIR/verified.tar"
cmp -s "$COMMAND_CUTOVER_DIR/command-v3.production-backup.tar" \
  "$COMMAND_CUTOVER_DIR/verified.tar"
tar -tf "$COMMAND_CUTOVER_DIR/verified.tar"
```

The five expected members must be listed. Keep the encrypted archive and its
checksum in the approved private backup location. Remove only these resolved
plaintext files after the checks pass:

```bash
rm -f \
  "$COMMAND_CUTOVER_DIR/migration-list-before.txt" \
  "$COMMAND_CUTOVER_DIR/function-secret-names.txt" \
  "$COMMAND_CUTOVER_DIR/command-v3.production-report.txt" \
  "$COMMAND_CUTOVER_DIR/command-v3.production-schema.sql" \
  "$COMMAND_CUTOVER_DIR/command-v3.production-data.sql" \
  "$COMMAND_CUTOVER_DIR/command-v3.production-backup.tar" \
  "$COMMAND_CUTOVER_DIR/plaintext.sha256" \
  "$COMMAND_CUTOVER_DIR/verified.tar"
git status --short
```

Stop if the dump, encryption, decryption, checksum, archive listing, permissions,
or final clean-worktree check fails. No migration may run without this gate.

## 4. Maintenance window

After the export passes, announce the short single-user maintenance window and
record its start in `Asia/Kolkata`. Close every Command tab and installed PWA,
do not use Calendar actions, and disconnect/idle every MCP client. The Phase 4
site may remain publicly reachable because there is one owner; the operational
rule is that the owner performs no writes until the window ends.

If that cannot be guaranteed, stop. Do not substitute compatibility writes or
run the backfill against a moving source dataset.

## 5. Publish the immutable release ref

This is an **external write**, but it does not move the production alias. Recheck
the immutable SHA and push only the cutover branch:

```bash
test "$(git branch --show-current)" = "command-v3"
test -z "$(git status --porcelain)"
test "$(git rev-parse HEAD)" = "$COMMAND_RELEASE_SHA"
git push origin command-v3
```

Confirm in GitHub that `command-v3` resolves to `COMMAND_RELEASE_SHA`. Do not
open or authenticate to any automatically created preview deployment yet.

## 6. Apply migrations only

This workflow dispatch is a **production write**. It performs a dry run and then
applies pending migrations; it cannot deploy functions:

```bash
gh workflow run deploy-supabase.yml \
  --ref command-v3 \
  -f stage=migrations \
  -f release_sha="$COMMAND_RELEASE_SHA" \
  -f backup_verified=true \
  -f backfill_verified=false
gh run list --workflow deploy-supabase.yml --branch command-v3 \
  --event workflow_dispatch --limit 5
gh run watch <migration-run-id> --exit-status
```

Approve the `production` GitHub environment only after confirming the displayed
SHA and `migrations` stage. Save the run URL in the private record. Stop on a
failed or cancelled job.

This verification is a **production read**:

```bash
SUPABASE_TELEMETRY_DISABLED=1 npx supabase migration list --linked \
  > "$COMMAND_CUTOVER_DIR/migration-list-after.txt"
```

Every local and remote migration must now match through `0037`, with no remote-
only or missing entry. A mismatch blocks the backfill.

## 7. Backfill and verification gate

The following is a **production write**. It locks the legacy sources against
concurrent writes, runs the service-only backfill twice in one serializable
transaction, checks exact JSON and CSV compatibility, counts, dated commitment
mappings, provenance, same-owner relationships, Calendar relinking, and legacy
source immutability, and commits only if every assertion passes:

```bash
PGPASSWORD="$SUPABASE_DB_PASSWORD" PGSSLMODE=require \
  psql --no-psqlrc --set ON_ERROR_STOP=1 \
  --host "$COMMAND_PRODUCTION_DB_HOST" \
  --port "$COMMAND_PRODUCTION_DB_PORT" \
  --username "$COMMAND_PRODUCTION_DB_USER" --dbname postgres \
  --file supabase/cutover/phase8-backfill-and-verify.sql \
  > "$COMMAND_CUTOVER_DIR/post-backfill.production-report.txt"
test -s "$COMMAND_CUTOVER_DIR/post-backfill.production-report.txt"
```

Read the private report. It must show one owner, `exact_json_match: true`, equal
source/mapped/compatibility counts for every source, expected commitment and
migration-event counts, and zero pending Calendar links. If the command fails,
the backfill transaction rolls back; do not deploy functions or the frontend.

Encrypt the post-migration reports before moving them off the encrypted operator
volume. Reports contain only bounded counts, but they remain private operational
records.

## 8. Deploy Edge Functions

This workflow dispatch is a **production write**. It enables the already
approved OAuth-server settings and deploys both functions with
`--no-verify-jwt`; it cannot apply migrations:

```bash
gh workflow run deploy-supabase.yml \
  --ref command-v3 \
  -f stage=functions \
  -f release_sha="$COMMAND_RELEASE_SHA" \
  -f backup_verified=true \
  -f backfill_verified=true
gh run list --workflow deploy-supabase.yml --branch command-v3 \
  --event workflow_dispatch --limit 5
gh run watch <function-run-id> --exit-status
```

Approve only the `functions` stage at the same release SHA. Save the run URL.
Do not call the MCP or Calendar write paths until the frontend is ready to
review their results.

## 9. Release the frontend

Fetch first. If `origin/main` moved from the locally reviewed `main`, stop and
review the new commits; do not force-push or merge around drift.

The final `git push` below is an **external write** and the Vercel production
deployment trigger:

```bash
git fetch origin
test "$(git rev-parse origin/main)" = "$(git rev-parse main)"
git switch main
git merge --ff-only "$COMMAND_RELEASE_SHA"
test "$(git rev-parse HEAD)" = "$COMMAND_RELEASE_SHA"
git push origin main
git switch command-v3
```

Wait for CI and the Vercel production deployment to succeed. In Vercel, confirm
the deployment source is exactly `COMMAND_RELEASE_SHA`, then confirm
`https://command-beta-flax.vercel.app/` resolves to it. If the Git integration
does not move the previously restored alias automatically, promoting this exact
successful deployment in the Vercel dashboard is a separate **external write**.

## 10. Production smoke tests

Keep the maintenance window active. Record pass/fail and time for every item.
Use a unique title such as `Phase 8 smoke <UTC timestamp>` so every test record
is attributable and can be archived without hard deletion.

### Read-only gate — rollback is still available

Before any v3 canonical write:

1. Load the app and PWA manifest over HTTPS; confirm no fatal browser-console or
   network errors.
2. Sign in with the allow-listed Google owner and confirm a non-owner cannot
   create an account.
3. Confirm Today loads floors, weekly 15/2 progress, and the bounded due queue.
4. Open Due, Week, Run, every seeded Browse type, one Item, and Settings.
5. Confirm legacy-derived entities, dated commitments, and provenance are
   present and the private post-backfill counts agree with the UI/export totals.
6. Sign out and back in; confirm session restoration and sign-out behavior.

If this gate fails, make no v3 write. The Phase 4 deployment may be restored in
Vercel while the additive database stays in place. Record the incident and use
the fix-forward matrix below.

### Write gate — crossing the fix-forward boundary

1. Capture one smoke project with an allowed deadline commitment. Confirm it in
   Browse, Due, Item, and its UI provenance. Record this save as the **first v3
   canonical write**; Phase 4 frontend rollback is no longer safe after it.
2. Record an Outcome on that commitment, verify the outcome/provenance, then
   schedule a replacement deadline for the same smoke project.
3. In Calendar, connect or verify the Google account, export the eligible smoke
   deadline, resync it and confirm no duplicate event, then close the commitment
   and confirm the link/event is removed. Disconnect only if that matches the
   pre-cutover state.
4. Authorize a test MCP client with types/data/proposal grants but without people
   data. Confirm people are excluded, create a uniquely named note proposal,
   verify it is absent from Browse before approval, approve it in Agent inbox,
   and verify MCP source/client provenance afterward. Revoke the test client.
5. Download canonical JSON and every seeded type CSV. Confirm each opens, has
   the expected header/schema, and includes the known smoke/legacy records.
   Store or destroy these exports privately; never add them to the repository.
6. Exercise the PWA update prompt once with no form open and once with an active
   draft. Confirm the active form/draft survives the prompt and refresh path.
7. Verify visibility refresh after the MCP proposal, offline cached reads,
   explicit offline write refusal, and retained draft recovery.
8. Archive the smoke project and approved smoke note. Do not hard-delete audit
   evidence. Sign out, then complete one final owner sign-in and Today load.

## 11. Fix-forward matrix

| Failure point | Required response |
|---|---|
| Export/encryption verification | Stop; no migration has run. Repair the private backup process and repeat it. |
| Migration workflow | Keep Phase 4 live and maintenance active. Inspect which additive migrations committed. Never edit an applied file; add the next migration for a schema correction, verify locally, and rerun the migration stage. |
| Backfill/verification SQL | The serializable transaction rolls back. Keep Phase 4 live, save only bounded diagnostics privately, correct with append-only SQL if needed, and rerun the whole backfill gate. |
| Function deployment | Keep Phase 4 live. Fix and redeploy the failed function stage at a new reviewed SHA; do not expose MCP/Calendar writes meanwhile. |
| Frontend build or read-only smoke before first v3 write | Restore the Phase 4 Vercel deployment, leave additive schema/backfill intact, and fix forward. Keep MCP clients idle until v3 returns. |
| Any failure after the first v3 canonical write | Do not restore Phase 4 and do not destructively roll back the database. Keep maintenance active, preserve legacy tables, and ship a tested forward code/function/append-only migration fix. |

Never run `git push --force`, `supabase db reset`, a down migration, `DROP`,
`TRUNCATE`, or production restore as part of ordinary incident handling.

## 12. Stabilisation and closeout

End the maintenance window only after all smoke tests pass. Then monitor at
T+1 hour, T+24 hours, and T+48 hours:

- Vercel deployment/runtime errors and service-worker behavior;
- Supabase Postgres/Auth/Edge Function errors and rate limits;
- Calendar account/link health and duplicate/unlinked events;
- failed MCP calls, proposal decisions, and application permissions;
- unexpected provenance sources, count drift, or cross-owner/RLS failures.

Use aggregate queries only in terminal output; redirect any detailed diagnostics
to the private cutover directory. Keep legacy tables unchanged for this release
and at least one separately approved stable release afterward.

At T+48 hours, if there is no unexplained error or data mismatch, update the
living plan with real production evidence and complete only the Phase 8 items
that passed. Legacy frontend removal and any later data cleanup remain separate,
reviewed work; cleanup always needs a new append-only migration and explicit
authorization.

Finally unset production credentials from the operator shell:

```bash
unset SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD
```
