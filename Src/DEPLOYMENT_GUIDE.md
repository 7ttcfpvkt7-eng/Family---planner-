# Family Homeschool Planner — Setup Guide
### No coding experience required. Just follow each step in order.

This turns the planner into a real installable app that everyone in your family can
use on their own iPhone, iPad, or Mac, with everything staying in sync automatically.

**Total time:** about 25–30 minutes, one time only.
**Cost:** $0 (everything below is free for a family's usage level).

---

## What you're setting up (in plain English)

1. **Supabase** — a free online database. This is where checkmarks, notes, and
   student info are stored so every device sees the same thing.
2. **GitHub** — a free file-storage service for the app's code. You won't write
   any code — you'll just upload the folder I've given you.
3. **Vercel** — a free hosting service. It takes the code from GitHub and turns
   it into a real website address (like a link you can visit and install).

Once these three are connected, you'll have a real web address for your planner
that you install on each device like an app.

---

## Part 1 — Create your database (Supabase)

1. Go to **supabase.com** and click **Start your project**. Sign up with your email
   (or "Continue with GitHub" once you've made a GitHub account in Part 2 — either
   order works).
2. Click **New Project**.
   - **Name:** anything, e.g. "Family Planner"
   - **Database password:** click "Generate a password" and **save it somewhere**
     (a notes app is fine — you likely won't need it again, but keep it just in case).
   - **Region:** pick whichever is closest to you.
   - Click **Create new project** and wait ~2 minutes while it sets up.
3. Once it's ready, click the **SQL Editor** icon in the left sidebar (looks like `>_`).
4. Click **New query**.
5. Open the file **`supabase-schema.sql`** (included in this project folder), select
   all the text, copy it, and paste it into the SQL editor box.
6. Click **Run** (bottom right). You should see "Success. No rows returned."
   This created your tables and already added Penelope and Aubrey.
7. Now click the **gear icon (Project Settings)** in the left sidebar → **API**.
   You'll see two values you need — keep this tab open, you'll copy these in Part 3:
   - **Project URL** (starts with `https://...supabase.co`)
   - **anon public** key (a long string of letters/numbers)

---

## Part 2 — Upload the code to GitHub

1. Go to **github.com** and click **Sign up**. Make a free account.
2. Once logged in, click the **+** icon (top right) → **New repository**.
   - **Repository name:** `family-planner` (or anything you like)
   - Leave it **Public** or **Private** — either works fine (Private is more
     discreet, but requires nothing extra from you).
   - Click **Create repository**.
3. On the next page, click **uploading an existing file**.
4. On your computer, open the `planner-app` folder I gave you. Select **all the
   files and folders inside it** (not the `planner-app` folder itself — its
   *contents*: `src`, `public`, `package.json`, `vite.config.js`, `index.html`,
   `supabase-schema.sql`, `.gitignore`, `.env.example`, this guide, etc.)
5. Drag them all into the GitHub upload box on the webpage.
6. Scroll down, click **Commit changes**. Wait for the upload to finish.

That's it — your code now lives on GitHub, ready for Vercel to use.

---

## Part 3 — Deploy the app (Vercel)

1. Go to **vercel.com** and click **Sign Up** → **Continue with GitHub**. This
   links Vercel to the GitHub account from Part 2 (approve the connection when asked).
2. Click **Add New...** → **Project**.
3. Find your `family-planner` repository in the list and click **Import**.
4. Vercel will auto-detect it's a Vite project — leave the build settings as-is.
5. Click **Environment Variables** to expand that section. Add these two, using
   the values you copied from Supabase in Part 1, step 7:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | (paste your Supabase Project URL) |
   | `VITE_SUPABASE_ANON_KEY` | (paste your Supabase anon public key) |

6. Click **Deploy**. Wait 1–2 minutes.
7. When it finishes, click **Visit** (or the link shown) — this is your app's
   real, permanent web address! Something like `family-planner-yourname.vercel.app`.
   **Save/bookmark this link** — it's what everyone in the family will use.

---

## Part 4 — Create your family login

1. Open the Vercel link from Part 3 on your phone or computer.
2. You'll see a sign-in screen. Click **"Create the family account."**
3. Pick **one email and password the whole family will share** (e.g. a family
   email you already check). Enter it and click **Create Account**.
4. Check that email inbox for a confirmation link from Supabase and click it.
5. Go back to the app and sign in with that same email/password.

You're in! Both Penelope's and Aubrey's schedules should already be there.

**On every other device** (other iPhones, iPads, the Mac): just visit the same
web address and sign in with that same email/password — everyone shares one
login, and everyone's checkmarks sync in real time.

---

## Part 5 — Install it like a real app

### On iPhone / iPad (Safari)
1. Open your planner's web address in **Safari** (must be Safari, not Chrome).
2. Tap the **Share** icon (square with an arrow, at the bottom of the screen).
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add** (top right).

You'll now have a Planner icon on your home screen. Tapping it opens the app
full-screen, with no browser bar — indistinguishable from an App Store app.

### On Mac (Safari or Chrome)
- **Safari:** File menu → **Add to Dock** (Safari 17+/macOS Sonoma or later).
- **Chrome:** click the **install icon** in the address bar (a small monitor/plus
  icon on the right side), or Menu (⋮) → **Cast, save, and share** → **Install page as app**.

Either way, it becomes a real app in your Dock/Applications, opening in its own
window without browser tabs.

---

## Using it day to day

- Every checkbox tap saves instantly and shows up on other devices within a second or two.
- The **+** tab on the left adds another child. New children start with an
  empty schedule — send me their curriculum materials (course books, IXL/LP
  sheets) the same way you did for Penelope and Aubrey, and I'll build their
  lesson data the same way.
- **Notes**: each day now has a notes box at the bottom — great for "sick day,"
  "skipped IXL today," etc. These sync too.
- Signing out (bottom of the left rail) just signs out that device — your data
  is always safe in Supabase regardless.

---

## About a native iPhone App Store app

I didn't build this as a native app, and here's why: it would require you to
pay **$99/year** for an Apple Developer account, install **Xcode** (Mac-only
software), and submit through **App Store Review** (which can take 1–2 weeks
and can reject apps for various policy reasons) — all for an experience that,
for a personal family tool, looks and feels basically identical to the
installed PWA you just set up in Part 5.

If you ever do want a real App Store app later (e.g., to share more broadly),
nothing here is wasted — this same React code can be wrapped with a tool called
**Capacitor** and submitted through Xcode without a rewrite. Just let me know
and I'll walk you through that path when you're ready.

---

## Troubleshooting

- **"Missing Supabase environment variables" warning in the browser console:**
  Double check the two values in Vercel → your project → Settings →
  Environment Variables, then redeploy (Vercel → Deployments → ⋮ → Redeploy).
- **Checkmarks not syncing between devices:** make sure both devices are signed
  in with the *exact same* email/password.
- **Confirmation email never arrived:** check spam, or in Supabase go to
  Authentication → Users, find your email, and click the "..." menu to resend
  or manually confirm it.
- **Made a mistake in the SQL step:** it's safe to re-select all the SQL and
  click Run again — the script won't create duplicates.

---

## Files in this project (for reference)

- `src/App.jsx` — the entire app: login screen, planner UI, sync logic
- `src/data/penelopeSchedule.json`, `src/data/aubreySchedule.json` — each
  child's full curriculum (lessons, IXL links, history readings) — unchanged
  from what was already built
- `supabase-schema.sql` — the database setup script (Part 1)
- `vite.config.js` — build + PWA (installable app) configuration
- `public/` — app icons
