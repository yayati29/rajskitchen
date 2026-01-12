This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing any route file under `src/app`. The App Router supports hot reloading, so changes appear immediately.

## Environment Variables

Create a `.env.local` file (never commit it) and define the following variables:

| Variable | Required | Description |
| --- | --- | --- |
| `ADMIN_EMAIL` | ✅ | Email required to log into the admin dashboard. |
| `ADMIN_PASSWORD` | ✅ | Password paired with `ADMIN_EMAIL`. |
| `SUPABASE_URL` | ✅ (prod) | Supabase project URL. Enables persistent menu + order storage and media uploads. |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ (prod) | Service role key used by server actions and API routes. Store securely. |
| `SUPABASE_STORAGE_BUCKET` | Optional | Storage bucket for menu images. Defaults to `menu-assets`. |
| `KV_REST_API_URL` | ✅ (Vercel) | URL for your Vercel KV database. Needed for the kitchen open/closed toggle. |
| `KV_REST_API_TOKEN` | ✅ (Vercel) | Auth token for KV read/write access. |
| `KV_REST_API_READ_ONLY_TOKEN` | Optional | Used if you prefer separate read tokens. |

Locally, Supabase/KV credentials are optional: if they are missing, the app falls back to JSON files under `/data` so you can keep working without network access.

## Supabase Setup
<!-- https://eccigrrgipcnsnigxsso.supabase.co
 -->
 <!-- eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjY2lncnJnaXBjbnNuaWd4c3NvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODA3MDgzNiwiZXhwIjoyMDgzNjQ2ODM2fQ.-K_PdVhDZXpisQiPX40uWLbtVOWOPp1GBFJrnlz2DMk -->

1. [Create a Supabase project](https://supabase.com/dashboard).
2. Under **Project Settings → API**, copy the project `URL` and the `service_role` key into `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Vercel + `.env.local`).
3. Create the required tables (SQL editor > Run):

```sql
create table public.menus (
	id text primary key,
	payload jsonb not null,
	updated_at timestamptz not null default now()
);

create table public.orders (
	id text primary key,
	status text not null,
	placed_at timestamptz not null,
	scheduled_for timestamptz,
	tracking_phone_key text,
	customer_phone text,
	payload jsonb not null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index if not exists orders_tracking_phone_idx on public.orders (tracking_phone_key);
create index if not exists orders_placed_at_idx on public.orders (placed_at desc);
```

4. Storage → **Create bucket** named `menu-assets` (or set `SUPABASE_STORAGE_BUCKET` to a name you prefer) and make it public. The admin image uploader pushes files into this bucket and stores their public URLs in the menu data.
5. Redeploy on Vercel so the new environment variables are available to the serverless functions.

With this setup the menu editor, order placement/tracking, and kitchen toggle all persist across deployments without relying on the file system that Vercel resets between requests.

Locally, if the KV variables are not present, the app falls back to `data/kitchen-status.json` so you can toggle the kitchen without extra setup. On Vercel you must create a free [Vercel KV](https://vercel.com/docs/storage/vercel-kv) database and add the generated credentials under **Project → Settings → Environment Variables** before deploying; otherwise the “Shut Kitchen” control cannot persist.

## Sync Existing Menu Data

If your local `data/menu.json` (or `public/menu.yaml`) already contains the dishes you curated before moving to Supabase, push that payload into the remote `menus` table with:

```bash
npm run seed:menu            # reads data/menu.json by default
# npm run seed:menu public/menu.yaml  # optional: pick a different source
```

The script reads your `.env.local` for `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, upserts the `active-menu` row, and prints a confirmation. Redeploy once so serverless functions pick up the latest menu snapshot.

## Learn More

To learn more about Next.js and the tools used here:

- [Next.js Documentation](https://nextjs.org/docs) – deep dive into the App Router and data fetching.
- [MUI](https://mui.com/material-ui/) – UI component library powering both the public menu and the admin console.
- [Vercel KV](https://vercel.com/docs/storage/vercel-kv) – managed Redis used for runtime kitchen-state persistence.
- [Supabase](https://supabase.com/docs) – Postgres + Storage used for menus, orders, and media uploads.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
