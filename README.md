# Universal Task Tracker

A live, shared task board for **Total Cash Home Buyers (TCHB)** and **KPI Driver**. Track main tasks and their subtasks, assign owners, set statuses, and see progress per company in real time.

**Live:** https://tasks.totalchb.com

---

## Features

- **Two company boards** — TCHB and KPI DRIVER tabs, each with its own tasks, progress, and brand colors.
- **Tasks & subtasks** — check off subtasks; when all are done the main task closes itself. Checking the main task completes every subtask.
- **Statuses** — Not Started, In Progress, Done (per subtask; main task status rolls up automatically).
- **Owners** — pick from the team list or add a new owner; new names appear everywhere instantly.
- **Filters** — by status and by owner.
- **Drag to reorder** — grab the ⋮⋮ handle on any task.
- **"Edited by"** — every task and subtask shows who changed it last and when.
- **Light / Dark theme** — personal preference, remembered per browser.
- **Live sync** — changes appear for the whole team within about a second.
- **Team-only access** — Google sign-in restricted to `@totalchb.com` and `@kpidriver.com` accounts.

## Tech

- Single static file: `index.html` (no build step, no server).
- **Firebase Authentication** (Google sign-in) + **Cloud Firestore** (data + realtime sync), loaded from Google's CDN.
- Hosted on **Vercel** (or any static host: GitHub Pages, Firebase Hosting, Netlify).

## Repository contents

```
index.html     The complete app (HTML, styles, logic, logos — all inlined)
README.md      This file
```

## Deploy

### Vercel (current)
1. Import this repo at https://vercel.com/new → Framework preset: **Other** → no build command, output directory `/`.
2. **Settings → Domains** → add `tasks.totalchb.com`.
3. At the DNS provider for `totalchb.com`, add: **CNAME** `tasks` → `cname.vercel-dns.com`.
4. Every push to `main` redeploys automatically.

### GitHub Pages (alternative)
**Settings → Pages** → Source: `main` / root → Save. Custom domain: `tasks.totalchb.com`.

> After adding any new domain, add it in Firebase: **Authentication → Settings → Authorized domains**. Google sign-in fails on domains not listed there.

## Firebase setup (one-time)

Project: `universal-task-tracker`

1. **Authentication → Sign-in method** → enable **Google**.
2. **Firestore Database** → create (production mode).
3. **Firestore → Rules** → publish:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null
        && request.auth.token.email_verified == true
        && request.auth.token.email.matches('.*@(kpidriver|totalchb)[.]com$');
    }
  }
}
```

4. **Authentication → Settings → Authorized domains** → make sure these are listed:
   - `tasks.totalchb.com`
   - `<project>.vercel.app` (preview URL)

The Firebase web config in `index.html` is a public identifier, not a secret — access is protected by the rules above.

### Data model

| Path | Contents |
|---|---|
| `tasks/{taskId}` | `company` (`tchb` \| `kpi`), `title`, `owner`, `done`, `order`, `updatedBy`, `updatedAt`, `subs[]` (`id`, `title`, `owner`, `status`, `done`, `by`, `at`) |
| `meta/team` | `names[]` — the owner list |
| `meta/app` | `seeded` — set after the first sign-in loads the starting task list |

## Updating the app

The app is designed and maintained as a design file and exported to a single `index.html`.

1. Make changes in the design project and re-export `index.html`.
2. Replace `index.html` in this repo → commit → push. Vercel redeploys in ~30 seconds.

Task data lives in Firestore, so redeploying never affects tasks.

## Access & support

- **Who can sign in:** any Google account ending in `@totalchb.com` or `@kpidriver.com`.
- **Add a new domain:** update the Firestore rule and the allowed-domains list in the app, then redeploy.
- **Offline / local mode:** "Work Offline In This Browser" on the sign-in screen saves to that browser only and does not sync.

---

© Total Cash Home Buyers, LLC · KPI Driver. Internal use only.
