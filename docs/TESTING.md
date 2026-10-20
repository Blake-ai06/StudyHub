# Testing StudyHub offline mode

Offline mode only works on the **production build** (the service worker is not active in `npm run dev`).

```
npm run build
npm run preview        # opens http://localhost:4173
```
Use **Chrome** (or Edge) for the DevTools steps. `localhost` counts as a secure context, so the service worker runs without HTTPS.

## A. Chrome DevTools: offline start
1. Open http://localhost:4173, log in, and wait for the "StudyHub is ready to work offline" message (first load must be online).
2. Visit Home, Classes, a class (Stream, Materials, Assignments, Quizzes), and Messages once so their data is cached.
3. DevTools → **Application → Service Workers**: confirm it is *activated and running*. **Cache Storage** should list a `workbox-precache` cache.
4. DevTools → **Network** → set throttling to **Offline**. The top-right pill should change to **Offline**.
5. Reload (F5). The app must still open and show cached pages. Open `/offline` for the fallback screen.
6. Expected: private API responses are NOT in Cache Storage. Your data is in **Application → IndexedDB → studyhub** (tables: outbox, cache, drafts, downloads, meta).

## B. Downloaded materials
1. Online: Class → Materials → **Save offline** on a file. The button changes to "Saved offline".
2. Go Offline (step 4 above), open **Offline & sync**: the file is listed. Tap **Open**. It must open without internet.
3. Storage usage on that page should have grown. **Remove** deletes it.

## C. Drafts survive refresh
1. Type half a post (do not send), then refresh. The text is restored. Same for a comment, a message, an assignment answer, and quiz answers mid-attempt.
2. Quiz timer: start a timed quiz, refresh. The countdown continues from the saved start time instead of resetting.

## D. Queue, retry, and duplicate prevention
1. Go Offline. Create a post (with a photo), add a comment, send a message, save an assignment draft or submit.
   Each shows "Saved on this device… not yet received by the server". The pill shows **Offline · N saved**.
2. Refresh the page while still offline. **Offline & sync** must still list every pending item (nothing lost).
3. Go back **Online**. Within ~30 seconds (or tap **Sync now**) the queue drains. In Supabase **Table Editor**, confirm each row exists **exactly once**.
4. Duplicate check: queue a message offline, then open the app in two tabs and tap **Sync now** in both at once. Only one message row appears.
5. Interrupted upload: queue a post with a photo, go online, then toggle Offline mid-sync. The post stays in the list as pending. When you reconnect it sends once.
6. Failure: as a student, queue a submission, then (as the teacher) grade or delete the assignment. After syncing, the item shows **Conflict** or **Failed** with a reason and is never silently removed.

## E. Conflicts
1. Student opens an assignment on device A and device B, both online.
2. Put A offline and edit/submit. On B submit different text (online).
3. Bring A online and sync. A's item shows **Conflict**: choose **Keep mine** (overwrites) or **Use the server version** (discards).
4. If the teacher already graded it, only "Use the server version" applies.

## F. Offline quiz rules
- A quiz with "allow offline" ticked can be started and submitted offline (open it once online first so its questions are cached). The attempt shows "Waiting to sync" and counts only after the server receives it. The deadline is checked by the server on arrival.
- A quiz without that setting cannot be started offline, and cannot be submitted while offline.

## G. Real phone (Android or iPhone)
The phone needs an `https://` address, so deploy first (Step 9/10), or use a tunnel such as `npx localtunnel --port 4173`.
1. Open the https URL on the phone, log in, browse a few pages, and wait for the offline-ready message.
2. **Android Chrome**: menu → *Install app* (or the in-app Install button). **iPhone Safari**: Share → *Add to Home Screen*.
3. Turn on **Airplane mode**, open the installed app from the home screen. It must open and show cached pages.
4. Create a post and a message offline, turn Airplane mode off, and confirm they sync (the pill goes from Offline to Online and the queue empties).
5. iPhone note: iOS may clear a site's stored data if the app is unused for weeks. Saved lessons can disappear, so re-download them before an exam.

## H. Log out clears private data
1. With pending items, tap Log out. You get a warning that unsynced changes will be deleted.
2. After logging out, IndexedDB tables must be empty.

## Automated tests
```
npm run lint
npm run typecheck
npm run test     # 39 tests, including the sync engine on a fake IndexedDB
npm run build
```
These cover the queue (persistence, ordering, backoff, retry, conflicts, duplicate prevention), drafts, the cache, and the reachability check. They do **not** run a real browser, a real service worker, or the real Supabase database: use sections A to H for that.

## Automated browser and database checks (optional, extra)
These run the real app in a real headless browser against a **fake** Supabase server, and the real SQL migrations in an in-memory Postgres.
```
npm run build
cd e2e && npm install && cd ..
cd supabase/tests && npm install && cd ../..
npm run test:db      # 31 checks of the security rules (who can read/write what)
npm run test:e2e     # 54 checks: login, layouts, offline start, queue, duplicates, quizzes, log out
node e2e/public-layouts.mjs   # landing/login/etc. at 9 widths, no sideways scrolling
```
On Windows or macOS set `CHROME_PATH` to your Chrome/Edge executable first (for example `set CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe`).
Screenshots are written to `e2e/shots/`.
What these do NOT prove: that your real Supabase project is configured correctly (redirect URLs, email settings, storage), or how the app behaves on a real phone. Use sections A to H above for that.
