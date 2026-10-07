# Aegis update: roles enforced by the server, PRD v0.4 rules fixed

Drop these files into your repo at the same paths (30 files, all new or changed; `DashboardTab.tsx` needed no change).
Checked here: `tsc --noEmit` clean, `next build` succeeds, and the service and API test files in `tests/` pass against a local PostgreSQL 16 built from `db/sql`.

## 1. Setup (in this order)

1. **Database.** Apply `db/sql/001`, `002`, `003`, `006` to your Cloud SQL database. `003` is *synthetic* master data (rates, prices, subjects): replace it with real data when ready.
   Before running `006`, compare your existing `fn_check_conflicts` with the one in `006` (`\df+ fn_check_conflicts`). `006` replaces it with `create or replace`; if your return type differs it will error instead of overwriting. `006` also replaces the `v_renewal_due` view.
   Do not run `drizzle-kit push` on this database (see the warning at the top of `src/db/schema.ts`).
2. **Firebase.** In the Firebase console: Authentication → enable the **Google** provider, and add your Cloud Run domain to **Authorized domains**. `lib/firebase.ts` imports `firebase-applet-config.json`, which I have not seen: it needs `apiKey`, `authDomain`, `projectId`, `appId`.
3. **Environment variables** (see `.env.example`): `SQL_*`, `MASTER_ADMIN_EMAILS` (your Google email), `CRON_SECRET`.
4. **First login.** Sign in with the email in `MASTER_ADMIN_EMAILS`: you become `master_admin`. Then Master Data → *Users & Roles* → invite admins, teachers (linked to a teacher record) and viewers. Anyone not invited is refused.
5. **Daily job** (expires 3-month postponements, generates waiting slots). Check the flags before running:
   `gcloud scheduler jobs create http aegis-daily --schedule="0 1 * * *" --time-zone="Asia/Makassar" --uri="$APP_URL/api/cron" --http-method=POST --headers="Authorization=Bearer $CRON_SECRET"`

## 2. What changed, against my review findings

| # | Finding | Now |
|---|---|---|
| 1 | Role was a UI toggle; client sent `admin: true` | Firebase login; role comes from the `users` table; every API call is authenticated and checked per action. The client `admin` flag is honoured only for admin roles; teachers can never bypass the check-in window. Deny by default, verified email required. |
| 2 | Every browser received all data | Responses are built per role. Teachers get only their own classes, sessions and payroll (no student list, no guardians, no rates). Viewers get aggregate reports and counts only. Admins no longer receive pay rates; master_admin does. |
| 3 | Schema drift | `schema.ts` now mirrors generated columns and the new tables, with a warning that SQL in `db/sql` is the source of truth. |
| 4 | Time zone | Datetimes without an offset are read as GMT+8 on the server (`lib/time.ts`). UI defaults use GMT+8. |
| 5 | Hard-coded dates / invented chart data | Waterfall is a rolling 6 months; payroll defaults to the previous month; the chart shows zeros instead of made-up numbers. |
| 6 | Master data | Rates and prices now show curriculum and level, and "Rate / Session". Still read-only (see section 4). |
| 7 | Duplicate student rows | One row per student. Totals are summed across enrollments; `class_type` shows `mixed` when a student has both kinds. |
| 8 | Postponement expiry never ran | `/api/cron` calls `fn_expire_postponements` and `fn_generate_pending`. |
| 9 | `LIMIT 100`, interpolated `limit` | Parameterised, bounded (max 2000). The dashboard loads sessions from 45 days back to 60 days ahead. |
| 10 | Roles | `master_admin`, `admin`, `teacher`, `viewer` as in the PRD. The `admissions` role is removed. |
| renewal | `v_renewal_due` listed dropped students | Now uses the same activity rule as the waterfall. |
| conflicts | No overlap checks | Trials, make-ups and new classes are checked for teacher/student overlaps. |

Also added: input validation on every action, an append-only `audit_log` of every mutating request (personal fields redacted), and `UserError` so business-rule messages reach the UI while internal errors are logged and hidden.

## 3. Behaviour changes you will notice

- **Payroll lock** now requires exactly one calendar month that has already ended (PRD FR-9.1; the "already ended" rule is my addition, because locking a running month would strand later sessions). The default period is last month.
- **Role matrix:** master_admin: everything, including rates, prices, config view and users. admin: operations, payroll lock, no rates, no users. teacher: own sessions, check-in, own classes (read-only) and own pay. viewer: dashboard only.
- Teachers' "My Assigned Classes" is read-only; create/enroll buttons are hidden and also rejected by the server.

## 4. Not done, or different from the PRD

- **Access control is in the API, not in the database.** PRD NFR-2 asked for row-level security. The app connects with one database user, so a bug in the API layer is not caught by the database. RLS would need per-request database roles. Treat this as weaker defence in depth.
- **Not built:** editing rates, prices, config and holidays in the UI (use SQL, see `FLOW.md`); EN/ID language toggle; payroll CSV/print; credit and payroll adjustments; teacher check-in for trials (FR-3.3); a screen to read the audit log; CSV lead import and duplicate detection; cost per paid student; lead stage order is still not enforced; consent and data-request tables (deferred by your decision).
- **Not tested:** real Firebase sign-in and token signature checking (tests used unsigned emulator-style tokens), the screens in a browser, and your live Cloud SQL database. If your live schema differs from `db/sql`, run the tests against a copy first.
- The audit log records actions, not row-level changes.
- `lib/formatters.ts` and `lib/time.ts` both contain GMT+8 helpers (client and server copies).

## 5. Tests

`tests/test-service.ts` and `tests/test-api.ts` need `npm i -D tsx`, a local PostgreSQL with `db/sql` applied plus the synthetic history, and the environment from `.env.example`. They cover: 401/403 paths, bootstrap, every role's allowed and blocked reads and writes, teacher data scoping, ownership of check-in, validation and injection attempts, self-lockout protection, immediate deactivation, audit redaction and append-only, cron secret, payroll guards, conflict guards, rolling waterfall.
