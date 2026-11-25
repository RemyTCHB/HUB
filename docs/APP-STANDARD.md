# TCHB App Standard (Every Internal App)

Every app we build for Total Cash Home Buyers and KPI DRIVER looks and works the same way. The Universal Team Hub,
TC Checklist, the Title Commitment & Lien Agent and DISPO OPS all follow this. **What an app does is its own; everything
in this document is shared.** When you start a new app, give it this document first (the prompt is at the end).

- This file: https://raw.githubusercontent.com/RemyTCHB/HUB/main/docs/APP-STANDARD.md
- The header, page width, cards and phone layout in full detail: [`docs/HEADER.md`](HEADER.md)
  (https://raw.githubusercontent.com/RemyTCHB/HUB/main/docs/HEADER.md)
- The colours, fonts, light and dark: [`docs/app-kit/tokens.css`](app-kit/tokens.css), the hub's own tokens in one file
- The brand itself (logos, voice, colour names): the Total Cash Home Buyers Design System in Claude
  (https://claude.ai/artifact/HWebf8nYjBXDA9jvif1ZRK). Where it and this file differ for an app, this file wins: the
  design system was written for the marketing website.
- The live example of everything below: hub.totalchb.com (code: `app/app.dc.html` in this repository)

## 1. The Look

| | Rule |
| --- | --- |
| Tokens | Load `docs/app-kit/tokens.css` first and use its variables for every colour, font, radius and shadow. Never type a hex colour into a component. |
| Fonts | Baloo 2 for headings, buttons and numbers; Nunito Sans for text. |
| Colours | Indigo `--tchb-indigo-700` (#4d458a) for headings and the main structure, red `--tchb-red-500` (#bd2239) for the primary action and the second half of titles, green `--tchb-green-500` only for money, success and 100%. |
| Writing | Title Case for titles, buttons and labels. Plain words, no emoji. Times in Eastern time, 12-hour (`7:42 PM EST`). |
| Light and dark | Both, always. Light is the default; the person's choice is remembered on their device. `data-theme="dark"` on `<html>` switches every token. |
| KPI DRIVER | An app used by both companies switches to KPI DRIVER's colours with `data-company="kpi"` on `<html>`, and shows the KPI DRIVER logo. Write the name **KPI DRIVER** in capitals, as the hub's company switch does. |
| Glass | The header, menus and pills are frosted glass (`--glass-*` tokens, `backdrop-filter: blur(10px)`). Cards are solid `--surface-card` with `--border-default` and `--shadow-card`. |
| Background | `--surface-subtle`, with the soft moving colour glow behind it (the hub's background canvas; DISPO OPS calls it the aurora). |
| Motion | Short and quiet: 120 to 200 ms fades and lifts. Only the Live clock pulses and shines. |
| Icons | 16 to 24 px line icons (Lucide style, 2 px stroke, `currentColor`). |

## 2. Page Width and Spacing

Content is at most **1280 px** wide and centred, with **24 px** sides (16 px on phones). Page padding `36px 24px 96px`
(`20px 16px 96px` on phones), 24 px between sections (16 px on phones). The header uses the same width, so everything
lines up. Details: HEADER.md, section 0.

## 3. The Header and the Line Under It

One pinned header in every app (HEADER.md, sections 1 and 2):

```
[ LOGO ] (● Wed 11/04/2026 7:42:07 AM EST)      [ middle: company switch or page tabs ]      [app buttons] [● Active 6] [☀ ☾] (photo)
```

- **Logo** 64 px (phones: the company's round icon, 44 px).
- **Live clock**: one pill that is both the time and the save status. Green with a pulse and sheen when everything is
  saved and connected, indigo while saving, red when a save failed or the connection is lost, grey when the app works
  offline. It is a button: it opens a small panel saying what the state means, when it last saved, and Retry Now when
  that helps.
- **Middle**: the company switch (TCHB | KPI DRIVER, with each company's % done) when the app has both companies,
  otherwise the app's page tabs in the same pill style, otherwise empty.
- **Right**: buttons only this app has (a notifications bell), then **Active**, then the light / dark switch (icons
  only), then the person's **photo**.
- Pinned at the top; on scroll only its padding slims (6 px). The logo, clock and photo keep their size.
- Under it: the page title centred (indigo, second half red, no subheading), then one line with the page's tabs on the
  left and its two or three key numbers on the right (each number centred over its label, the TC Checklist ring
  between them). That line pins under the header with a glass card behind it.

## 4. Cards, Rings, Bars and Details

Use the hub's card for any list of work (HEADER.md, section 3): checkbox, the % ring, the title with an
"Edited by … · ago" line, the progress line (bar + "n of m Done" + tags on the same line), then owner, status, one
**Details** button (Due · Notes · Activity · Files in one panel, opening on the part used last) and delete. Phones get
the three-part card: header, progress line, footer. Any % anywhere is the same ring (red while in progress, green at
100%) or the same 6 px bar.

## 5. The Photo Menu

The photo opens a small glass menu (a bottom sheet on phones), in this order:

1. The person: photo, name, email, and their role in red small caps ("Manager", "Team Leader · TC", "Member · DISPO").
2. **My Settings**: the person's own settings for this app (for example the hub's Daily Digest Email switch and Send Me
   A Test). It may hold little at first; it still exists.
3. The app's own tools, each its own item (the hub: Task Templates).
4. **Team Members** (Managers only).
5. **Help**.
6. **Sign Out** (it asks first).

On phones the menu also starts with a Light / Dark switch with words and a **Who's Online** item with the count,
because those leave the header there.

## 6. Signing In and Access

- Google sign-in through Firebase Authentication. Only **verified @totalchb.com** accounts (the hub also accepts
  @kpidriver.com accounts, and treats the two KPI managers' addresses as the same people). Anyone else sees a clear "this account doesn't have access" page.
- The server checks the person's Firebase sign-in on every request that changes data. Firestore and Storage rules let
  each person read what their role allows and write only what they own; anything sensitive is written by the server.
- Pages send `X-Robots-Tag: noindex, nofollow` (set in `vercel.json`); the apps are internal and stay out of search engines.

## 7. People: the Hub Is the One Team List

The hub's **Team Members** is the only place people are added, removed or given a role. Every other app takes its team
from the hub; no app keeps its own list of names.

- **Roles**: Manager, Team Leader, Member. **Departments**: TC, DISPO, ACQ, OPS, FUS. Managers are the hub's two root
  managers plus anyone made a manager in the hub. A Team Leader may see more departments than their own (Dept View).
- **How an app gets the team**: its server calls `POST https://hub.totalchb.com/api/title-agent/team` with
  `{"depts": ["TC", "DISPO"]}` (the departments it needs; Managers always come), signed with the app's own secret
  (section 10). The answer is `{"people": [{name, email, role, dept, photo}]}`.
- **When**: read it at most every 10 minutes and use it as is (TC Checklist, the Title Commitment & Lien Agent), or copy
  it when a Manager opens the app and the copy is over an hour old (DISPO OPS). Either way a change in the hub shows up
  on its own, with no button to press.
- The app's **Team Members** page is read-only: it shows who's who and says "change people in the Team Hub". Login As
  User (section 9) lives there.
- Names and emails live only in the databases, never in the code, tests or README (the repositories are public).

## 8. Active: Who's Online

Each open app checks in every minute (`presence/{email}` with one entry per device: when it was last seen and whether
it's a phone or a desktop). Seen in the last five minutes means online. The Active pill shows the count; clicking it
lists the people with their department and phone / desktop. Signing out marks that device gone. Viewing as someone
else (Login As) checks nobody in. Where the page may not write to the database, it checks in through the app's server.

## 9. Login As User (Remy Only)

From Team Members, the owner (`systems@totalchb.com`; in other apps the secret `LOGIN_AS_OWNER`, never written in the
code) can view the app exactly as someone else sees it. The server makes a one-time sign-in for that person marked with
the owner's email; an orange bar across the top says whose view it is, with **Back To** to return. Anything changed
meanwhile is recorded as "<them> (via <owner>)", and each use is kept in an `audit/` record only the server can read.

## 10. Talking to the Hub

Apps and the hub talk server to server, each message signed with a secret the two share:

- Headers `X-Hub-Timestamp` (Unix seconds) and `X-Hub-Signature` = `sha256=` + HMAC-SHA256 (hex) of
  `<timestamp>.<raw body>`, with the shared secret. A message older than 5 minutes is refused.
- Each app has **its own secret**, stored in both places by name only: in the hub's Vercel settings (for example
  `TC_CHECKLIST_SECRET`, `DISPO_OPS_SECRET`, `TITLE_AGENT_SYNC_SECRET`) and in the app's own settings (usually
  `HUB_SYNC_SECRET`). A new app needs one more name added in the hub (`api/title-agent/team.js`) before the hub accepts it.
- **Tasks in the hub**: an app that sends work to the hub creates one hub task per item, in the right person's list,
  tagged "Added by <App>" with a link back ("Open In <App>"). Decide with the owner whether it is one way (the hub
  mirrors the app, like DISPO OPS) or both ways (ticks in the hub go back, like the Title Commitment & Lien Agent).
- **Delete passwords** live only in the hub (`HUB_DELETE_PASSWORDS`). An app that needs them asks the hub (signed) to
  check one, or to give the person the ones their role may see for Help; the app never stores or logs them.

## 11. Help and the Guides

Every app has **Help** in the photo menu: a panel with the guide for the person's role (Member, Team Leader or Manager;
an app may name them for its team, like the TC Guide), contents down the side (a row on tablets, full screen on
phones), and the guide PDFs at the top to open or download.

- One guide per role, written as Markdown and built by a script into the PDFs and the in-app version (the hub:
  `tools/help-build.mjs`; the Title Commitment & Lien Agent: `docs/guide/build_guide.py`).
- The shared PDFs never hold passwords. A Team Leader's or Manager's own copy gets a last page, Your Delete Passwords,
  added in their browser from the hub's answer.
- Screenshots use made-up people and tasks only.
- Rebuild the guides whenever what they describe changes.

## 12. Daily Emails

When an app sends a daily email, it looks like the hub's Daily Digest and the Title Commitment & Lien Agent's Daily
Summary:

- Email-safe tables and inline styles in the same colours and fonts; the logo at the top left, "<App> Daily Digest" at the
  top right; a date line in red caps; a big indigo-and-red heading; four number tiles; white cards on a soft grey band;
  one indigo button back to the app; a small footer saying when it's sent, to whom, and how to turn it off.
- 8:00 AM Eastern, recapping the day before. One email per company when the app has both. No email on a day with
  nothing to say.
- Sent through Resend (`RESEND_API_KEY`). Scheduled by Vercel Cron (12:00 and 13:00 UTC, sending once after 8 AM
  Eastern) or Google Cloud Scheduler. A **Send Me A Test** button sends it to the person only, and a go-live setting
  (for example `HUB_DIGEST_ENABLED`) must be on before anyone else gets it.

## 13. Phones

Under 640 px: row 1 is the round company icon, the Live clock (time only) and the photo; the company switch or page
tabs go full width under it (or stay in the app's bottom bar, like DISPO OPS); Active and light / dark move into the
photo menu; cards use the three-part phone card; nothing scrolls sideways. HEADER.md, section 5.

## 14. Privacy and Secrets

- The repositories are **public**. Never commit real deals, addresses, people's names or emails, passwords, keys or
  exports. Tests, fixtures and screenshots use made-up data.
- Secrets live only in Vercel, GitHub or Google Cloud settings, and documents name them, never show them. Never ask
  for or paste a secret in a chat.
- Server logs print counts only, never names, emails or deal details.

## 15. Hosting

- Pages on Vercel (a push to `main` deploys), data in a Firebase project per app, server work in Vercel functions or
  Cloud Run.
- Vercel's plan allows **12 functions** per deployment: group small endpoints behind one function (the hub's
  `api/hub/[op].js`) rather than adding a file each.
- The time always comes from a server (the website's own `Date` header, read on load, every 15 minutes and when the
  page comes back), never the device's clock.

## 16. Checks Before Going Live

- Light and dark; desktop 1440, 1280, 1180 and 1024 px; phone 390 and 360 px; at the top of the page and scrolled.
- Signed in as a Manager, a Team Leader and a Member (Login As makes this quick).
- Nothing scrolls sideways; no errors in the browser console.
- The app's tests pass against the Firebase emulators with made-up data, never the live database.
- Screenshots to the owner before anything goes live; the owner says go.

## Starting a New App

Paste this into a new Claude session, with the blanks filled in:

```
Build <App Name> for Total Cash Home Buyers.

First read our app standard and follow it for everything shared (look, header, Live clock, Active, photo menu,
My Settings, Team Members from the hub, Help and guides, light/dark, spacing, phones, privacy):
https://raw.githubusercontent.com/RemyTCHB/HUB/main/docs/APP-STANDARD.md
and the details it links to (docs/HEADER.md, docs/app-kit/tokens.css). The live example is hub.totalchb.com.

What this app does: <the job, in a few sentences>
Who uses it: <departments / roles; which roles can do what>
Companies: <TCHB only, or TCHB and KPI DRIVER>
Its data: <what it keeps, and anything it reads from elsewhere>
Connections: <does it send tasks to the hub? one way or both ways? any daily email?>
Pages: <the screens it needs>

Before building, tell me what you understood, list the screens and anything from the standard you would skip, and
ask me what you need in a form. Show me a mock-up before going live.
```
