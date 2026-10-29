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
- **Clear Statuses** — Not Started, In Progress, Done, with the date each one started and finished.
- **Files** — attach documents to any task or subtask; the Files button shows every task folder in the current view.
- **Notes** — leave notes on tasks and subtasks, with who wrote them and when.
- **Two Company Boards** — TCHB and KPI DRIVER, each with its own tasks, progress, and brand look; access is set per person.
- **People** — managers set roles, departments and access in one place.
- **Light & Dark Themes**, phone-ready, and **Work Offline** with Push To Live.

## Access

Team members sign in with their company Google account. Access is limited to approved company domains, and what each person can see is enforced by the Firebase security rules in [`firebase/`](firebase/).

## Repository

```
index.html            The complete app (self-unpacking bundle)
app/app.dc.html       Readable source of the app (node tools/bundle.mjs unpack / pack)
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

## Connecting Other Apps

The hub is built so other tools (the Title Agent, the daily EOD report) can read and create tasks. Each task records:

| Field | Meaning |
| --- | --- |
| `company` | `tchb` or `kpi` |
| `title`, `owner` | Task title and owner name (as in the team directory) |
| `subs[]` | Subtasks: `id`, `title`, `owner`, `status` (`todo` / `progress` / `done`), `createdAt`, `startedAt`, `doneAt` |
| `createdAt`, `startedAt`, `doneAt` | When the task was created, first went In Progress, and was finished (ms since epoch) |
| `members` | `<company>:<login>` of everyone else who owns part of it, so it shows in their list |
| `files[]`, `notes[]` | Attachments and notes |
| `source` | Name of the app that created it, shown on the card as "From …" |

Tasks live in a person's list (`personal/<login>/items`) and belong to that person's main department; MGMT tasks live in `tasks`. People, roles and departments are in `meta/directory`. An app creating a department task (for example "Property X Title Blockers" in TC) writes it to that department's team leader's list with the blockers as subtasks.



## Support

Questions or access requests: contact the TCHB / KPI Driver operations team.

---

<p align="center">
  <sub>© Total Cash Home Buyers, LLC · KPI Driver — Internal use only. Not for public distribution.</sub>
</p>


