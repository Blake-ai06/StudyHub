# Deploying StudyHub (Vercel + Supabase)

Estimated time: 45 to 90 minutes the first time. Menu names in the Supabase and Vercel dashboards change now and then, so if a label differs slightly, look for the closest match.

**You will need:** a GitHub account, a Supabase account, a Vercel account. Optional: a domain name, and a Google Cloud account if you want "Continue with Google".

> Nothing in this guide has been run against your real accounts yet. Work through the checklist in section 9 and write down anything that differs.

---

## 1. Create the production Supabase project
1. In Supabase, **New project**. Pick the region closest to your users (for the Philippines, Singapore is the usual choice).
2. Choose a strong **database password** and store it in a password manager. You will rarely need it. Never put it in the app or in GitHub.
3. Wait until the project is ready.

## 2. Create the database
Open **SQL Editor** and run the SQL:

- **Easiest:** paste the whole of `supabase/all_migrations.sql` and run it.
- **Or one by one:** run `supabase/migrations/0000` through `0004` in order.

The migrations are **safe to run again**. If you already ran some of them earlier, just paste the whole bundle: anything that exists is skipped or replaced, and nothing is duplicated. This is covered by an automated test.

Then check:
- **Table Editor** lists 25 tables (see `docs/SCHEMA.md`).
- **Storage** lists 3 private buckets: `class-files`, `post-images`, `submission-files`.
- **Database → Publications** (or Replication): the `supabase_realtime` publication includes `messages`.

Rules of thumb:
- If a script fails, the SQL Editor undoes that whole script, so nothing is left half-applied. Fix the error and run it again.
- Future changes go in **new** numbered files (`0005_...sql`), never by editing old ones.
- Command-line alternative: `supabase link --project-ref <ref>` then `supabase db push`.

## 3. Configure sign-in (Authentication)
1. **URL Configuration**
   - **Site URL:** your production address (start with the Vercel address from step 6, change it later when you add a domain).
   - **Redirect URLs** (add each one):
     - `https://YOUR-SITE.vercel.app/**`
     - `https://YOUR-DOMAIN/**` (once you have a domain)
     - `http://localhost:5173/**` and `http://localhost:4173/**` (local testing)
   - Without these, confirmation emails and password-reset links will not work.
2. **Email provider:** keep **Confirm email** turned **on** for production.
3. **Custom email sender (SMTP).** The built-in sender allows only a handful of emails per hour and is meant for testing. For real users set up SMTP (for example Resend, Brevo, or SendGrid) under **Authentication → SMTP Settings**. Without it, sign-ups and password resets will be rate limited.
4. **Passwords:** set the minimum length to at least 8 (the app also requires a letter and a number).
5. Optional: turn on CAPTCHA protection if you see bot sign-ups.

### Google sign-in (optional)
1. Google Cloud Console → create an OAuth client (type: Web application).
2. Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`.
3. Copy the client ID and secret into Supabase → **Authentication → Providers → Google**, and enable it.
4. In Vercel set `VITE_OAUTH_GOOGLE=true` and redeploy. Until then the Google button honestly says it is not set up.

### Facebook sign-in (optional)
Same idea with a Meta developer app. Redirect URI is the same Supabase callback URL. Set `VITE_OAUTH_FACEBOOK=true` afterwards. Facebook may require app review before other people can use it.

## 4. Get the two values the app needs
Supabase → **Project Settings → API**:
- **Project URL** → `VITE_SUPABASE_URL`
- **Publishable key** (`sb_publishable_...`, older projects call it the "anon" key) → `VITE_SUPABASE_PUBLISHABLE_KEY`

The publishable key is designed to be public: the database rules (RLS) protect your data. **Never** copy the **secret** or **service_role** key into this project, into Vercel, or into GitHub.

## 5. Put the code on GitHub
```
git init
git add .
git commit -m "StudyHub"
```
Create an empty repository on GitHub, then:
```
git remote add origin https://github.com/YOUR-NAME/studyhub.git
git branch -M main
git push -u origin main
```
Before pushing, run `git status` and confirm `.env.local` is **not** listed (it is ignored by `.gitignore`).

## 6. Deploy the frontend on Vercel
1. Vercel → **Add New → Project** → import the GitHub repository.
2. Vercel reads `vercel.json`: framework Vite, build `npm run build`, output `dist`. Leave these as detected.
3. **Environment Variables** (apply to Production **and** Preview):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_OAUTH_GOOGLE` = `false` (or `true` after step 3)
   - `VITE_OAUTH_FACEBOOK` = `false`
4. **Deploy.** Variables beginning with `VITE_` are baked in at build time, so after changing one you must **redeploy**.
5. Copy the address Vercel gives you into the Supabase **Site URL** and **Redirect URLs** (step 3).

What `vercel.json` gives you: every page address works when opened directly (single-page-app rewrite), long caching for hashed files, no caching for the service worker (so updates are found), and strict security headers including a Content-Security-Policy that only allows scripts from your own site and connections to your own site and `*.supabase.co`.

A Netlify version of the same settings is in `netlify.toml` (not tested as thoroughly).

## 7. Custom domain (optional)
1. Buy a domain from a registrar. Check availability first; very common names such as `studyhub.com` are usually taken, so consider alternatives (`.ph`, `.app`, a longer name).
2. Vercel → your project → **Settings → Domains** → add it, then add the DNS records Vercel shows at your registrar. HTTPS is issued automatically.
3. Update Supabase **Site URL** and **Redirect URLs**, and your Google/Facebook redirect settings if used.
4. HTTPS is required for installing the app and for offline mode on real devices.

## 8. Create the first teacher and administrator
Everyone who signs up is a **student**. Register your own account on the live site, then in Supabase SQL Editor run:
```sql
update public.profiles set role = 'admin'   where username = 'your_username';
update public.profiles set role = 'teacher' where username = 'a_teachers_username';
```
Only administrators (and the SQL Editor) can change roles. The app can never promote itself.

## 9. Verify the live site (checklist)
Use a phone **and** a computer, signed in as different accounts.
- [ ] The address opens with a padlock (HTTPS). Landing page and login look like your design.
- [ ] Open a deep link directly (for example `/login`) and refresh: no 404.
- [ ] Register. The confirmation email arrives, the link opens the site, and you can log in.
- [ ] "Forgot password" email arrives and the reset works.
- [ ] Create a post with a photo on the phone, see it on the computer.
- [ ] Connect two accounts and exchange messages (live).
- [ ] Teacher creates a class, a student joins with the code, submits an assignment, takes a quiz; teacher grades; student sees the grade.
- [ ] A student cannot see another student's submission or the quiz answers.
- [ ] Install the app (Android: Install; iPhone: Share, Add to Home Screen).
- [ ] Turn on airplane mode, open the installed app, queue a post, turn airplane mode off, see it appear once. (Full steps in `docs/TESTING.md`.)
- [ ] `curl -I https://YOUR-SITE` shows `content-security-policy` and `strict-transport-security`.
- [ ] Supabase Table Editor shows the rows you created.

## 10. Running it day to day
- **Update the app:** push to GitHub; Vercel redeploys. Users get a "new version available, Reload" message.
- **Roll back the app:** Vercel → Deployments → promote an earlier deployment.
- **Database changes** only move forward: add a new migration file. Test it on a separate Supabase project first.
- **Backups:** check what your Supabase plan includes. Free projects may pause after a period of inactivity, so verify the current policy before relying on one for a real class.
- **Storage and bandwidth limits** depend on your plan; check them before a large launch.
- **Delete requests:** users can delete their own account in the app (Profile, Your data). The app removes their uploaded files first.
- **Moderation:** reported posts are stored in the `reports` table (administrators can read it in the dashboard). There is no moderation screen in the app yet.
- **Keys:** if you ever pasted a secret key somewhere public, rotate it in Supabase immediately.

## 11. What still needs your input
- Your Supabase project (created and migrated) and its two values.
- Vercel and GitHub accounts, and your sign-off before going public.
- SMTP provider for real email.
- Optional: domain, Google/Facebook credentials.
- Review of the Privacy Policy and Terms text by your school or a lawyer before launch.
- Not built yet: study groups, dark mode, global search, onboarding tour, toast notifications, an admin moderation screen.

## 12. Troubleshooting a live deployment
| What you see | Cause and fix |
|---|---|
| "This site is not connected to its database yet" (or "not connected to Supabase") | The build has no Supabase settings. In Vercel: **Settings → Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (exact names, all environments ticked), then **Deployments → ⋯ → Redeploy**. Changing a variable does nothing until you redeploy. |
| Google or Facebook button shows an error from Supabase | `VITE_OAUTH_GOOGLE` / `VITE_OAUTH_FACEBOOK` is `true` but the provider is not enabled in Supabase. Set both to `false` until you have set the provider up. |
| Email links go to the wrong address or say the path is invalid | **Authentication → URL Configuration**: Site URL and Redirect URLs must include your live address. |
| Works on your computer, not on the live site | `.env.local` is only for your computer. The live site only knows what is set in Vercel. |
| "Blocked" for `eval` in the browser Issues panel (older builds) | Fixed. Zod's speed-up needed `eval`, which the security policy forbids; the app now disables it. Update to the latest files and push. |
