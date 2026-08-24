# COMMAND — System Design

**Version:** 2.0 draft  
**Date:** 2026-08-24  
**Status:** For review before implementation

---

## 0. Document purpose

This document defines the product, architecture, data model, integrations, security boundaries, delivery plan, and acceptance criteria for **Command**, a personal operating dashboard.

It replaces the Notion-specific build plan in `command-os-spec.md`. The original product philosophy, workflows, visual language, and scope discipline remain valid. Notion is no longer a runtime dependency.

This is a design document, not an implementation. Decisions marked **Proposed** should be reviewed before scaffolding the application.

---

## 1. Executive summary

Command will be a mobile-first progressive web application hosted on GitHub Pages. It will use Supabase for authentication, structured data, authorization, and server-side integration functions. Google Workspace services will be connected only where they already provide a better native experience than Command should recreate.

```text
                         ┌─────────────────────────┐
                         │      GitHub Pages       │
                         │   Command React PWA     │
                         └────────────┬────────────┘
                                      │ HTTPS
                                      ▼
┌──────────────────┐      ┌─────────────────────────┐
│ iPhone / Safari  │─────▶│        Supabase         │
│ Home Screen PWA  │      │ Auth · Postgres · RLS   │
└──────────────────┘      │ Edge Functions · Cron   │
                          └────────────┬────────────┘
                                       │ OAuth/API
                                       ▼
                          ┌─────────────────────────┐
                          │    Google Workspace     │
                          │ Calendar · Drive · etc. │
                          └────────────┬────────────┘
                                       │ account sync
                                       ▼
                          ┌─────────────────────────┐
                          │ Apple Calendar / Siri   │
                          │ and optional Shortcuts  │
                          └─────────────────────────┘
```

The system will not require Xcode, WidgetKit, TestFlight, an Apple Developer membership, or periodic rebuilding.

### Core architectural rule

Every category of information has exactly one source of truth:

| Information | Source of truth |
|---|---|
| Daily logs, learning, applications, people, projects, ideas | Supabase |
| Application windows, follow-up dates, and project deadlines | Supabase |
| Planned time blocks, interview appointments, and reminder events | Google Calendar |
| Resumes, certificates, project files, long documents | Google Drive |
| Email | Gmail |
| Device presentation of scheduled events | Google Calendar or Apple Calendar client |
| UI preferences | Supabase, with non-sensitive local caching |

External services may display or reference Command data, but they must not silently become competing databases.

---

## 2. Product definition

Command is a personal instrument opened twice a day:

- **Morning:** understand today's minimum work in under two seconds.
- **Evening:** record actual hours and basic habits in under two minutes.
- **Weekly:** compare time against budgets and choose the next corrective action.
- **As needed:** manage applications, referrals, learning material, projects, and ideas.

It is not intended to be a general-purpose productivity platform, social product, team workspace, calendar replacement, email client, or document editor.

### Primary outcome

Support an 8–10 month path toward a strong SDE or applied AI/ML role by protecting daily practice, making application work visible, and keeping follow-ups from disappearing.

### Product principles

1. **Floors before ceilings.** Protect the minimum; do not constrain additional work.
2. **Actuals, not intentions.** Command records completed hours. Calendar records planned time.
3. **One daily surface.** The dashboard is the only page that must be opened every day.
4. **Progressive disclosure.** Invariant information appears first; contingent information appears deeper.
5. **Fast capture.** Daily maintenance must remain below three minutes.
6. **One source of truth.** Avoid bidirectional sync unless its value clearly exceeds its failure modes.
7. **Geometry, not ornament.** The yantra-derived design remains structural and semantic.

---

## 3. Goals and non-goals

### 3.1 Goals

- Responsive desktop and iPhone dashboard.
- Installable Home Screen web app on iPhone.
- Google sign-in and secure per-user data isolation.
- Fast daily logging and automatic weekly totals.
- Learning review queue.
- Job application and referral pipelines.
- Project and portfolio visibility.
- Idea capture kept outside the daily attention path.
- Google Calendar integration for selected time-bound items.
- Drive links for resumes and project material.
- Automatic web deployment from GitHub.
- Exportable data with no platform lock-in.

### 3.2 Non-goals for the first release

- Native iOS application or widgets.
- Full offline write synchronization.
- Gmail inbox scanning.
- Automatic resume parsing.
- AI-generated career decisions.
- Full two-way Google Tasks sync.
- Google Contacts synchronization.
- Apple Reminders or Notes synchronization.
- Calendar replacement.
- Experiments database.
- Clients CRM.
- Habit streaks, points, badges, or gamification.
- Automated spaced-repetition algorithms.
- Gym or diet application integrations.
- Collaboration, teams, or public user registration.

---

## 4. Decisions

### 4.1 Accepted decisions

| Area | Decision | Reason |
|---|---|---|
| Application shape | Responsive PWA | Works on iPhone and desktop without app distribution |
| Hosting | GitHub Pages | Static, inexpensive, Git-native deployment |
| Frontend | React + TypeScript + Vite | Small static build with a mature ecosystem |
| Database | Supabase Postgres | Relational fit for the existing data model |
| Authentication | Supabase Auth with Google | One identity across devices |
| Authorization | Row Level Security on every user table | Browser clients cannot be trusted with authorization |
| Backend logic | Supabase Edge Functions | Keeps OAuth tokens and privileged operations off the frontend |
| Schedule | Google Calendar | Better scheduling and notifications than a custom implementation |
| Files | Google Drive links first | Avoid rebuilding document and file management |
| Apple integration | Google account in Apple Calendar; optional Shortcuts | No native build required |
| Duration storage | Integer minutes | Avoid decimal-hour rounding errors |
| Week | Monday–Sunday in `Asia/Kolkata` | Matches a real weekly budget better than rolling seven days |
| Ideas | Separate page, not dashboard | Protects daily attention |

### 4.2 Proposed decisions requiring review

| Proposal | Recommended answer |
|---|---|
| Daily floors | Node 30m · DSA 60m · Math 30m · Job hunt 60m |
| Weekly budgets | Node 7h · DSA 14h · Math 7h · Job hunt 7h |
| Project types | Add `Portfolio` alongside `Internship` and `Freelance` |
| Initial Google integration | Calendar read/create; Drive links without Drive API |
| Google Tasks | Secondary reminders only, not source of truth |
| Repository visibility | Public code repository with no secrets; private data remains behind RLS |
| Routing on GitHub Pages | Hash-based routing initially to avoid deep-link 404s |
| Single-user access | Allow only the owner's Google identity in production |

---

## 5. User experience architecture

### 5.1 Information architecture

```text
Command
├── Dashboard
├── Daily Log
├── Learning
├── Job Hunt
│   ├── Applications
│   └── People
├── Projects
├── Ideas
└── Settings
    ├── Profile
    ├── Targets
    ├── Integrations
    └── Export
```

### 5.2 Routes

GitHub Pages project sites do not automatically route unknown paths to the SPA entry point. The initial implementation should use hash routes:

```text
/#/                         Dashboard
/#/log/today               Today's log
/#/learning                Learning library
/#/learning/new            New learning item
/#/jobs                    Applications
/#/jobs/new                New application
/#/people                  Referral network
/#/projects                Projects
/#/ideas                   Ideas
/#/settings                Settings
/#/settings/integrations   Google connections
```

A custom domain and history routing can be considered later.

### 5.3 Dashboard hierarchy

The existing five-zone model remains:

| Zone | Meaning | Content |
|---|---|---|
| 0 · Bindu | Today's status | Four completion dots |
| 1 · Gates | Invariant minimums | Four daily floors and quick log action |
| 2 · Kolam | Recent self-generated work | Current week and budget comparison |
| 3 · Outer field | Contingent work | Job hunt, people, projects |
| 4 · Smriti | Retention | Learning review queue |

Ideas remain off-dashboard.

### 5.4 Mobile dashboard

The first phone viewport should contain:

```text
●  ●  ○  ●

Node 30m       DSA 1h
Math 30m       Job 1h

[ Log today ]
```

Below the fold:

1. Weekly totals versus budgets.
2. Urgent application windows.
3. Today's follow-ups.
4. Active or blocked project work.
5. Learning items due for review.

### 5.5 Daily log interaction

`Log today` opens a page or bottom sheet with:

- Meditation checkbox.
- Gym checkbox.
- Diet selector.
- Node minutes.
- DSA minutes.
- Math minutes.
- Job-hunt minutes.
- Optional short note.

Requirements:

- Today is created automatically if it does not exist.
- Each field saves independently or through one obvious Save action.
- The UI displays `Saving`, `Saved`, or a recoverable error.
- Numeric inputs use sensible mobile keyboards and 15/30-minute quick increments.
- Closing and reopening must not create duplicate daily rows.

### 5.6 PWA behavior

- Web app manifest with Command name, dark theme, icons, and standalone display mode.
- Service worker caches the application shell and versioned static assets.
- Previously loaded dashboard data may be shown as stale when offline.
- Phase 1 does not silently accept offline writes.
- If offline, forms retain an unsaved draft locally and clearly require reconnection to save.
- A new deployment prompts the user to refresh instead of changing code during an active form.

### 5.7 Operating workflows

#### Morning — approximately 30 seconds

1. Open Command from the iPhone Home Screen.
2. Read the four floors and current bindu state.
3. Open or create today's log.
4. Record Meditation and Gym when completed.
5. Note the review-queue count.

#### Before DSA — approximately 10 minutes

1. Open the due review queue.
2. Read the title and recall before revealing the content.
3. Record recall quality.
4. Command calculates the next review date from the table in Section 8.5.
5. Two consecutive confidence-5 reviews retire the item from the active queue.

#### During the day

- Command is not used as a timer.
- Capture only learning material worth recalling later.
- Use Calendar for planned blocks and Command for completed time.
- New ideas go directly to Ideas and do not interrupt the dashboard.

#### Evening — under two minutes

1. Enter actual minutes for Node, DSA, Math, and job hunting.
2. Set Diet and any unfinished habit fields.
3. Add at most one short note.
4. Confirm the save state and close Command.

#### Sunday weekly review — approximately 20 minutes

1. Compare all four weekly totals with their budgets.
2. Give Monday priority to the practice furthest below budget.
3. Update every active application's next action and follow-up date.
4. Act on researching applications whose windows close within 30 days.
5. Select two people to contact during the coming week.
6. Check whether the active portfolio project is moving toward a public release.
7. Review low-confidence learning items without a next-review date.
8. Review Ideas and promote at most one.
9. Mark finished projects done.

#### Monthly review — approximately 15 minutes

- Remove dashboard views or fields that remained unused.
- Check whether the learning queue is consistently cleared; if not, reduce capture volume before adding automation.
- Reassess floors and budgets using actual logged time.
- Export a fresh copy of user data.
- Review integration permissions and disconnect anything unused.

---

## 6. Visual system

The visual system from `command-design-brief.md` is retained without Notion compromises.

### 6.1 Design tokens

```text
Ground       #0E0E10
Surface      #16161A
Warm accent  #D4A03C
Outer cool   #2B3A67
Alert        #A8452F
Text         #EDEAE4
Muted        #8A867E
```

### 6.2 Semantic rules

- Warm colour represents controllable daily practice.
- Cool colour represents contingent external work.
- Alert colour is reserved for genuinely closing opportunities.
- Colour is never the sole carrier of status.
- Spacing and hierarchy separate zones; cards and borders are used sparingly.
- Desktop uses a 4 / void / 4 outer-field composition.
- Mobile collapses to one column.

### 6.3 Accessibility

- Meet WCAG AA contrast for functional text.
- Minimum 44px touch targets on mobile.
- Visible keyboard focus.
- Semantic headings and form labels.
- Status dots include accessible text such as `DSA floor met`.
- Reduced-motion preference is respected.
- No interaction depends solely on hover.

---

## 7. Technical architecture

### 7.1 Frontend

Recommended dependencies:

| Concern | Choice |
|---|---|
| UI framework | React + TypeScript |
| Build | Vite |
| Routing | React Router with hash routing |
| Server state | TanStack Query |
| Forms | React Hook Form |
| Validation | Zod, mirrored by database constraints |
| Supabase | `@supabase/supabase-js` |
| Dates | `date-fns` or equivalent timezone-aware utilities |
| Styling | CSS variables plus CSS modules or a small utility layer |
| Unit tests | Vitest + Testing Library |
| End-to-end tests | Playwright |

Avoid adding a global client-state library until local component state, URL state, and TanStack Query are demonstrably insufficient.

### 7.2 Supabase responsibilities

- Google-based user authentication.
- Postgres database.
- Row Level Security.
- Generated Data API for normal CRUD.
- Edge Functions for Google OAuth and privileged integration calls.
- Cron only when scheduled synchronization becomes necessary.
- Vault or another server-only encrypted store for Google refresh tokens.
- Database migrations committed to Git.

### 7.3 GitHub responsibilities

- Source control.
- Pull-request checks.
- Static web build.
- GitHub Pages deployment.
- Optional deployment of Supabase migrations and Edge Functions after explicit approval.

GitHub Actions must never be used to process daily data changes. Actions run for code, schema, tests, and deployments only.

---

## 8. Data model

### 8.0 Relationship overview

```text
auth.users
    │ 1
    ▼ 1
profiles ─────────────── 1 user_settings
    │
    ├── * daily_logs
    ├── * learning_items
    ├── * people ───────< * job_applications
    ├── * job_applications
    ├── * projects
    ├── * ideas
    ├── * integration_accounts       (added with Google API integration)
    └── * integration_links          (added with external writes)
```

`people → job_applications` is the only user-domain relation required initially. All other relationships to Google objects are integration metadata rather than user-domain coupling.

### 8.1 Conventions

- Primary keys are UUIDs.
- Every user-owned table has `user_id`.
- User-owned rows reference `profiles.id` with cascade deletion so a confirmed account deletion removes the complete personal dataset.
- Every table has `created_at` and `updated_at` timestamps.
- Calendar-only values use `date`; exact events use `timestamptz`.
- Durations use integer minutes.
- Money uses `numeric` plus a three-letter currency code.
- URLs and external provider IDs are stored separately.
- Soft deletion is not added unless a recovery use case appears. Export and database backups provide recovery.

### 8.2 `profiles`

One row per authenticated account.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK; references `auth.users.id` |
| `email` | text | Display and owner allow-list checks |
| `display_name` | text | Optional |
| `timezone` | text | Default `Asia/Kolkata` |
| `week_starts_on` | smallint | Default Monday |
| `created_at` | timestamptz | Default now |
| `updated_at` | timestamptz | Maintained automatically |

### 8.3 `user_settings`

One row per user.

| Column | Type | Default |
|---|---|---|
| `user_id` | uuid | PK/FK profiles |
| `node_floor_minutes` | integer | 30 |
| `dsa_floor_minutes` | integer | 60 |
| `math_floor_minutes` | integer | 30 |
| `job_floor_minutes` | integer | 60 |
| `node_weekly_minutes` | integer | 420 |
| `dsa_weekly_minutes` | integer | 840 |
| `math_weekly_minutes` | integer | 420 |
| `job_weekly_minutes` | integer | 420 |
| `theme` | text | `dark` |

All duration settings must be non-negative.

### 8.4 `daily_logs`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | Owner |
| `day` | date | Unique with `user_id` |
| `meditation` | boolean | Default false |
| `gym` | boolean | Default false |
| `diet` | text | `on_track`, `loose`, `off`, or null |
| `node_minutes` | integer | Default 0; non-negative |
| `dsa_minutes` | integer | Default 0; non-negative |
| `math_minutes` | integer | Default 0; non-negative |
| `job_hunt_minutes` | integer | Default 0; non-negative |
| `note` | text | Optional; short |

Constraint: `unique(user_id, day)`.

The four status dots are derived, never stored:

```text
node_met = node_minutes >= node_floor_minutes
dsa_met  = dsa_minutes  >= dsa_floor_minutes
math_met = math_minutes >= math_floor_minutes
job_met  = job_hunt_minutes >= job_floor_minutes
```

### 8.5 `learning_items`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | Owner |
| `concept` | text | Required, concise title |
| `stack` | text | `job` or `brain` |
| `track` | text | `node`, `dsa`, `math` |
| `item_type` | text | `concept`, `pattern`, `snippet`, `formula` |
| `confidence` | smallint | 1–5 |
| `difficulty` | text | `easy`, `medium`, `hard` |
| `next_review_on` | date | Null means out of active rotation |
| `last_reviewed_on` | date | Optional |
| `mastery_hits` | smallint | Consecutive confidence-5 reviews |
| `source_url` | text | Optional |
| `content_markdown` | text | Explanation, examples, code, formula source |

Review behavior:

| Recall | Next review |
|---|---|
| Instant | 21 days |
| Some effort | 7 days |
| Struggled | 3 days |
| Blank | 1 day and reduce confidence |

After two consecutive confidence-5 reviews, `next_review_on` becomes null.

### 8.6 `people`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | Owner |
| `name` | text | Required |
| `company` | text | Optional |
| `email` | text | Optional |
| `linkedin_url` | text | Optional |
| `how_known` | text | `cold`, `alumni`, `linkedin`, `ex_colleague`, `referred_by` |
| `status` | text | `to_reach_out`, `talking`, `referred`, `cold` |
| `last_contact_on` | date | Optional |
| `next_follow_up_on` | date | Optional |
| `notes` | text | Optional |

### 8.7 `job_applications`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | Owner |
| `company` | text | Required |
| `role` | text | Required |
| `lane` | text | `sde`, `ai_ml` |
| `channel` | text | `india_product`, `gcc`, `remote_intl`, `services` |
| `status` | text | `researching`, `applied`, `oa`, `phone`, `onsite`, `offer`, `rejected` |
| `window_closes_on` | date | Optional |
| `applied_on` | date | Optional |
| `has_referral` | boolean | Default false |
| `referrer_id` | uuid | Nullable FK to People belonging to same user |
| `ctc_lpa` | numeric | Optional |
| `next_action` | text | Required for active rows |
| `follow_up_on` | date | Optional |
| `job_url` | text | Optional |
| `resume_version` | text | Optional |
| `resume_drive_url` | text | Optional |
| `notes` | text | Optional |

An active application without a next action is invalid at the product level. Rejected and offered rows may omit it.

### 8.8 `projects`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | Owner |
| `name` | text | Required |
| `project_type` | text | `internship`, `freelance`, `portfolio` |
| `status` | text | `active`, `blocked`, `review`, `done` |
| `client` | text | Optional |
| `deadline_on` | date | Optional |
| `payment_status` | text | `na`, `unpaid`, `invoiced`, `paid` |
| `amount` | numeric | Optional |
| `currency` | char(3) | Default `INR` |
| `is_public` | boolean | Recruiter-visible |
| `repo_url` | text | Optional |
| `demo_url` | text | Optional |
| `drive_folder_url` | text | Optional |
| `next_action` | text | Optional only when done |
| `content_markdown` | text | Decisions, experiments, notes |

Portfolio target: three completed, documented, public projects with a repository and/or live demo.

### 8.9 `ideas`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | Owner |
| `idea` | text | Required |
| `problem` | text | Who has it and why it matters |
| `target_market` | text | Optional |
| `monetization` | text | Optional |
| `status` | text | `captured`, `exploring`, `validating`, `dropped` |
| `next_action` | text | Optional |

Default status is `captured`. At most one idea may be deliberately promoted during a weekly review; this is a workflow rule, not a database constraint.

### 8.10 Integration support tables

These tables are added only when the first external write integration is implemented.

#### `integration_accounts`

Stored in a private schema inaccessible to browser roles.

| Column | Purpose |
|---|---|
| `user_id` | Owner |
| `provider` | `google` |
| `provider_account_id` | Stable Google identity |
| `email` | Connected account display |
| `scopes` | Granted scopes |
| `refresh_secret_id` | Reference to encrypted server-side token |
| `status` | `connected`, `expired`, `revoked`, `error` |
| `last_verified_at` | Connection health |

The frontend must never be able to select the token reference or decrypted token.

#### `integration_links`

Maps Command objects to external objects.

| Column | Purpose |
|---|---|
| `user_id` | Owner |
| `provider` | Google service |
| `entity_type` | `job_application`, `project`, `learning_item`, etc. |
| `entity_id` | Command row UUID |
| `external_type` | `calendar_event`, `task`, `contact`, `drive_file` |
| `external_id` | Provider identifier |
| `external_url` | Open-in-provider URL |
| `last_synced_at` | Last successful operation |
| `fingerprint` | Detect material changes and support idempotency |

Unique constraint on the provider/entity/external-type mapping prevents duplicates.

### 8.11 Derived dashboard queries

Views or parameterized queries should provide:

- Today's log.
- Monday–Sunday daily logs.
- Weekly totals by practice.
- Closing windows: researching applications closing within 30 days.
- Active applications sorted by follow-up date.
- People due for follow-up, limited to five.
- Active or blocked projects sorted by deadline.
- Learning items with review date on or before today, limited to eight.
- Count of public completed portfolio projects.

Do not store weekly totals, due counts, or status-dot values as columns unless measured performance later requires materialization.

---

## 9. Authentication and authorization

### 9.1 User authentication

- Supabase Auth uses Google as the identity provider.
- Production is single-user by default.
- During initial provisioning, create and verify the owner account, then disable new user signups.
- Add a Before User Created Auth Hook that allows only the configured owner email if signups must remain enabled during deployment or recovery.
- Email/password authentication is disabled unless needed for recovery.
- The OAuth callback returns to a permitted Command URL.
- The frontend stores only the normal Supabase browser session.

### 9.2 Row Level Security

RLS is enabled on every table exposed through the Data API.

Conceptual policy for each user-owned table:

```sql
using (user_id = auth.uid())
with check (user_id = auth.uid())
```

Policies are defined separately for select, insert, update, and delete so permissions remain auditable.

Cross-table references must belong to the same user. For example, an application's `referrer_id` cannot reference another user's People row even if an ID is known.

### 9.3 Browser keys

- The Supabase project URL and publishable key may appear in the browser build.
- The publishable key is not treated as authorization.
- RLS and the user's JWT enforce access.
- Supabase secret/service-role keys never appear in frontend code, repository files, build logs, or browser storage.

### 9.4 Google authorization

Google sign-in and Google Workspace authorization are separate:

- Sign-in requests only identity scopes.
- Calendar access is requested only when Calendar is connected.
- Drive access is not requested while Drive links are manual.
- Gmail, Contacts, and Tasks request their own minimum scopes only when enabled.
- Refresh tokens are exchanged and stored server-side through an Edge Function.
- OAuth state and PKCE are used for integration authorization.
- Google tokens never pass through GitHub Pages JavaScript after the authorization code is returned.

Google OAuth projects in Testing mode can issue seven-day refresh tokens for non-identity scopes. Before relying on persistent Calendar integration, the Google Cloud OAuth application must be moved to Production. A personal application can remain unverified within Google's personal-use limits, but may show an unverified-app warning.

### 9.5 Additional protections

- Validate all input at the form and database layers.
- Sanitize rendered Markdown and never render arbitrary HTML.
- Use an explicit Content Security Policy where GitHub Pages permits it; use a CSP meta tag as the static-host fallback.
- Avoid third-party analytics in the initial release.
- Do not log notes, tokens, email bodies, or application data to client telemetry.
- Rate-limit integration Edge Functions.
- Use idempotency keys for external writes.

---

## 10. Google productivity integration design

### 10.1 Integration policy

1. Integrations are opt-in.
2. Scopes are requested incrementally.
3. External changes never overwrite Command data silently.
4. Every automatic import first lands as a suggestion unless the operation is mechanically safe.
5. Failures do not block core Command logging.
6. A disconnected Google account leaves Supabase data intact.

### 10.2 Google Calendar — initial integration

Calendar is the only recommended API integration near the MVP.

#### Reads

- Show today's scheduled events in an optional dashboard strip.
- Read only the calendars selected in Settings.
- Cache the response briefly; Calendar availability must not block the dashboard.

#### Writes

Create an event only through an explicit action:

- `Add interview to Calendar`.
- `Add deadline to Calendar`.
- `Schedule weekly review`.

The created event stores:

- Command entity title.
- Relevant time/date.
- A link back to the Command record.
- A stable idempotency identifier.

Phase 1 does not automatically create an event for every follow-up date. Most follow-ups are better represented as tasks or dashboard due items.

#### Sync direction

```text
Command ──explicit create/update──▶ Google Calendar
Command ◀──today's read-only view── Google Calendar
```

If an externally created Calendar event changes, Command displays the current Calendar value but does not automatically mutate the underlying application or project deadline.

### 10.3 Google Drive — links first

Initial behavior:

- User pastes a Drive link into an application or project.
- Command opens it in Drive.
- No Drive OAuth permission is required.

Later behavior:

- Create a standard `Command` folder structure.
- Create project or application subfolders.
- Search and select Drive files.
- Generate review documents into Drive.

Drive never stores the relational metadata that belongs in Supabase.

### 10.4 Google Tasks — later, secondary reminders

Potential actions:

- Create a task from an application follow-up.
- Create a task from a person follow-up.
- Create a task from a learning review.
- Store the resulting Google Task ID in `integration_links`.

Supabase remains authoritative. Google Task completion may be reconciled when Command opens, but background bidirectional synchronization is outside the initial scope.

### 10.5 Gmail — later, suggestion-based import

Recommended safe workflow:

1. User applies a dedicated Gmail label such as `Command/Jobs`.
2. An integration reads labelled messages only at the application logic level.
3. It classifies likely application receipts, online assessments, interview invitations, offers, or rejections.
4. Command shows a proposed update.
5. The user confirms before the Job Hunt row changes.

Gmail is excluded from the MVP because its scopes and privacy implications are substantially greater than Calendar's.

### 10.6 Google Contacts — later, selected records only

- Command's People table stores pipeline state.
- Google Contacts stores contact-card information.
- Connecting a person is an explicit action.
- Command never imports an entire contact book by default.

### 10.7 Docs, Sheets, Forms, and Meet

| Service | Later use | Boundary |
|---|---|---|
| Docs | Generate weekly reviews, project reports, interview prep | Not a replacement for Learning rows |
| Sheets | Manual analytics and backup export | Not the production database |
| Forms | External intake or research responses | Not the daily logging UI |
| Meet | Create/join interview meetings; retrieve available artifacts | Not needed before real interview volume |

### 10.8 Google Keep

Do not integrate. The official Keep API is aimed at enterprise administrators managing Workspace Keep content, not a normal personal-note synchronization workflow.

---

## 11. Apple ecosystem bridge

No direct iCloud integration is required.

### Calendar

Add the same Google account to Apple Calendar. Google remains the event account; Apple Calendar becomes an Apple-native client for it.

### Home Screen

Install Command through Safari using `Add to Home Screen` and `Open as Web App`.

### Shortcuts and Siri — optional

Later, a Command page may launch an Apple Shortcut URL for actions such as:

- Open today's log.
- Capture a concept.
- Create an Apple Reminder from a confirmed Command item.
- Run a secured personal logging endpoint through Siri.

Shortcuts are one-way convenience commands, not a general sync engine. No Supabase service-role key may be placed in a Shortcut.

### Explicit exclusions

- No Apple Notes synchronization.
- No Apple Reminders two-way synchronization.
- No EventKit dependency.
- No iOS application target.
- No native widgets.

---

## 12. Edge Functions and server-side operations

Potential functions are introduced only as their features are implemented:

| Function | Responsibility |
|---|---|
| `google-oauth-start` | Produce authorization request with state and minimum scopes |
| `google-oauth-callback` | Exchange code, store encrypted refresh token, redirect to Settings |
| `google-calendar-today` | Return normalized selected Calendar events |
| `google-calendar-upsert` | Idempotently create/update one selected event |
| `google-disconnect` | Revoke access and remove stored token reference |
| `export-user-data` | Produce a user-owned JSON export |
| `google-task-create` | Later: create a secondary reminder task |
| `gmail-import-suggestions` | Later: create suggestions from deliberately labelled mail |

Normal CRUD must continue through the Supabase client under RLS. Edge Functions are not a redundant REST layer around every table.

Except for the Google OAuth callback itself, every function requires a valid Supabase user JWT. The callback instead validates its short-lived signed state, completes the server-side code exchange, and binds the result to the user encoded in that state.

---

## 13. Synchronization and failure handling

### 13.1 Idempotency

External creates use a stable key derived from:

```text
user + provider + entity type + entity ID + external type
```

Repeated button taps must update or return the existing external object instead of creating duplicates.

### 13.2 Conflict policy

- Supabase fields never change merely because a similar Calendar or Task item changed.
- Imported Gmail information requires confirmation.
- External deletion marks an integration link missing; it does not delete the Command row.
- A revoked Google token marks the connection disconnected and prompts reauthorization.

### 13.3 Error experience

- Core dashboard data loads independently of Google integrations.
- External-service failures appear as bounded messages, not blank pages.
- Failed explicit actions may be retried safely.
- The UI records the last successful sync time.
- Authentication expiration returns the user to sign-in without losing an unsaved local draft.

### 13.4 Scheduled jobs

No scheduled job is required for the MVP.

Later, Supabase Cron may invoke Edge Functions for:

- Calendar cache refresh.
- Gmail suggestion import.
- Google Task reconciliation.
- Weekly export.

Scheduled jobs must have bounded runtime, retry limits, and a visible last-run status.

---

## 14. Deployment and environments

### 14.1 Repository layout

Proposed structure:

```text
/
├── docs/
│   └── system-design.md
├── public/
│   ├── icons/
│   └── manifest assets
├── src/
│   ├── app/
│   ├── components/
│   ├── features/
│   │   ├── dashboard/
│   │   ├── daily-log/
│   │   ├── learning/
│   │   ├── jobs/
│   │   ├── people/
│   │   ├── projects/
│   │   ├── ideas/
│   │   └── integrations/
│   ├── lib/
│   ├── routes/
│   ├── styles/
│   └── test/
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   ├── functions/
│   └── seed.sql
├── .github/workflows/
├── index.html
├── package.json
└── vite.config.ts
```

The existing design and product documents may remain at the repository root as historical source material, or move into `docs/archive/` during implementation.

### 14.2 Environments

Initial environments:

| Environment | Purpose |
|---|---|
| Local | Development, seeded non-sensitive sample data |
| Production | Personal live system |

Add staging only when Google integration changes or schema risk makes it worthwhile.

### 14.3 Pull-request checks

Every pull request should run:

1. Dependency installation from lockfile.
2. Formatting check.
3. Lint.
4. Type check.
5. Unit and component tests.
6. Production build.
7. Database migration validation when migrations changed.
8. RLS tests when policies changed.

### 14.4 Web deployment

On merge to `main`:

1. Build the Vite application.
2. Upload the static artifact.
3. Deploy through GitHub Pages.
4. Report the published URL.

Only the Supabase URL and publishable key are included in the web build.

### 14.5 Database deployment

- Schema changes are SQL migrations in version control.
- Production migrations require an explicit deployment step.
- Destructive migrations require a backup and manual review.
- Seed data is never applied to production.
- Generated TypeScript database types are updated with schema changes.

---

## 15. Testing strategy

### 15.1 Unit tests

- Floor completion calculations.
- Monday–Sunday date boundaries in `Asia/Kolkata`.
- Weekly totals and budget comparison.
- Review interval calculations.
- Closing-window and follow-up filters.
- Status transitions.
- Integration idempotency-key generation.

### 15.2 Component tests

- Daily form validation and save states.
- Empty, loading, stale, error, and populated dashboard states.
- Mobile quick actions.
- Accessible status labels.
- Confirmation before destructive actions.

### 15.3 Database tests

- RLS prevents cross-user reads and writes.
- A user cannot spoof another `user_id`.
- Unique daily-log constraint.
- Duration and confidence constraints.
- Same-user relation enforcement.
- Active application next-action rule where enforced.

### 15.4 End-to-end tests

- Sign in and arrive at dashboard.
- Create and edit today's log.
- Confirm status dots and weekly totals update.
- Create a learning item and complete a review.
- Create a person and related application.
- Create a portfolio project.
- Capture an idea without showing it on the dashboard.
- Installable PWA metadata passes validation.

Google API tests should use mocked contracts in normal CI. A separate manual test verifies the real personal integration.

---

## 16. Observability, recovery, and data ownership

### Observability

- Client errors may be logged without personal record contents.
- Edge Function logs include request ID, user ID hash, function name, duration, provider status, and error category.
- Integration settings show connection state and last successful call.
- No third-party behavioral analytics in Phase 1.

### Recovery

- Provide a complete JSON export from Settings.
- Provide CSV exports for each user-facing table.
- Keep database migrations in Git.
- Use Supabase-managed backup capabilities appropriate to the selected plan.
- Before destructive schema changes, take a data export.

### Portability

The system must remain reconstructable from:

1. Repository code and migrations.
2. Exported user data.
3. User-owned Google files.

External IDs are metadata; losing them must not corrupt the underlying Command records.

---

## 17. Performance targets

- Static shell loads quickly on a normal mobile connection.
- Previously cached shell opens when offline.
- Top dashboard status becomes readable within two seconds under normal conditions.
- Local UI responds immediately to typing and taps.
- Normal Supabase writes show confirmation within one second when network conditions permit.
- Google Calendar latency never blocks core dashboard rendering.
- Dashboard queries return bounded result sets; full data belongs on dedicated pages.

No premature pagination or caching framework is required for a single-user dataset, but database indexes should cover:

- `(user_id, day)` on Daily Log.
- `(user_id, next_review_on)` on Learning.
- `(user_id, status, follow_up_on)` on Applications.
- `(user_id, window_closes_on)` on Applications.
- `(user_id, next_follow_up_on)` on People.
- `(user_id, status, deadline_on)` on Projects.

---

## 18. Implementation plan

### Phase 0 — foundation

- Confirm proposals in Section 4.2.
- Create repository/application structure.
- Configure TypeScript, Vite, tests, formatting, and GitHub Pages base path.
- Initialize Supabase locally.
- Establish design tokens and the mobile layout shell.

**Exit:** Empty PWA deploys and opens from an iPhone Home Screen.

### Phase 1 — secure data core

- Google sign-in through Supabase.
- Profiles and user settings.
- All six user-facing tables.
- Constraints, indexes, RLS, and generated TypeScript types.
- JSON/CSV export foundation.

**Exit:** Owner can authenticate; unauthorized users cannot access owner data.

### Phase 2 — daily instrument

- Bindu status.
- Floors.
- Today's log.
- Monday–Sunday weekly table and totals.
- Mobile quick-entry experience.
- Offline shell and draft handling.

**Exit:** Morning read is under two seconds and evening logging is under two minutes.

### Phase 3 — operating workflows

- Learning library and review queue.
- People and referral pipeline.
- Job applications and closing windows.
- Projects and portfolio target.
- Ideas page and capture action.
- Complete responsive dashboard.

**Exit:** All workflows from the original Phase 1 specification operate without Notion.

### Phase 4 — Google Calendar and Drive links

- Google integration Settings UI.
- Secure Calendar OAuth flow.
- Today's optional Calendar strip.
- Explicit create/update event actions.
- Integration links and idempotency.
- Manual Drive URLs on applications and projects.
- Google account added to Apple Calendar manually.

**Exit:** Selected Command deadlines/interviews can appear in Google and Apple Calendar without native code.

### Phase 5 — hardening

- Accessibility audit.
- PWA update behavior.
- Error and empty states.
- Data export verification.
- RLS and end-to-end test coverage.
- Performance check on iPhone.

**Exit:** System is safe and dependable for daily use.

### Later candidates — require separate approval

- Google Tasks creation.
- Gmail label importer and confirmation inbox.
- Selected Google Contact linking.
- Drive API folder/file picker.
- Generated Google Docs reviews.
- Siri/Apple Shortcuts convenience actions.
- Scheduled integration jobs.
- Offline write queue.
- Experiments database after observing real project notes for one month.

---

## 19. Release acceptance criteria

### Product

- Four dots accurately represent today's four floors.
- Today can be created only once per user.
- Weekly totals use Monday–Sunday and the configured timezone.
- Logging requires less than two minutes on iPhone.
- Dashboard remains useful with all Google integrations disconnected.
- Ideas never appear on the daily dashboard.
- Active applications and projects surface their next action.

### Security

- RLS is enabled and tested for every exposed table.
- No secret/service-role or Google refresh token exists in frontend output.
- Google scopes are minimal and incremental.
- Markdown output is sanitized.
- Exports require an authenticated session.

### Operations

- A merge to `main` produces a repeatable Pages deployment.
- Database schema can be recreated from migrations.
- User data can be exported without Google services.
- Integration failures are visible and retryable.
- PWA can be added to the iPhone Home Screen and has a stable icon/name.

---

## 20. Risks and tradeoffs

| Risk | Consequence | Mitigation |
|---|---|---|
| GitHub Pages is static | No secure token exchange in the web host | Use Supabase Edge Functions |
| GitHub Pages SPA routing | Deep-link 404s | Start with hash routing |
| Browser contains publishable key | Key is visible | Treat RLS, not the key, as authorization |
| Google OAuth remains in Testing | Non-identity refresh tokens expire after seven days | Move personal OAuth app to Production before daily use |
| Too many Google scopes | Security and consent friction | Incremental scopes; Calendar first |
| Bidirectional sync | Duplicates and conflicts | One source of truth and explicit sync directions |
| PWA offline limits | Writes may fail without network | Cached read shell and explicit draft state in Phase 1 |
| Personal system expands endlessly | Maintenance replaces productive work | Phase gates and separate approval for later candidates |
| Public source repository | Architecture and publishable configuration are visible | Never commit secrets; keep all personal data behind RLS |
| Free-tier service changes | Quotas or pauses could affect availability | Exportability, backups, and low provider coupling |

---

## 21. Review checklist

Before implementation, confirm or amend:

- [ ] The four floors and weekly budgets in Section 4.2.
- [ ] Monday–Sunday as the definition of a week.
- [ ] `Portfolio` as a Project type.
- [ ] Google Calendar as the only initial API integration.
- [ ] Drive URLs without Drive API in the initial release.
- [ ] Google Tasks as a secondary reminder system rather than source of truth.
- [ ] Hash routing for the initial GitHub Pages deployment.
- [ ] Whether the code repository will be public or private.
- [ ] The single Google email allowed to use the production system.
- [ ] No native iOS application or widget.
- [ ] No Gmail, Contacts, or Apple Reminders sync in the MVP.

---

## 22. Official technical references

- [GitHub Pages is static hosting](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [GitHub Pages custom Actions workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Supabase frontend security and RLS](https://supabase.com/docs/guides/database/secure-data)
- [Supabase Google authentication](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase Auth general configuration](https://supabase.com/docs/guides/auth/general-configuration)
- [Supabase Before User Created Hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase Vault](https://supabase.com/docs/guides/database/vault)
- [Supabase local migrations workflow](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Supabase scheduled Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
- [Google Calendar API](https://developers.google.com/workspace/calendar/api/guides/overview)
- [Google Tasks API](https://developers.google.com/workspace/tasks/overview)
- [Google Drive API](https://developers.google.com/workspace/drive/api/guides/about-files)
- [Gmail API](https://developers.google.com/workspace/gmail/api/guides)
- [Google People API](https://developers.google.com/people)
- [Google OAuth publishing status](https://support.google.com/cloud/answer/15549945)
- [Google OAuth token security](https://developers.google.com/identity/protocols/oauth2/resources/best-practices)
- [Apple Home Screen web apps](https://support.apple.com/en-ae/guide/iphone/iphea86e5236/ios)
- [Apple Calendar external accounts](https://support.apple.com/en-by/guide/iphone/iphc37be2016/ios)
- [Apple Shortcuts URL scheme](https://support.apple.com/en-euro/guide/shortcuts/apd624386f42/ios)

---

## 23. Final design statement

Command should remain valuable when every external integration is unavailable. Supabase preserves the user's structured operating data; Google improves scheduling, files, and later communication workflows; Apple devices present the web app and Google calendar through their native surfaces.

The first implementation succeeds when the dashboard becomes easier to use than the original Notion plan—not when every possible ecosystem connection exists.
