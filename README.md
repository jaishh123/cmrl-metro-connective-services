# Metro Connect Performance Management System

One website with three pages: **Input**, **Consolidation**, **Visualization**, all reading and writing the same Supabase database.
Built with React, Vite, TypeScript, Tailwind CSS, Supabase (PostgreSQL + Auth) and Recharts.

> **Safety:** this app uses its own new database schema called `pms`. It never changes your existing `public` tables
> (locations, metric_types, performance_records, profiles, ...). Your existing logins are reused.
> Nothing runs against your database until YOU run the steps below. The Excel data is only imported when you type `IMPORT`.

---------------------------------------------------------------------

## Step 1. Install the tools (one time)

1. Install **Node.js 20 or newer** (the "LTS" version) from https://nodejs.org.
2. Unzip this project. Open a terminal **inside the project folder** (the one containing `package.json`).
   - Windows: open the folder in File Explorer, click the address bar, type `cmd`, press Enter.
3. Run: `npm install` (takes a minute).

## Step 1b. Optional read-only checks of your existing project

Before running anything, open **SQL Editor**, paste `supabase/preflight_readonly_checks.sql` and run it. It only reads. It confirms that `public.current_app_role()` exists, shows your profile row(s) and their role/active flag, and confirms the `pms` schema does not exist yet.

## Step 2. Read and approve the database migration

Open `supabase/migrations/001_pms_schema.sql` in any text editor and read it. In plain words it:

- creates a new schema `pms` with 4 tables (`domains`, `metric_definitions`, `daily_records`, `monthly_records`) and 2 views (`v_daily`, `v_monthly`) and 1 function (`add_domain`);
- adds the 8 official domains and their fields (taken from your Excel workbook);
- turns on Row Level Security so only signed-in users with an active admin/officer profile can use it;
- **only reads** `public.profiles` and `public.current_app_role()` from your old project.

It contains no `DROP`, `DELETE`, `TRUNCATE` or `UPDATE` against any existing object, and it can safely be run twice.
It was tested on a scratch in-memory PostgreSQL (`npm run test:migration`, 17 checks) and not on your real database.

## Step 3. Run the migration (only after you approve it)

1. Supabase dashboard -> your existing project -> **SQL Editor** -> **New query**.
2. Paste the entire contents of `001_pms_schema.sql` and press **Run**. You should see "Success".

## Step 4. Let the website see the `pms` schema (a settings change, not SQL)

Supabase only serves schemas listed under **Exposed schemas**. You are *adding* `pms` to that list; you do **not** remove or edit `public`.

1. Supabase dashboard -> your project -> **Project Settings -> Data API** (in some dashboard versions: **Integrations -> Data API -> Settings**).
2. Find **Exposed schemas**. It normally shows `public` and `graphql_public`.
3. Click in the box, add `pms`, keep `public` and `graphql_public`, then **Save**.
4. To undo later, remove `pms` from the same box. Nothing in `public` is affected either way.

The migration already grants access to signed-in users only (the `anon` role gets nothing on `pms`), so exposing the schema does not make data public. Without this step the app shows "Invalid schema: pms".

## Step 5. Connect the app

1. Copy `.env.example` to a new file named `.env`.
2. In Supabase: **Project Settings -> API**. Copy the **Project URL** and the public key into `.env`. This key is called **anon public** in older dashboards and **publishable** in newer ones; either works. Never use the **service_role** / **secret** key.
3. **Never** use the `service_role` key anywhere in this project.

## Step 6. Start the app

`npm run dev` -> open the link it prints (usually http://localhost:5173) -> sign in with your existing email and password.
Admins can manage domains and delete records; officers can enter and edit records (same rules as your old project).

## Step 7. Import the Excel data (optional, needs your approval)

1. Copy `Monthwise_Daily_Performance_of_Metro_Connect_Services.xlsx` into the `data/` folder.
2. `npm run import:preview` creates `import-preview/validation-report.md` (and CSV/JSON files). **Nothing is written to the database.**
   Read the report. A copy made from your uploaded workbook is already included in this zip.
3. If you approve, run `npm run import:commit`. It asks for your login, shows what it will insert, and only writes after you type `IMPORT`.
   - It signs in as you (no secret keys) and only **inserts**. Rows that already exist are skipped, never overwritten, so running it twice is harmless.
   - Your Excel file is never modified.

## Step 8. Put it on the internet (Vercel)

1. Create a free account at https://vercel.com and a GitHub account; upload this project to a new GitHub repository
   (`.env` and your workbook are git-ignored so they are not uploaded).
2. Vercel -> **Add New -> Project** -> pick the repository. Framework: **Vite** (auto-detected). Build command `npm run build`, output `dist`.
3. Before deploying, open **Environment Variables** and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (same values as `.env`).
4. Deploy. Open the Vercel link from any laptop and sign in.
5. Changed a variable later? Press **Redeploy** in Vercel.

## Step 9. Test checklist

1. Sign in. 2. Input -> Domain management: add a test domain, disable it, enable it, delete it (works because it has no records).
3. Pick a date, enter a few values, **Save data**. 4. Consolidation: the rows appear; cumulative is month-to-date.
5. Input: tick **Edit existing values**, change a value, save. 6. Consolidation: click **Edit** on a row, change it, save.
7. Delete a row (admin). Cumulative values change. 8. Visualization: charts follow the change. Try **Apply filters** and **Reset filters**.
9. Input -> Monthly entry: save a Pallavaram or SC-GBS month. 10. Disable a domain: it disappears from Input, but its history stays in the other two pages.

## How the data model works

| Rule | How |
|---|---|
| Daily and monthly values are separate | `daily_records` and `monthly_records` are different tables. |
| Cumulative is month-to-date and always correct | Calculated in the view `pms.v_daily`; never stored. Edits and deletes update it automatically. |
| No duplicates | Unique (metric, date) and (metric, month). Saving the same date again updates instead of duplicating. |
| Blank is blank, zero is zero | A blank field creates no record. A typed 0 is saved as 0. |
| Negatives only for MTC GAP and Pallavaram Difference | Enforced by a database trigger per metric. |
| Units are never mixed | Totals are always per domain and per metric. |
| Domains with history cannot be deleted | Database foreign keys block it; disabling keeps history visible. |

## Project layout

```
supabase/migrations/001_pms_schema.sql   new "pms" schema (review before running)
scripts/import-workbook.mjs              Excel preview + commit tool
scripts/test-migration.mjs               scratch test of the migration
src/pages/                               Login, Input, Consolidation, Visualization
src/components/                          layout, filters, input forms, UI pieces
src/lib/                                 Supabase client, auth, data access, formatting
```

## Troubleshooting

- **"Invalid schema: pms" / schema not found** -> Step 4 (Exposed schemas).
- **"permission denied" or empty lists** -> your account needs an active row in `public.profiles` with role `admin` or `officer`.
- **Blank white page on Vercel** -> the two environment variables are missing; add them and redeploy.
- **Delete button missing** -> only admins see it.
