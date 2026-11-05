<p align="center">
  <img src="tchb-logo.png" alt="Total Cash Home Buyers" height="64">
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="kpi-driver-logo.png" alt="KPI Driver" height="36">
</p>

<h1 align="center">Universal Team Hub</h1>

<p align="center">
  <strong>One live hub for every department's tasks, owners, and files across TCHB and KPI Driver.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TCHB-4D458A?style=for-the-badge" alt="TCHB">
  <img src="https://img.shields.io/badge/KPI%20DRIVER-3A7FC2?style=for-the-badge" alt="KPI Driver">
  <img src="https://img.shields.io/badge/Live%20Sync-109648?style=for-the-badge" alt="Live Sync">
  <img src="https://img.shields.io/badge/Internal%20Use-BD2239?style=for-the-badge" alt="Internal Use">
</p>

---

## What It Does

Plan the work, assign it, and watch it move — by department, in real time.

- **Departments** — TC, DISPO, ACQ and OPS. Everyone's personal list belongs to their main department.
- **Roles** — Managers see everything; Team Leaders see and assign within their departments; Members see their own list (plus their department when a manager turns that on).
- **Shared Work** — own a subtask on anyone's task and that task shows in your list, with the parts you don't own blurred.
- **Tasks & Subtasks** — check off subtasks and the main task closes itself, or complete the whole task in one click.
- **Clear Statuses** — Not Started, In Progress, Done and Cancelled, with the date each one started and finished. A cancelled subtask (red) stops counting and leaves its task open; Cancel Whole Task cancels every subtask (Reopen Task brings them back as they were). Cancelled work doesn't count toward anyone's % and has its own filter.
- **Details** — one button on each task and subtask opens its Due Date, Notes, Activity and Files, switched with a toggle; it opens on the part you used last and shows the notes + files count. The Files button above the list shows every task folder in the current view.
- **Progress at a glance** — each task shows TC Checklist's ring with its %, and a bar with "1 of 4 Subtasks Done" beside its pills on the progress line.
- **Live clock** — the hub's Eastern clock beside the logo, green while every change is saved, blue while saving, red when something didn't save; click it for the last saved time and Retry Now.
- **Safe Deleting** — delete tasks in your own list as before. Anyone else's task needs the department's Team Leader password; removing a subtask needs the department's subtask password; MGMT tasks and their subtasks are for managers. Checked on the server, and a copy of everything deleted is kept.
- **Two Company Boards** — TCHB and KPI DRIVER, each with its own tasks, progress, and brand look; access is set per person.
- **People** — managers set roles, departments and access in one place.
- **Pending First** — the task list opens on Pending (Not Started and In Progress together), then In Progress, Not Started and Done.
- **Photo menu** — clicking your photo opens a small menu, like TC Checklist's: your name, email and role, then My Settings (nothing to set yet), Task Templates, Team Members (managers), Help and Sign Out. The header is the pattern for the other apps; the full spec is in [docs/HEADER.md](docs/HEADER.md).
- **Task Templates** — save lists of subtasks in Task Templates (click your photo, then Task Templates) and Deploy one as a new task, named as you like; add another template to a deployed task later. Tagged *Task Deployment <template>*.
- **Upload Tasks** — make a task from a CSV file with a department's upload template (TC: *SOW*, named SOW - <address>); the file is kept on the task. Tagged *CSV Upload <template>*.
- **Search** — find tasks and subtasks by name; matching titles glow green and tasks open to show the subtasks that matched.
- **Who's Online** — the Active pill shows how many people are in the hub right now; click it for who, on phone or desktop (seen in the last five minutes).
- **Help** — your photo → Help opens the guide for the person's role (User, Team Leader or Manager) with screenshots; Team Leaders and managers also see the delete passwords they may use, loaded from the server after sign-in.
- **Light & Dark Themes**, phone-ready, and **Work Offline** with Push To Live.

## Access

Team members sign in with their company Google account. Access is limited to approved company domains, and what each person can see is enforced by the Firebase security rules in [`firebase/`](firebase/).

## Repository

```
index.html            The complete app (self-unpacking bundle)
app/app.dc.html       Readable source of the app (node tools/bundle.mjs unpack / pack)
api/                  Vercel functions that connect other apps (the Title Commitment Agent)
firebase/             Firestore and Storage security rules
README.md             This file
tchb-logo.png         Brand logo (README only)
kpi-driver-logo.png   Brand logo (README only)
```

## Deployment

Hosted on **Vercel**, connected to this repository. Every commit to `main` redeploys automatically.

## Updating

1. `node tools/bundle.mjs unpack`, edit `app/app.dc.html`, then `node tools/bundle.mjs pack`.
2. Commit both files.
3. Vercel publishes the update in about 30 seconds. Task data is stored separately and is never affected by updates.

## Deleting Tasks And Subtasks

The page sends these to `POST /api/hub/delete` (with the person's sign-in), which checks the rules in
`api/_lib/deletes.js` (tested: `node --test tests/deletes.test.js`), deletes, and keeps a copy in `trash/` (server only)
with who and when. The Firestore rules don't let the page delete anyone else's task or shrink a task's subtask list itself.
The passwords are only in the Vercel setting `HUB_DELETE_PASSWORDS` (JSON: `leads` and `subtasks` by department, `people`
by email for anyone with their own delete password); never put them in the code or this README.

## In-App Help

`help/guides.json` and `help/img/` are built from the three guides (User, Team Leader, Manager) with
`node tools/help-build.mjs <user.md> <lead.md> <manager.md> <screenshots dir>`. Each password table becomes a slot the
page fills from `POST /api/hub/passwords` (with the person's sign-in): managers get every department's passwords and
anyone's own, Team Leaders the departments they lead with Team view on, members none (`passwordsFor` in
`api/_lib/deletes.js`, tested). The build refuses to write a password into the Help files. Screenshots use made-up tasks.

Help also offers each guide as a PDF (Open / Download): `help/pdf/` holds the three guides without passwords. A Team
Leader's or manager's own copy gets a last page, *Your Delete Passwords*, built in the browser from the same
`/api/hub/passwords` answer (pdf-lib and fontkit in `help/vendor/`, brand fonts cut to Latin in `help/fonts/`). Team
Leaders can also open the User Guide, and managers all three, without passwords, to send to someone new.

## Login As User (Remy)

In Team Members, Remy can sign in as anyone who has signed in to the hub before (`POST /api/hub/login-as`). The hub signs
him in with a one-time Firebase sign-in for that person (marked `imp`), so he sees and changes exactly what they can.
An orange bar shows whose view it is, with Back To Remy, which switches straight back to his own account (the server only allows that from a sign-in he started; Google sign-in if it fails). Changes are logged as `<their name> (via Ahmed Ramy)`, they
don't show as online, and each use is kept in `audit/` (server only). The service account in
`HUB_FIREBASE_SERVICE_ACCOUNT` (hub-integrations) needs the Firebase Authentication Viewer role for this (it only looks people up; the sign-in is made with its own key).

## Task Templates, Upload Tasks And GHL

- Saved lists live in `templates/<login>` (each person's own; managers can see them). Monz starts with TC Deal Tasks,
  Wholesale and Novation (`STARTER_TEMPLATES` in the app, `STARTER` in `api/_lib/templates.js`).
- `POST /api/hub/upload` (with the person's sign-in) builds a CSV upload's task in the department Team Leader's list:
  owner the Team Leader, subtasks the uploader. Upload templates: `UPLOAD_TEMPLATES` in the app and `UPLOADS` in
  `api/_lib/templates.js` (tested: `node --test tests/templates.test.js`).
- `POST /api/hooks/ghl?key=<GHL_WEBHOOK_KEY>`: a GHL workflow deploys Monz's TC Deal Tasks as
  *TC - <address1>, <city> <state> <postal_code>*, one task per contact. Vercel settings: `GHL_WEBHOOK_KEY` (required),
  optional `GHL_DEPLOY_FOR` and `GHL_TEMPLATE`. Never put the key in the code or this README.

## Connecting Other Apps

The hub is built so other tools can create and update tasks. Each task records:

| Field | Meaning |
| --- | --- |
| `company` | `tchb` or `kpi` |
| `title`, `owner` | Task title and owner name (as in the team directory) |
| `subs[]` | Subtasks: `id`, `title`, `owner`, `status` (`todo` / `progress` / `done`), `due`, `notes[]`, `createdAt`, `startedAt`, `doneAt` |
| `status` | Only on a task with no subtasks: `todo` / `progress` / `done` (with subtasks, the task's status follows them) |
| `createdAt`, `startedAt`, `doneAt`, `due` | Dates (ms since epoch, shown in Eastern time) |
| `members` | `<company>:<login>` of everyone else who owns part of it, so it shows in their list |
| `files[]`, `notes[]`, `log[]` | Attachments, notes and the activity log |
| `source`, `ext` | The app that created it (shown as a tag on the card) and that app's link back |

Tasks live in a person's list (`personal/<login>/items`) and belong to that person's main department; MGMT tasks live in `tasks`. People, roles and departments are in `meta/directory`.

### Title Commitment Agent

Only **Closing Blockers** come over: one task per deal, **Title - &lt;address&gt;**, in Monz's list (TC), tagged *Added by Title Commitment Agent* with a link back to the deal. Each blocker is a subtask (the item; a note with the action needed and the source; its due date at 9:00 AM Eastern). Ticking or unticking a blocker in either app updates the other.

| Piece | Where |
| --- | --- |
| `POST /api/title-agent` | The agent sends a deal's Closing Blockers (after each review, re-run or change, and every 15 minutes); the hub creates or updates the task and answers with blockers ticked or unticked here. |
| `POST /api/title-agent/team` | The agent asks who is on the team (signed the same way, body `{}`); the hub answers `{"people": [{name, email, role, dept, photo}]}` with the Managers and the TC department from the team directory. Another app can add departments with `{"depts": ["TC", "DISPO"]}` (TC Checklist and Dispo Ops do, for names, each signed with its own secret: `TC_CHECKLIST_SYNC_SECRET` / `TC_CHECKLIST_SECRET` or `DISPO_OPS_SECRET`). Logs counts only. |
| `POST /api/title-agent/passwords` | The agent's in-app Help asks which delete passwords a person may see: body `{"email": "..."}` (team domains only, else 400), signed with `TITLE_AGENT_SYNC_SECRET` only. The answer is the same as `/api/hub/passwords` for that person (`{rows: [{dept, lead, sub}], own: [{name, pw}]}`: managers all, Team Leaders their departments, members none), sent with `Cache-Control: no-store`. Logs counts only. |
| `POST /api/title-agent/hub` | The hub page calls it after saving one of these tasks; the server sends the agent any blocker ticked or unticked here. |
| `api/_lib/titleagent.js` | The rules (tested in `tests/`: `node --test tests/title-agent.test.js`). |

Messages between the apps are signed with a shared secret. Vercel settings for this project: `HUB_FIREBASE_SERVICE_ACCOUNT` (a service account key for this Firebase project, role Cloud Datastore User), `TITLE_AGENT_SYNC_SECRET` (the shared secret; the agent has the same value as `HUB_SYNC_SECRET`), and optionally `TITLE_AGENT_ENGINE_URL` and `HUB_TITLE_OWNER` (default monz@totalchb.com). For TC Checklist: `TC_CHECKLIST_SYNC_SECRET` or `TC_CHECKLIST_SECRET` (either name works; the same value as TC Checklist's `HUB_SYNC_SECRET`). For Dispo Ops: `DISPO_OPS_SECRET` (the same value as Dispo Ops' `HUB_SYNC_SECRET`; it opens only the team list and Dispo Ops' own deal sync, `/api/dispo-ops`).

### TC Checklist

TC Checklist (tc.totalchb.com) takes names from the team directory (above) and uses the hub's delete passwords. Its
properties belong to TC, so only the TC Team Leader password and people's own passwords apply: Remy confirms, Brandy
uses her own, Managers and Team Leaders who see TC use the TC Team Leader password, and Members can't delete (they
mark the property Cancelled). Both endpoints are signed with `TC_CHECKLIST_SYNC_SECRET`; TC Checklist checks the
person's sign-in before asking. Passwords are never logged and never go into either app's pages or repositories.

| Piece | Where |
| --- | --- |
| `POST /api/tc-checklist/delete-check` | `{"email", "ask": true}` says what deleting needs (`confirm` or `password`); `{"email", "password"}` checks it. |
| `POST /api/tc-checklist/passwords` | The passwords TC Checklist's Help shows the person: Managers the TC one and anyone's own, TC Team Leaders the TC one, Members none. |
| `api/_lib/tcchecklist.js` | The rules (tested: `node --test tests/tcchecklist.test.js`). |

### DISPO OPS

DISPO OPS (dispo-ops.totalchb.com) sends each deal's progress one way, and the hub is a mirror of it: **DISPO OPS - &lt;address&gt;** in Carlos's list (DISPO), tagged *Added by DISPO OPS* with a link back, its ring showing the deal's overall % in DISPO OPS. Each phase of the deal is a subtask titled on two lines, "&lt;phase&gt; · &lt;%&gt;" then "Working On: &lt;group&gt; › Next: &lt;task&gt;" ("Starts With:" before the phase has begun, "Complete" at 100%), owned by the owner of that task in DISPO OPS, In Progress once anything in it is done and Done at 100%. Closed in DISPO OPS marks every phase and the task Done; Cancelled sets the task's status to `cancelled` with a note; a removed deal gets a note and is no longer updated. Closed or cancelled deals that were never sent get no task. Nothing is sent back: changes made to these tasks here are put back by the next sync (after each change in DISPO OPS, and daily at 7:15 AM ET), and a task deleted here is made again. Subtasks people add here are left alone.

| Piece | Where |
| --- | --- |
| `POST /api/dispo-ops` | DISPO OPS's Cloud Functions send a deal after each change that moves its progress, plus a daily catch-up; the hub creates or updates the task (link record `hubsync/dispo-ops-<deal>`, server only). |
| `POST /api/title-agent/team` | DISPO OPS asks for every department (`{"depts": ["TC", "DISPO", "ACQ", "OPS"]}`) when a Manager clicks Refresh From Hub. |
| `api/_lib/dispoops.js` | The rules (tested: `node --test tests/dispo-ops.test.js`). |

Vercel settings: `DISPO_OPS_SECRET` (the same value as DISPO OPS's `HUB_SYNC_SECRET` in its Firebase secrets; it opens only these two endpoints) and optionally `HUB_DISPO_OWNER` (default carlos@totalchb.com).

## Support

Questions or access requests: contact the TCHB / KPI Driver operations team.

---

<p align="center">
  <sub>© Total Cash Home Buyers, LLC · KPI Driver — Internal use only. Not for public distribution.</sub>
</p>


