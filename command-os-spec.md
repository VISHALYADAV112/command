# COMMAND — Personal Operating System
### Full build specification & design brief
Version 1.1 · Phase 1 · Market-checked August 2026

---

## 0. HOW TO USE THIS DOCUMENT

This document is self-contained. It carries the entire context of the design conversation, so it can be pasted into a fresh Claude Design session (or any other tool) with no additional explanation.

- **Sections 1–3** are context. Give these to Claude Design so it understands who this is for.
- **Sections 4–10** are the build spec. These are the exact instructions for constructing the workspace in Notion, via MCP or by hand.
- **Section 11** is the visual design brief, written specifically as a prompt for Claude Design.
- **Section 12** is what deliberately does not get built.

Suggested workflow: design the dashboard visually first (Section 11), then build the databases (Sections 5–6), then assemble the dashboard to match the design (Section 7).

---

## 1. WHO THIS IS FOR

Fresher in AI/ML, based in India. Currently doing an AI/ML internship — researching and comparing models, selecting the best fit for a task, optimizing, and designing overall architecture. Alongside that: a small amount of freelance work, an interest in finding international clients, and an exploratory interest in product/startup ideas.

**Primary goal:** land a high-paying software role at a large product company — Google, Amazon, or equivalent — in India, at 20–30 LPA. Target window is 8–10 months.

**Two lanes, not one.** Both are pursued in parallel because the daily work overlaps almost entirely:

- **SDE lane** — higher ceiling, gated on DSA and system design. This is where the 20–30 LPA numbers live.
- **Applied AI/ML lane** — gated on Python, shipped projects, and problem-solving rather than an advanced degree. Lower ceiling (roughly 5–15 LPA for freshers) but a much better fit for the existing internship, and a shorter path to a first offer.

Research-track ML roles do require an MS or PhD and are out of scope. Applied ML roles are not.

**Abroad — reframed.** A fresher-level jump to a foreign country is unrealistic. But foreign-company compensation is available from India in this cycle, via two routes that need no visa: **GCCs** (global capability centres in Bengaluru and Hyderabad, hiring specifically for AI talent at above-local rates) and **remote roles serving US/EU product teams**. These are treated as a distinct, actively-tracked pipeline — not a someday goal. Physical relocation, if wanted, comes later via internal transfer or a Master's.

**Personal:** already has a stable morning routine — meditation at 5:30, gym at 6:15. Wants to develop deep mathematical ability over years, not months, as an end in itself rather than for career reasons.

---

## 2. DECISIONS ALREADY MADE

These were worked out during design and should not be re-litigated by any tool consuming this document.

| Area | Decision | Reasoning |
|---|---|---|
| Learning tracks | Node.js 1h · DSA 2h · Math 1h daily | DSA is the deadline-driven priority; Node keeps build skills warm; math is a long-horizon practice |
| Aptitude | Parked | Low value for target roles. 3-week sprint only if a specific company's process requires it |
| Memory training | Not a daily slot | Learn mnemonic techniques once (~2 weeks), apply to DSA patterns and math. No brain-training apps |
| Math branch | Undecided by design — start with proof fundamentals | Velleman's *How to Prove It* first (2–3 months), then choose a branch on evidence rather than guesswork |
| Job-hunt time | 1h/day floor, non-negotiable | Always loses to client work otherwise |
| Freelance/ideas time | Whatever remains of the 2h work block | Ideas are captured, not chased mid-week |
| Spaced repetition | Inside Notion, manual, two fields | One app beats two apps that go unopened. Elaborate formula-driven SR setups get abandoned |
| Gym/diet apps | No integration | Hevy and Cronometer hold detail. Notion holds three checkboxes |
| Calendar | Google as single source, synced into Notion Calendar | Apple Calendar support is limited; share iCloud into Google if needed |
| Build scope | Phase 1 only — 6 databases | Twelve-database workspaces get abandoned by week five |
| Lanes | SDE and applied AI/ML pursued in parallel | Daily work overlaps almost entirely; AI/ML applied roles don't require an advanced degree |
| Abroad | GCC and remote-international tracked as a live pipeline | Foreign-company pay is reachable from India now; relocation comes later |
| Applications | Timed to hiring windows, not spread evenly | Fresher hiring is seasonal — missing a window costs a full cycle |
| Portfolio | Three public projects as an explicit target | Market screens on shipped work; the Node hour has to surface somewhere visible |

### Scheduling philosophy

The system runs on **weekly hour budgets with daily floors**, not a rigid daily schedule. The named practices are *flexible time blocking* and *floor-and-ceiling habits*.

- **Weekly budget:** Node 7h · DSA 14h · Math 7h · Job hunt 7h
- **Daily floors:** Node 30m · DSA 1h · Math 30m · Job hunt 1h
- **Ceilings:** none — follow interest once floors are met
- **Rule:** floors before ceilings

Floors exist to protect DSA specifically, since it is the least pleasant track and the one interest-following will starve.

### Current baseline

~20 DSA problems solved. Target is 300–400 with genuine pattern fluency. Applications begin at month 2–3 regardless of readiness, treated as diagnostics.

---

## 2A. MARKET REALITY (checked August 2026)

The numbers the plan is calibrated against. Re-check these before any major strategy change.

**The market is tight for freshers.** Roughly 13% of India's ~119,000 active tech openings are fresher roles. AI has absorbed much of the entry-level work and campus drives have shrunk. A low application-to-response rate is the base rate, not a personal signal.

**Compensation bands.**

| Outcome | Band |
|---|---|
| Google India, fresher | ₹25–35 LPA |
| Amazon SDE-1 | ₹20–25 LPA |
| Off-campus product hire, strong DSA + projects | ₹8–15 LPA |
| Applied AI/ML fresher | ₹5–12 LPA · ₹15 with real projects |

The 20–30 LPA target is real but is the top slice. Plan for the ₹8–15 band as the likely first offer, and treat it as a stepping stone rather than a failure.

**What the market rewards.** Hiring in 2026 favours AI literacy, practical shipped project experience, and strong fundamentals over degree pedigree. Off-campus is now the dominant fresher hiring channel, which means college tier is much less of a gate than it was.

**Hiring is seasonal.** February is the strongest month, with a second peak in autumn as companies close headcount before year-end freezes. Marquee programs (Google STEP, Amazon SDE Intern and similar) have hard deadlines in narrow windows. Missing one costs a full cycle — this is why the system tracks windows, not just applications.

**Cold applying has poor odds.** Portal applications with no experience are where most freshers stall. This is the single strongest argument for the People database.

---

## 3. THE DAY

```
05:30 – 06:00   Meditation
06:15 – 08:00   Gym
08:00 – 09:00   Breakfast, get ready

09:00 – 18:00   Core block
                ├─ 4h  Learning     Node 1h · DSA 2h · Math 1h
                ├─ 2h  Internship   AI/ML work
                └─ 2h  Job hunt (1h floor) + freelance / opportunities

18:00 +         Free. Light work on ideas if energy allows
```

Fixed blocks live in Google Calendar as recurring events. Notion does not schedule — it records.

---

## 4. WORKSPACE STRUCTURE

Six databases, one dashboard, five sub-pages. Nothing else.

```
🏠 COMMAND                       ← the only page opened daily
   │
   ├─ 📚 Learning                → Learning DB
   ├─ 💼 Work                    → Projects DB
   ├─ 🎯 Job Hunt                → Job Hunt DB + People DB
   ├─ 💡 Ideas                   → Ideas DB
   └─ 🗄️ Archive                 → plain page, dumping ground
```

Daily Log lives inline on Command itself and has no sub-page.

**Naming:** the workspace is called **Command**. Alternatives if preferred: Basecamp, The Deck, Runway. Avoid anything containing a personal name or the phrase "life OS."

---

## 5. DATABASE SPECIFICATIONS

Exact property names, types, and options. Build these first, before any dashboard work.

---

### 5.1 Daily Log

The spine of the system. One row per day. Seven fields, all fast to fill.

| Property | Type | Options / Notes |
|---|---|---|
| `Date` | Title | Format as `2026-08-22`. Title rather than date property so rows read cleanly in linked views |
| `Day` | Date | The actual date property, used for filtering |
| `Meditation` | Checkbox | — |
| `Gym` | Checkbox | — |
| `Diet` | Select | `On track` · `Loose` · `Off` |
| `Node hrs` | Number | Decimal, 1 place |
| `DSA hrs` | Number | Decimal, 1 place |
| `Math hrs` | Number | Decimal, 1 place |
| `Job hunt hrs` | Number | Decimal, 1 place |
| `Note` | Text | One line, optional. Not a journal |

**Rules:** log actual hours, never intended hours. No other properties get added to this database — every field added here is friction paid daily.

---

### 5.2 Learning

Concepts, patterns, snippets, and formulas worth keeping and reviewing.

| Property | Type | Options / Notes |
|---|---|---|
| `Concept` | Title | Short and specific — "Sliding window: variable size" not "Arrays" |
| `Stack` | Select | `Job` · `Brain` |
| `Track` | Select | `Node` · `DSA` · `Math` |
| `Type` | Select | `Concept` · `Pattern` · `Snippet` · `Formula` |
| `Confidence` | Select | `1` · `2` · `3` · `4` · `5` |
| `Difficulty` | Select | `Easy` · `Medium` · `Hard` |
| `Next review` | Date | Set manually after each review. Cleared when confidence hits 5 twice running |
| `Source` | URL | Optional |

**Page body is where the value lives.** Code blocks for snippets, `/math` LaTeX blocks for formulas, and an explanation written in the user's own words. An entry copied verbatim from a source is worthless for recall practice.

**Capture rate:** 2–4 entries per day. Not everything read. If the review queue regularly exceeds 15 items, the problem is over-capturing, not under-reviewing.

---

### 5.3 Job Hunt

One row per application.

| Property | Type | Options / Notes |
|---|---|---|
| `Company` | Title | — |
| `Role` | Text | — |
| `Lane` | Select | `SDE` · `AI/ML` — which preparation this role draws on |
| `Channel` | Select | `India product` · `GCC` · `Remote intl` · `Services` — GCC and Remote intl are the no-visa foreign-comp routes and get tracked deliberately |
| `Status` | Select | `Researching` · `Applied` · `OA` · `Phone` · `Onsite` · `Offer` · `Rejected` |
| `Window closes` | Date | Application deadline. Blank for rolling roles. Drives the hiring-window view |
| `Applied date` | Date | — |
| `Referral?` | Checkbox | — |
| `Referrer` | Relation → People | — |
| `CTC (LPA)` | Number | — |
| `Next action` | Text | Must always be filled. A row with no next action is a dead row |
| `Follow-up date` | Date | Drives the dashboard view |
| `Link` | URL | — |
| `Resume version` | Select | `v1` · `v2` · `v3` — add as needed |

**Status colours:** grey for Researching, blue for Applied, amber for OA/Phone/Onsite, green for Offer, red for Rejected.

---

### 5.4 People

The referral pipeline. **This is the highest-leverage database in the workspace** — off-campus applications at large companies mostly die at the resume screen, and a referral is the single biggest controllable factor.

| Property | Type | Options / Notes |
|---|---|---|
| `Name` | Title | — |
| `Company` | Text | — |
| `How I know them` | Select | `Cold` · `Alumni` · `LinkedIn` · `Ex-colleague` · `Referred by` |
| `Status` | Select | `To reach out` · `Talking` · `Referred` · `Cold` |
| `Last contact` | Date | — |
| `Next follow-up` | Date | Drives the dashboard view |
| `Notes` | Text | — |
| `Applications` | Relation → Job Hunt | Auto-created by the Job Hunt relation |

**Weekly quota:** contact two new people per week. Non-negotiable, same status as the hour floors.

---

### 5.5 Projects

Internship and freelance in one table, separated by a field. Two databases here would be over-engineering.

| Property | Type | Options / Notes |
|---|---|---|
| `Project` | Title | — |
| `Type` | Select | `Internship` · `Freelance` |
| `Status` | Select | `Active` · `Blocked` · `Review` · `Done` |
| `Client` | Text | Blank for internship work |
| `Deadline` | Date | — |
| `Payment status` | Select | `N/A` · `Unpaid` · `Invoiced` · `Paid` |
| `Amount` | Number | Currency format |
| `Public?` | Checkbox | Is this visible to a recruiter — public repo, live demo, written up |
| `Repo / demo` | URL | — |
| `Next action` | Text | — |

**Page body carries the AI/ML work:** models compared, architecture decisions, datasets, metrics, meeting notes. Deliberately free-form in Phase 1. After a month of real use, the recurring structure will be obvious and can be extracted into a proper Experiments database (Phase 2).

**Portfolio rule.** The market screens on shipped work, so the daily Node hour must eventually surface as something a recruiter can open. Target: **three projects at `Public? = true`** — finished, documented, with a live demo or a clean README. Three real projects outperform another fifty DSA problems in the AI/ML lane. Unfinished work stays private; there is no credit for a half-built repo.

---

### 5.6 Ideas

Capture, don't chase.

| Property | Type | Options / Notes |
|---|---|---|
| `Idea` | Title | — |
| `Problem` | Text | Who has it, and how much does it hurt |
| `Target market` | Text | — |
| `Monetization` | Text | — |
| `Status` | Select | `Captured` · `Exploring` · `Validating` · `Dropped` |
| `Next action` | Text | — |

**Default status is `Captured`.** Ideas are reviewed on Sundays only, and at most one gets promoted to `Exploring` per week. This database has no dashboard view — only a capture button — precisely so it doesn't pull attention mid-week.

---

## 6. RELATIONS

Only one relation exists in Phase 1:

```
Job Hunt.Referrer  ──→  People.Applications
```

That is deliberate. Every additional relation is maintenance debt. Daily Log connects to nothing. Learning connects to nothing. Projects connects to nothing.

---

## 7. DASHBOARD LAYOUT

Ordered top to bottom, because mobile scrolls and the top of the page is the only guaranteed real estate.

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   COMMAND                                          [icon]    │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ╭────────────────────────────────────────────────────────╮  │
│  │  Node 30m · DSA 1h · Math 30m · Job hunt 1h            │  │  ← accent callout
│  │  Floors first, then follow interest.                   │  │     static, never edited
│  │  Review queue 10m before DSA.                          │  │
│  ╰────────────────────────────────────────────────────────╯  │
│                                                              │
│   [ ▸ Log today ]   [ + Concept ]   [ + Application ]        │  ← button row
│   [ + Idea ]                                                 │
│                                                              │
│  ────────────────────────────────────────────────────────    │
│                                                              │
│   THIS WEEK                                                  │
│   ┌──────┬──────┬──────┬──────┬──────┬────┬────┬────────┐   │
│   │ Date │ Node │ DSA  │ Math │ Job  │ 🧘 │ 🏋 │ Diet   │   │
│   ├──────┼──────┼──────┼──────┼──────┼────┼────┼────────┤   │
│   │ ...  │      │      │      │      │    │    │        │   │
│   ├──────┼──────┼──────┼──────┼──────┼────┼────┼────────┤   │
│   │ Sum  │ 6.5  │ 12.0 │ 5.5  │ 7.0  │    │    │        │   │  ← column sums ON
│   └──────┴──────┴──────┴──────┴──────┴────┴────┴────────┘   │
│   Budget: Node 7 · DSA 14 · Math 7 · Job 7                   │
│                                                              │
│  ────────────────────────────────────────────────────────    │
│                                                              │
│   ┌───────────────────────┐  ┌───────────────────────────┐  │
│   │  JOB HUNT             │  │  WORK                     │  │
│   │                       │  │                           │  │
│   │  Active applications  │  │  Deadlines this week      │  │
│   │  by follow-up date    │  │                           │  │
│   │  ·····                │  │  ·····                    │  │
│   │                       │  │                           │  │
│   │  People to contact    │  │                           │  │
│   │  ·····                │  │                           │  │
│   └───────────────────────┘  └───────────────────────────┘  │
│                                                              │
│  ────────────────────────────────────────────────────────    │
│                                                              │
│   REVIEW QUEUE                                    3 due      │
│   ·····                                                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Block-by-block build instructions

**Block 1 — Header**
Page title `Command`. Page icon: a simple monochrome icon, not a colourful emoji. Cover image: none, or a very dark abstract gradient. Full-width **off**. Small text **off**.

**Block 2 — Floors callout**
A single callout block in the accent colour. Contains the four floors and two short rules. This text is static and never edited. It exists to answer "what is the minimum today" in under a second.

**Block 3 — Button row**
Four buttons in a single row (they wrap on mobile). Specifications in Section 8.

**Block 4 — This Week**
A linked view of **Daily Log**.
- View type: Table
- Filter: `Day` → is within → past week
- Sort: `Day` descending
- Properties shown: Date, Node hrs, DSA hrs, Math hrs, Job hunt hrs, Meditation, Gym, Diet
- **Calculate → Sum** enabled on all four hour columns
- Below the view, a plain grey text line: `Budget: Node 7 · DSA 14 · Math 7 · Job 7`

No formulas, no rollups. Notion's built-in column sums do the entire job.

**Block 5 — Two columns**

*Left column — Job Hunt:*
- **Closing soon.** Linked view of **Job Hunt**. Filter: `Window closes` within the next 30 days AND `Status` is `Researching`. Sort: `Window closes` ascending. Properties: Company, Role, Window closes. This view is usually empty — when it is not, it outranks everything else on the page.
- **Active applications.** Linked view of **Job Hunt**. Filter: `Status` is not `Rejected` and is not `Offer`. Sort: `Follow-up date` ascending. Properties: Company, Role, Lane, Status, Next action, Follow-up date.
- **People to contact.** Linked view of **People**. Filter: `Next follow-up` is on or before today, OR `Status` is `To reach out`. Properties: Name, Company, Status, Next follow-up. Limit to 5 rows.

*Right column — Work:*
- Linked view of **Projects**. Type: Table. Filter: `Status` is `Active` or `Blocked`. Sort: `Deadline` ascending. Properties: Project, Type, Status, Deadline, Next action.

**Block 6 — Review queue**
Linked view of **Learning**.
- Filter: `Next review` is on or before today
- Sort: `Confidence` ascending
- Properties: Concept, Track, Type, Confidence
- Limit: 8 rows

**Hard constraint:** if the dashboard requires more than two screens of scrolling on mobile, something must be removed. Dashboard real estate is earned — any view that has not been useful for two consecutive weeks gets deleted.

---

## 8. BUTTONS

Four buttons, all on the dashboard.

| Button | Action |
|---|---|
| **▸ Log today** | Add a new page to Daily Log · set `Day` to today · set `Date` title to today's date · then Open page (side peek) |
| **+ Concept** | Add a new page to Learning · open in centre peek with the template picker |
| **+ Application** | Add a new page to Job Hunt · set `Status` to `Researching` · open page |
| **+ Idea** | Add a new page to Ideas · set `Status` to `Captured` · open page |

Label style: sentence case, one leading symbol maximum. No emoji clutter.

---

## 9. TEMPLATES

Two Learning templates. Nothing else needs one in Phase 1.

**Template: DSA Pattern**
```
Presets: Track = DSA, Type = Pattern, Stack = Job

Body:
  ## Problem shape
  (what does a problem look like when this applies)

  ## Approach
  (the pattern in own words)

  ## Complexity
  Time:      Space:

  ## Code
  ```python
  ```

  ## When to reach for it
  (the recall trigger — this is the part reviewed)
```

**Template: Math Concept**
```
Presets: Track = Math, Type = Concept, Stack = Brain

Body:
  ## Statement
  (formal, LaTeX via /math)

  ## Intuition
  (own words, no jargon)

  ## Worked example

  ## Where it shows up
```

---

## 10. WORKFLOWS

### Daily — under 3 minutes total

**Morning, 30 seconds.** Open Command. Tap *Log today*. Tick meditation and gym. Glance at the review queue count.

**Before DSA, 10 minutes.** Open the review queue. For each item: read the title, recall the answer *before* opening the page, then check. Set the next review date by hand:

| Recall quality | Next review |
|---|---|
| Instant | 3 weeks |
| Some effort | 1 week |
| Struggled | 3 days |
| Blank | Tomorrow, and drop confidence by 1 |

At confidence 5 twice running, clear `Next review` and let the item fall out of rotation.

**During the day.** Do not touch Notion. Add a Learning entry only when something is genuinely worth keeping.

**Evening, 2 minutes.** Fill in the four hour fields. Actual hours. Optionally one line in `Note`.

> If daily upkeep exceeds three minutes, the system is wrong and should be cut down.

### Weekly review — Sunday, 20 minutes

1. **Check the sums** against budget. Whichever track is furthest behind gets priority Monday.
2. **Job Hunt sweep.** Every non-rejected row gets an updated `Next action` and `Follow-up date`. This is the step that actually drives outcomes.
3. **Windows.** Check the *Closing soon* view. Anything inside 30 days gets applied to this week, ready or not. Once a quarter, scan for the next intake cycle and add rows with `Window closes` set.
4. **Portfolio.** Is the current Node project moving toward `Public? = true`, or drifting? One line answer.
5. **People.** Pick two to contact this week. Set their follow-up dates.
6. **Learning.** Set review dates on anything at confidence 1–2 that has no date.
7. **Ideas.** Skim. Promote at most one to `Exploring`.
8. **Projects.** Archive anything finished.

### Monthly — 15 minutes

Delete dashboard views that went unused. Check whether the review queue is being cleared or ignored — if it has been skipped for a full week, that is the signal to move drilling to Anki and let Notion hold concepts only. Reassess the weekly budget against reality.

---

## 11. VISUAL DESIGN BRIEF — YANTRA STRUCTURE
### (Written to be handed directly to Claude Design)

Design a single-page dashboard called **Command**. It is opened at 5:30 AM by someone who must know what to do in under two seconds, and again at night for a two-minute log.

**The organising idea:** a yantra is not a picture. It is an instrument arranged so that attention moves between an invariant centre and a contingent outer field. This dashboard is built on that principle structurally — not as decoration applied afterwards. Every symbolic element below earns its place because the traditional meaning describes what that part of the dashboard actually does. Nothing is ornamental. If a motif carries no information or structure, it is cut.

---

### 11.1 The structural principle

A yantra is read inward, from the outer gates to the bindu. A page is read downward. These are reconciled by inverting the traversal:

> **Scroll depth equals distance from the centre.**

The top of the page is the bindu — what is invariant, what is fully controlled, what is true every single day. Scrolling moves outward into progressively more contingent territory: the week, then the world, then off-page into pure potential.

This is also, exactly, the modern principle of **progressive disclosure** and of **inverted-pyramid information hierarchy**. The two traditions agree; the design simply obeys both at once.

| Zone | Symbol | Contains | Nature |
|---|---|---|---|
| 0 · Centre | **Bindu** | Today — four dots | Invariant |
| 1 · Gates | **Bhupura**, four gates | The four daily floors | Invariant |
| 2 · Inner field | **Kolam** | This week's log and sums | Recent, self-generated |
| 3 · Outer field | **Vairagya** | Job hunt, work, people | Contingent, not controlled |
| 4 · Beyond | **Beeja** | Ideas — off-page entirely | Dormant potential |

Ideas being unreachable from the dashboard is not an omission. Seeds are stored, not forced.

---

### 11.2 Grid — the brahmasthana

Use a **9-column grid**, after the vastu purusha mandala's nine-part division.

The **centre column is left empty**. In the mandala the brahmasthana — the central zone — is never built upon. Here it becomes the gutter: the two-column split in Zone 3 is 4 columns, one empty, 4 columns. The void at the centre is load-bearing, both symbolically and typographically.

Vertical rhythm: a consistent 8px base unit, with zone separations at 3× that spacing. Zones are separated by space, not by boxes.

---

### 11.3 Colour — temperature as meaning

The palette is Tantric earth pigment, and it is already restrained. The rule that makes it meaningful rather than merely pretty:

> **Warmth equals proximity to the self. Warm is what you control. Cool is what you do not.**

This encodes vairagya directly in the colour system. The learning block glows; the job hunt does not. On a month when nothing is converting, the page itself says the right thing without a word of copy.

| Role | Colour | Use |
|---|---|---|
| Ground | `#0E0E10` lamp black | Page. Never pure black |
| Surface | `#16161A` | Faint elevation only where needed |
| Accent — warm | `#D4A03C` turmeric | Bindu, gates, met floors. **Nowhere else** |
| Outer — cool | `#2B3A67` indigo | Job hunt and work status marks |
| Alert | `#A8452F` red ochre | Closing hiring windows only. Rare by design |
| Text | `#EDEAE4` | Primary, the colour of paper |
| Text muted | `#8A867E` | Labels, secondary |

Six colours total. Turmeric appears only in Zones 0 and 1. Once the eye learns that gold means *within your control*, the hierarchy needs no explanation.

---

### 11.4 The elements, zone by zone

**Zone 0 — Bindu.** Four dots in a row, centred, above everything. Filled turmeric when a floor is met, hollow when not. Roughly 10px, generously spaced. This is the entire status of the day rendered as four points, readable in well under a second. A complete day is four filled dots and nothing else. No numbers, no labels, no percentages.

**Zone 1 — The four gates.** The floors callout, set as four entries rather than a sentence. Each floor sits behind a small square gate-mark — a thin open square, cardinal, unfilled. Text is short and static: `Node 30m · DSA 1h · Math 30m · Job 1h`. Beneath, at reduced opacity, one line: *floors first, then follow interest.*

**Zone 2 — Kolam.** The week's table. Background carries a **very faint dot grid** — 4% opacity, the kolam's pulli — the only texture on the page. The four column sums are the **largest type on the page after the title**; they are the signal, and everything else in this zone is support. Numbers in turmeric, budget line beneath in muted text.

The kolam mapping is exact: drawn at the threshold before sunrise, one continuous line, erased and redrawn daily. That is the Daily Log's behaviour, not a metaphor for it.

**Zone 3 — Outer field.** Two columns, 4 / void / 4. Job hunt left, work right. Status pills in indigo, low saturation, small. **Closing soon** sits above active applications and is the only element permitted red ochre — muhurta, the moment that must be acted on. Usually empty; when it isn't, it outranks the page.

**Zone 4 — Review queue.** Bottom. Smriti — what is retained rather than merely heard. A short list, a due count, nothing more. Muted throughout; this zone is quiet by design.

**Dividers.** Thin double rules at 15% opacity, after manuscript ruling. Never full-width — inset to the grid.

---

### 11.5 Typography

One sans-serif family throughout. Devanagari **only** where it carries meaning — one word, as the page title, at most. Never as texture, never as a border, never behind content.

- Title: large, low weight, generous letter-spacing
- Zone labels: 11px, uppercase, letter-spaced, 50% opacity, sitting inside a gate-mark
- Sums: the largest numerals on the page
- Body: comfortable, high line-height

---

### 11.6 Modern principles this simultaneously obeys

Stated so the design can be defended on either tradition alone:

- **Data-ink ratio** — no ornament, no chrome, no decorative fill
- **Progressive disclosure** — zones reveal outward as needed
- **Single accent discipline** — one hue carries all emphasis
- **Semantic colour** — hue means something fixed, never mood
- **Thumb-zone priority** — the two daily actions sit at the top of the scroll
- **Whitespace as structure** — separation by space, not borders

---

### 11.7 Prohibited

Gold gradients. Paisley or floral borders. Ornamental frames. Marigold-orange fields. Devanagari as decoration. Mandala graphics pasted as background images. Drop shadows, glows, progress rings, glassmorphism. Any second accent colour. Anything that reads as a template marketplace product.

**The rule:** geometry yes, ornament no. If an element does not carry information or structure, remove it.

---

### 11.8 Mobile

Stacks to a single column at ~380px. The 4/void/4 split collapses to stacked full-width; the void becomes vertical spacing. Zones 0 and 1 must be fully visible without scrolling on a small phone — that is the entire 5:30 AM interaction. Everything below is optional.

---

## 12. DELIBERATELY NOT BUILT

Recorded so these do not creep back in.

| Not built | Why |
|---|---|
| Experiments database | Wait a month, then extract from Projects page bodies once the real structure is visible |
| Clients CRM | Only if international freelance actually picks up |
| Resume versions database | A select field handles fewer than four versions |
| Habit streak formulas | Weekly consistency is visible in the table. Streaks create guilt, not behaviour |
| Automatic spaced-repetition intervals | Formula-driven SR setups get abandoned. Manual dates or Anki |
| Gym/diet app integration | No native path exists. Hevy and Cronometer hold the detail |
| Calendar → database sync | Notion Calendar shows Google events. It does not surface database deadlines as events. Do not design around this |
| Goal/OKR database | Weekly budgets already do this job |
| Aptitude tracking | Parked until a company's process requires it |

---

## 13. BUILD ORDER

Roughly one hour. Do not decorate until the end.

1. Create page **Command**. Dark theme, full-width off.
2. Create **Daily Log** inline. Add today's row manually to sanity-check the fields.
3. Convert to a linked view — past week filter, column sums on.
4. Create **Learning** on its own page. Build the two templates.
5. Create **Job Hunt** and **People** on the Job Hunt page. Add the relation.
6. Create **Projects** on the Work page.
7. Create **Ideas** on the Ideas page.
8. Add the four dashboard buttons.
9. Add the floors callout.
10. Add the remaining linked views.
11. Apply visual styling last.

Then stop. Live in it for one month before adding anything.

---

## 14. FIRST WEEK

- Google Calendar: recurring events for meditation, gym, and the 9–6 block
- Notion Calendar installed, Google synced
- Velleman's *How to Prove It* — chapter 1
- DSA: pick one pattern-based problem list and start at problem 21
- Node: start one small project, carried across days. Build, don't read — and decide upfront that it ends public
- Contact two people for referrals — before feeling ready
- Add 5–10 Job Hunt rows at `Researching` with `Window closes` filled, so the *Closing soon* view has something to catch
- Tag at least two of them `GCC` or `Remote intl`
