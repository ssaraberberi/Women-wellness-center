# Website → app import: dry-run runbook

The importer (`npm run import:website`, code in `src/import/website.ts`) moves the old
website's clients, packages, offers, reservations, payments and bookings into the app
database (Railway). This runbook covers the **dry run only**: nothing is written anywhere.

## What the dry run guarantees

- The website database is opened with `default_transaction_read_only = on`; in a dry run
  the app database is too. Postgres itself refuses any write.
- With the read-only roles below, the database user cannot write even if the script tried.
- Connection strings are never printed — only `host:port/database`.
- The output (`report.md`, `report.json`) contains client names, phones and amounts:
  keep it on your machine, do not upload or send it, delete it after review.

## Option A — recommended: a full rehearsal on copies

Nothing touches production except one read (`pg_dump`) each. The dry run — and even a
test apply with reconciliation — then runs against local copies.

```powershell
# 1. Copies (prompts for each URL without showing it)
$w = Read-Host 'Website DB URL (Neon, direct — not "-pooler")' -AsSecureString
$a = Read-Host 'App DB URL (Railway public URL)' -AsSecureString
$plain = { param($s) [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)) }
pg_dump --no-owner --no-privileges -Fc -f website.dump (& $plain $w)
pg_dump --no-owner --no-privileges -Fc -f app.dump (& $plain $a)
Remove-Variable w, a

# 2. Restore into the local Postgres (port 5433, from `npm run dev:db`)
createdb -h localhost -p 5433 -U dua dua_website_copy
createdb -h localhost -p 5433 -U dua dua_app_copy
pg_restore --no-owner -h localhost -p 5433 -U dua -d dua_website_copy website.dump
pg_restore --no-owner -h localhost -p 5433 -U dua -d dua_app_copy app.dump

# 3. Bring the app copy to the new schema, then dry run
cd backend
$env:DATABASE_URL = 'postgresql://dua:dua@localhost:5433/dua_app_copy'
npx prisma migrate deploy
$env:WEBSITE_DATABASE_URL = 'postgresql://dua:dua@localhost:5433/dua_website_copy'
npm run import:website -- --out ..\import-report

# 4. (optional) rehearse the apply on the copy, with reconciliation
npm run import:website -- --apply --actor <admin email> --confirm localhost:5433/dua_app_copy --out ..\import-report
```

Delete `website.dump`, `app.dump`, the copies and `import-report\` when done.

## Option B — dry run directly against production, read-only

### 1. A read-only user on each database (run as the owner, once)

Website database (Neon SQL editor):

```sql
CREATE ROLE dua_import_ro WITH LOGIN PASSWORD '<a long random password>';
GRANT CONNECT ON DATABASE <website database name> TO dua_import_ro;
GRANT USAGE ON SCHEMA public TO dua_import_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO dua_import_ro;
ALTER ROLE dua_import_ro SET default_transaction_read_only = on;
```

App database (Railway → Postgres → Data → Query), the same with `railway` as the database.

Use Neon's **direct** connection string (host without `-pooler`) and Railway's **public**
URL, each with the `dua_import_ro` user and password.

### 2. Run it (prompts without echo; nothing goes into your shell history)

```powershell
cd backend
$plain = { param($s) [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)) }
$env:WEBSITE_DATABASE_URL = & $plain (Read-Host 'Website DB URL (read-only user)' -AsSecureString)
$env:DATABASE_URL = & $plain (Read-Host 'App DB URL (read-only user)' -AsSecureString)
npm run import:website -- --out ..\import-report
Remove-Item Env:WEBSITE_DATABASE_URL, Env:DATABASE_URL
```

The app database does not need the new migrations for a dry run.

### 3. Afterwards

```sql
DROP ROLE dua_import_ro;   -- on both databases
```

## Reading the report

`import-report\report.md`:

| Section | Meaning |
|---|---|
| **Blocking** | The import refuses to run until each is decided (unlimited or non-Reformer packages, upcoming classes with no app class at the same minute, over-full classes, double bookings, a cancelled-but-paid reservation, a negative balance). |
| **For review** | Imported, and flagged for the desk: same phone or unverified same email as an app client (kept separate, never merged). |
| **Per client** | Credits left, amount owed, amount paid and upcoming classes: after the import the app must show exactly these. |

Send back only the **Summary** and the **Blocking** list (or their counts) — not the per-client table.

## Not part of the dry run

Applying to production needs, in order and each with explicit approval: a Railway backup,
the API deployed with the new migrations, the old `/book` set read-only, the apply with
`--confirm <host>/<database>`, the automatic reconciliation passing, then the `/book` switch.
Rollback: point `/book` back to the old page, and either restore the backup or delete the
batch (every imported row is listed in `legacy_refs` with its batch).
