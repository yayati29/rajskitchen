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
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ (prod) | Supabase project URL (public, safe to expose). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ (prod) | Supabase anonymous key (public, used by client). |
| `SUPABASE_URL` | ✅ (prod) | Supabase project URL (server-side). |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ (prod) | Service role key used by server actions and API routes. Store securely. |
| `SUPABASE_STORAGE_BUCKET` | Optional | Storage bucket for menu images. Defaults to `menu-assets`. |

Locally, Supabase/KV credentials are optional: if they are missing, the app falls back to JSON files under `/data` so you can keep working without network access.

## Supabase Setup
<!-- https://eccigrrgipcnsnigxsso.supabase.co
 -->
 <!-- eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjY2lncnJnaXBjbnNuaWd4c3NvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODA3MDgzNiwiZXhwIjoyMDgzNjQ2ODM2fQ.-K_PdVhDZXpisQiPX40uWLbtVOWOPp1GBFJrnlz2DMk -->

1. [Create a Supabase project](https://supabase.com/dashboard).
2. Under **Project Settings → API**, copy the project `URL` and the `service_role` key into `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Vercel + `.env.local`).
3. Create the required tables. Go to **SQL Editor** and run these commands:

### Menus Table
```sql
CREATE TABLE public.menus (
	id text primary key,
	payload jsonb not null,
	updated_at timestamptz not null default now()
);
```

### Orders Table (Simplified Schema)
```sql
-- Drop existing table if it exists (only on migration)
DROP TABLE IF EXISTS public.orders CASCADE;

-- Create the new simplified orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY,
  public_id VARCHAR(255) NOT NULL UNIQUE,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_building VARCHAR(255),
  customer_apartment VARCHAR(255),
  items_summary TEXT,
  items_count INTEGER DEFAULT 0,
  subtotal DECIMAL(10, 2) DEFAULT 0,
  delivery_fee DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'Pending',
  fulfillment_method VARCHAR(50) DEFAULT 'delivery',
  scheduled_for TIMESTAMP,
  placed_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP,
  delivered_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  tracking_phone_key VARCHAR(20),
  order_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX idx_orders_tracking_phone_key ON public.orders(tracking_phone_key);
CREATE INDEX idx_orders_public_id ON public.orders(public_id);
CREATE INDEX idx_orders_placed_at ON public.orders(placed_at DESC);
CREATE INDEX idx_orders_status ON public.orders(status);

-- Enable Row Level Security
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Create policies to allow orders to be read and written
CREATE POLICY "Allow anonymous inserts" ON public.orders
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow reading orders by tracking_phone_key" ON public.orders
  FOR SELECT
  USING (true);

CREATE POLICY "Allow all updates" ON public.orders
  FOR UPDATE
  USING (true)
  WITH CHECK (true);
```

4. Storage → **Create bucket** named `menu-assets` (or set `SUPABASE_STORAGE_BUCKET` to a name you prefer) and make it public. The admin image uploader pushes files into this bucket and stores their public URLs in the menu data.

5. Verify all table creation succeeded in Supabase:
   - Go to **Database → Tables**
   - You should see `menus` and `orders` tables listed
   - Click on `orders` to verify all columns are present

6. Redeploy on Vercel so the new environment variables are available to the serverless functions.

### Order Placement System

The order placement system uses Supabase as the primary store with automatic fallback to local file storage:

- **Primary**: Orders are persisted to the `orders` table in Supabase
- **Fallback**: If Supabase fails, orders are saved to `data/orders.json` locally
- **Full Payload**: The complete order object is stored in the `order_data` JSONB column for data integrity
- **Admin Dashboard**: Reads from Supabase `orders` table and displays all order details
- **Order Tracking**: Customers can track orders by phone number using the `tracking_phone_key` column

**Important**: Payment processing is not yet implemented. Orders are marked as "Pending" on placement and payment will be collected via UPI on delivery.

With this setup the menu editor, order placement/tracking, and kitchen toggle all persist across deployments without relying on the file system that Vercel resets between requests.

### Kitchen Status Table (in Supabase)

The "Shut Kitchen" button in the admin dashboard toggles whether orders are accepted. The status persists in your Supabase database.

Run this SQL in your Supabase SQL Editor to create the table:

```sql
-- Create kitchen_status table
CREATE TABLE public.kitchen_status (
  id VARCHAR(50) PRIMARY KEY,
  is_open BOOLEAN DEFAULT true,
  message VARCHAR(255) DEFAULT 'We will be back shortly.',
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default status
INSERT INTO public.kitchen_status (id, is_open, message)
VALUES ('default', true, 'We will be back shortly.')
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE public.kitchen_status ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read" ON public.kitchen_status
  FOR SELECT
  USING (true);

CREATE POLICY "Allow all updates" ON public.kitchen_status
  FOR UPDATE
  USING (true)
  WITH CHECK (true);
```

#### How It Works
- Kitchen status is stored in `kitchen_status` table with a single row (`id = 'default'`)
- Locally: Falls back to `data/kitchen-status.json` if Supabase unavailable
- On Vercel: Uses Supabase database (persists across deployments)
- No Vercel KV needed!

## Kitchen Status & Order Acceptance

### How It Works
1. Admin clicks the **"Shut Kitchen"** button in the dashboard (top right)
2. Status is saved to Supabase `kitchen_status` table (production) or local file (development)
3. When closed, customers see "Kitchen is temporarily closed" on checkout page
4. When open again, customers can resume ordering

### Testing Locally
1. Start the dev server: `npm run dev`
2. Go to admin dashboard: `/admin/login` → login with your credentials
3. Click the **"Shut Kitchen"** button (top right)
4. The button should toggle to **"Open Kitchen"**
5. Go to checkout `/checkout` → you should see "Kitchen is temporarily closed"
6. Click "Open Kitchen" to resume
7. Kitchen status falls back to `data/kitchen-status.json` (since Supabase is in SQL Editor, not in real-time during local dev)

### Testing on Vercel
1. Create the `kitchen_status` table in Supabase (see SQL above)
2. Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in Vercel env vars
3. Deploy to Vercel: `git push`
4. Go to admin dashboard and click "Shut Kitchen"
5. Go to checkout page in an incognito/private window → should show closed message
6. Refresh both tabs → status should persist (reads from Supabase)
7. Check Supabase → Tables → `kitchen_status` → you should see `is_open = false`

## Troubleshooting Order Placement

If orders are not appearing in Supabase after placing them:

### Check 1: Verify Environment Variables
Ensure these are set in Vercel **Project → Settings → Environment Variables**:
- `SUPABASE_URL` – Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` – Service role key (NOT the anon key)

### Check 2: Review Vercel Logs
1. Go to your Vercel dashboard
2. Select your project
3. Click **Deployments → (latest) → Functions**
4. Look for `/api/orders` and check the logs for errors
5. Check for messages like "Order created successfully" or database errors

### Check 3: Verify Supabase Table
1. Go to Supabase dashboard → **Database → Tables**
2. Click on the `orders` table
3. Check if the table exists and has all columns:
   - `id`, `public_id`, `customer_name`, `customer_phone`, `customer_building`, `customer_apartment`
   - `items_summary`, `items_count`, `subtotal`, `delivery_fee`, `total`
   - `status`, `fulfillment_method`, `scheduled_for`, `placed_at`, `accepted_at`, `delivered_at`, `cancelled_at`
   - `tracking_phone_key`, `order_data`

### Check 4: Test RLS Policies
Supabase uses Row Level Security. Verify policies are in place:
1. Go to **Database → Tables → orders → Authentication**
2. You should see policies for `INSERT`, `SELECT`, and `UPDATE`

### Check 5: Local Fallback
If Supabase fails, orders are saved locally:
- Check `/data/orders.json` in your deployment
- If orders are there, Supabase connection is the issue
- If nothing is there, the API route itself failed

If you see errors in the logs but orders appear locally, Supabase connection/permissions need fixing.

## Troubleshooting Kitchen Status

If the "Shut Kitchen" button doesn't work:

### Check 1: Verify Supabase Table Exists
1. Go to Supabase Dashboard → **Database → Tables**
2. Look for `kitchen_status` table
3. Click on it and verify columns: `id`, `is_open`, `message`, `updated_at`
4. If missing, run the SQL commands from the Kitchen Status Table section above

### Check 2: Verify API Endpoint
Open your browser console and test the endpoint manually:
```javascript
// Check current status
fetch('/api/kitchen/status').then(r => r.json()).then(console.log)

// Toggle kitchen closed
fetch('/api/kitchen/status', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ isOpen: false })
}).then(r => r.json()).then(console.log)
```

If these work, the API is fine.

### Check 3: Local Development
Kitchen status falls back to `data/kitchen-status.json`:
- Click "Shut Kitchen" in admin dashboard
- Check the file exists and contains: `{ "isOpen": false, "message": "..." }`

### Check 4: Vercel Production
If status doesn't persist on Vercel:
1. Go to Vercel Dashboard → Your Project → **Settings → Environment Variables**
2. Verify these are set:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. If missing, copy them from Supabase Dashboard → Settings → API
4. Redeploy with `git push`

### Check 5: Vercel Logs
1. Go to **Deployments → (latest) → Functions**
2. Look for `/api/kitchen/status` errors
3. Check for Supabase errors like `SUPABASE_URL not set` or RLS policy errors

### Check 6: Verify in Supabase
1. Go to Supabase → **kitchen_status** table
2. Click the single row with `id = 'default'`
3. Verify `is_open` and `message` fields match what you expect
4. Manually update `is_open` to test if changes appear on the site

### Check 7: Test in Incognito
1. Toggle kitchen on/off in admin
2. Open incognito/private window
3. Go to checkout → should reflect the status
4. Refresh → status should persist (reads from Supabase)

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
