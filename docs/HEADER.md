# Header Standard (All Apps)

The Universal Team Hub's header and the section under it are the pattern for every app (TC Checklist, Title
Commitment Agent, Dispo Ops, …). Copy this layout, these sizes and these behaviours. The hub's own code is in
`app/app.dc.html`. Look for `headRef`, `syncBadge`, `acctItems`, `measure()`, `ringBox`, `hasProgLine` and `openDetails`.

Brand: Baloo 2 (display) and Nunito Sans (body), indigo `#4d458a` / `--tchb-indigo-700`, red `#bd2239` /
`--tchb-red-500`, Title Case, Eastern time. Every colour below is a design-system token, so light and dark both work.

## 0. Page Width and Margins (Use These in Every App)

| | Desktop | Phone (under 640px) |
| --- | --- | --- |
| Content width | `max-width: 1280px`, centred (`margin: 0 auto`) | full width |
| Side margins | `24px` | `16px` |
| Header bar padding | `14px 24px` (`8px 24px` once slimmed) | `10px 16px` (`8px 16px` slimmed) |
| Page body padding | `36px` top, `24px` sides, `96px` bottom | `20px` top, `16px` sides, `96px` bottom |
| Gap between sections | `24px` | `16px` |

The header's inner row and the page body use the same `1280px` width and side margins, so the logo, the title area,
the tabs and the cards all line up on the same left and right edges.

## 1. Header Bar

```
[ LOGO ] (● Wed 11/04/2026 7:42:07 AM EST)      [ TCHB 19% | KPI DRIVER 0% ]      [● Active 6] [☀ ☾] (AR)
 left group                                      middle                              right group
```

| Piece | Spec |
| --- | --- |
| Bar | Pinned (`position: sticky; top: 0; z-index: 30`). Background `color-mix(in srgb, var(--surface-card) 78%, transparent)` with `backdrop-filter: blur(10px)` and a `1px` bottom border `--border-default`. |
| Layout | Three groups in one wrapping flex row. Left and right are `flex: 1 1 0; min-width: max-content`, middle is `flex: none`. When the window is narrower than `1240px` (and not a phone), the middle drops to its own centred line under the other two. |
| Logo | `64px` high. The app's name can sit after the logo (TC Checklist does), but it is optional. |
| Live clock | Right of the logo: **one pill that is both the clock and the save status**, the same size as Active (`40px` high, padding `0 16px 0 14px`, Baloo `13px` bold, tabular numbers; `12px` on phones). It shows the time, one line, 12-hour Eastern: `Wed 11/04/2026 7:42:07 AM EST` (phones: `7:42:07 AM EST`), from the app's server-synced clock, never the device clock. The pill takes the save status's colours: **Live** is `--tchb-green-050` with `--tchb-green-600` text, a green border at 35%, a soft green glow (`0 2px 14px` green at 28%), a pulsing `8px` dot (`hubPing`, 2.2s) and a light sweep across it (`hubSheen`, 4.5s; white at 0.55 in light, 0.16 in dark). **Saving…** is indigo-050 / indigo-700, **Not Saved** and **Offline** are red-050 / `--status-error`, **Local Only** is gray. Only Live glows, pulses and shines. There is no separate "Live" word. |
| Live details | The clock is a button. It opens a small glass popover with the state as a heading ("Live: Everything Is Saved"), one plain sentence, "Last saved <date> <time> EST", and the action that fits: **Retry Now** while a change waits for a connection, **OK** after a change was refused. |
| Company switch | Middle. Gray-100 track, pills `9px 18px`, Baloo `14px`, the active one indigo with white text. Each shows its % done. |
| Active | Right group, first. Glass pill `40px` high: a pulsing green dot, "Active", and the count in a green-050 bubble. Opens the Online Now list (name, department, phone / desktop). |
| Light / dark | Right group, before the photo. Glass track with two icon-only buttons (`40×32`), sun and moon, no words. The chosen one is filled indigo. |
| Photo | Far right, `40px` circle with initials under the Google photo. Opens the photo menu (section 4). |

When the page scrolls past `120px`, the bar **slims down**: padding `8px` top and bottom, logo `44px`, and the
background goes to 94% so content doesn't show through. It returns to full size once you scroll back to within
`40px` of the top.

## 2. Under the Header

```
                    Universal Team Hub                               ← centred, no subheading
[ MGMT | Team | Personal ] [ All 12 | TC 9 | … ]       1/12      ◯19%   5/27
                                                    Tasks Done       Subtasks Done
```

| Piece | Spec |
| --- | --- |
| Title | Centred, Baloo `44px` extra bold (`30px` on phones), indigo with the second half red. No subheading line. |
| Tabs line | The view tabs (and department tabs where they exist) on the left, the completion on the right of the **same line**. |
| Completion | Two stats, each a number (Baloo `24px` extra bold, tabular) **centred over its label** (`12px` muted): "1/12 / Tasks Done" and "5/27 / Subtasks Done", with the ring (section 3) between them. There is no separate full-width progress bar. |
| Pinned tabs | The tabs line pins under the header while scrolling (`position: sticky`, top = header height plus any banner). Once pinned it gets a glass card behind it (surface at 84%, blur, `--border-default`, `--shadow-card`). |
| Sideways rows | Rows that scroll sideways (department tabs, status filters on phones) fade out over `28px` at whichever edge has more to show (`mask-image`). |

## 3. Rings, Bars and Cards (TC Checklist's Look)

Every % in the apps uses the same ring and bar, the ones TC Checklist's property cards use.

| Piece | Spec |
| --- | --- |
| Ring | `56px` circle (`44px` on phones): `background: conic-gradient(<colour> <pct>%, var(--tchb-gray-100) 0)`, with a `44px` (`35px`) circle of `--surface-card` in the middle holding the % in Baloo `13px` (`11px`) extra bold, tabular, indigo. **Red** (`--tchb-red-500`) while in progress, **green** (`--tchb-green-500`, text green-600) at 100%. |
| Bar | `6px` high, rounded, gray-100 track, the fill `--tchb-gradient-brand` (green-500 at 100%), up to `420px` wide, with the count beside it in `13px` bold muted: "1 of 4 Subtasks Done" / "14 of 79 Answered". When it's narrow the count wraps under the bar. |

**Card (desktop), one row:**

```
⠿ ☐  ◯25%  TC - 123 Main St, Akron OH 44301                       (MM Monz Miller ▾) [IN PROGRESS ▾] [▤ 1] ⌄ 🗑
            Edited by Monz Miller · 2h ago
            ████░░░░░░ 1 of 4 Subtasks Done  [TASK DEPLOYMENT …] [+ TEMPLATE] [📅 Fri 11/06]
```

- Left to right: drag handle, checkbox, ring, then title / meta / **progress line**, then owner, status, **Details**, expand, delete.
- **Progress line:** the bar and its count, then the item's tags on the same line ("Added By MGMT For …", "Task Deployment …", "+ Template", the due date chip, "Open In Title Agent"). It only wraps when there's no room, so a tag never adds a row on its own. No bar runs along the card's bottom edge.
- **Details:** one button (clipboard icon, `36px`) instead of separate Due Date, Notes, Activity and Files buttons. It shows the notes + files count and takes the due date's colour (a red tint that deepens as the date nears, red when late). It opens a panel with a toggle at the top, **Due · Notes · Activity · Files** (subtasks: Due · Notes · Files), and it opens on the part the person used last (Notes the first time), remembered in the browser. Each part shows its count in the toggle.

**Card (phone): header, progress line, footer.**

```
┌──────────────────────────────────────┐
│ ☐  TC - 123 Main St, Akron OH      ⌄ │   checkbox, title, meta; expand in the corner
│    44301                             │
│    Edited by Monz Miller · 2h ago    │
│ ◯25% ████░░░░░░ 1 of 4 Subtasks Done │   ring + bar on one line, across the card
│ [TASK DEPLOYMENT …] [+ TEMPLATE] [📅] │   tags
│──────────────────────────────────────│   thin divider
│ ⠿ (MM ▾) [IN PROGRESS ▾]     [▤ 1] 🗑 │   handle, owner, status · Details, delete
└──────────────────────────────────────┘
```

Subtasks on phones: the handle, checkbox and title on the first line, "Will · 5h ago" under the title, then owner, status, Details and remove on one line.

## 4. Photo Menu

A small glass menu right under the photo (a bottom sheet on phones):

1. You: photo (`40px`), name, email, and your role in red small caps ("Manager", or "Team Leader · TC", "Member · TC").
2. A divider.
3. **My Settings** (the person's own settings for this app; it may hold nothing yet), then the app's own tools as
   separate items (the hub: **Task Templates**), **Team Members** (managers only), **Help**, **Sign Out** (asks first).

Icons are 16px line icons in indigo, items are Baloo `14px` bold. Each app adds its own items between My Settings and
Help. Each item opens its own window.

## 5. Phones (under 640px)

- **Row 1:** logo (`40px`), the Live clock (time only, no date), and the photo in the top right corner.
- **Row 2:** the company switch, full width. It is hidden when the person has only one company.
- **Active and light/dark move into the photo menu.** At the top of the menu is a Light / Dark switch with words, and a **Who's Online** item with the count.
- The completion takes its own row under the tabs. Rings are `44px`. Cards follow the phone card in section 3.
- Scrolled: the header slims to row 1 only (logo `36px`, photo `40px`), and the completion hides so the pinned tabs stay small.
- When someone has no tabs to switch (one view only), the tabs line doesn't pin.
- Rows of buttons that would squeeze a label shrink to one button: "Expand All" and "Collapse All" become one button that does whichever fits, so "All Owners" keeps its full name.

## 6. Checks Before Shipping

Light and dark, desktop (1440, 1280, 1180, 1024) and phone (390, 360), signed in as a manager, a Team Leader and a
member. Nothing may scroll sideways. Scroll down to check the pinned header and tabs.
