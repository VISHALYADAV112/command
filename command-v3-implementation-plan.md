# COMMAND v3 — Living Implementation Plan

**Status:** Approved
**Plan version:** 3.0
**Created:** 2026-08-30
**Last updated:** 2026-09-03
**Target:** Replace the fixed v2 dashboard with registry-driven, commitment-centred Command using the Gazette visual language, without losing existing data or weakening security.

---

## 0. How to use this document

This is the working source of truth for the v3 migration. Keep it current until every completion gate in Section 15 is checked.

At the beginning of a work session:

1. Read the current status in Section 1.
2. Pick the first unchecked task whose dependencies are complete.
3. Mark only one phase as **In progress**.
4. Record important decisions in Section 3 before implementing them.

At the end of a work session:

1. Check only work that is implemented and verified.
2. Record test results and blockers in the active phase.
3. Update `Last updated` and the change log.
4. Do not mark a phase complete until its exit gate passes.

Status vocabulary:

- **Not started** — no implementation work has begun.
- **In progress** — active work; only one phase should normally have this status.
- **Blocked** — cannot progress without a recorded decision or external change.
- **Paused** — partially implemented work held while an earlier phase gate is repaired.
- **Complete** — implementation, migration, tests, and documentation for the phase all pass.
- **Deferred** — deliberately excluded from the v3 completion gate.

The companion design inputs remain useful references, but this plan resolves conflicts between them:

- `/Users/vishalyadav/Desktop/Design/command-system-design-v3.md`
- `/Users/vishalyadav/Desktop/Design/command-ia.md`
- `/Users/vishalyadav/Desktop/Design/command-gazette-app-v12.html`
- `/Users/vishalyadav/Desktop/Design/command_interface_newspaper.html`
- `command-os-spec.md`
- `command-system-design.md`
- `command-design-brief.md`

When these documents conflict after this plan is approved, this plan wins until the source specifications are updated.

---

## 1. Current status

| Phase | Status | Exit gate |
|---|---|---|
| 0. Ratify product and architecture decisions | **Complete** | All blocking decisions in Section 3 resolved |
| 1. Stabilise the current system | **Complete** | Current app safer and fresh across UI/MCP writers |
| 2. Add the v3 data foundation | **Complete** | New tables, validation, RLS, and generated types pass |
| 3. Backfill and prove data compatibility | **Complete** | Every existing row accounted for and export verified |
| 4. Build the responsive Gazette shell | **Complete** | Shared shell works at 380px and desktop widths |
| 5. Build the core v3 product workflows | **Complete** | Today, Due, Browse, Item, and overlays pass the corrected implementation gate |
| 6. Rebuild MCP and agent review | **Complete** | Dynamic tools, permissions, approval, and provenance pass |
| 7. Add review, readiness, export, and integrations | **Complete** | Week, Run, settings, export, and Calendar rules work |
| 8. Cut over, harden, and retire legacy paths | **Not started** | Production smoke tests and final completion gate pass |

**Active phase:** None. Phase 7 is complete and Phase 8 has not started.
**Current blocker:** None for Phase 7. Phase 8 intentionally requires explicit production-cutover authorization and a maintenance window before it begins.
**Repository state:** GitHub `main` remains at `e1b6676`, while the public Vercel alias remains pinned to the compatible Phase 4 deployment from `e2d5d15` described in `docs/deployment.md`. The corrected Phase 5, completed Phase 6, and completed Phase 7 implementation remain isolated on the local `command-v3` branch; Phase 6 is recorded by local commit `1cf9ff7` and Phase 7 by local commit `0dc0cd2`. All v3 migrations `0013`–`0037` were applied only to the local Supabase environment. No production database migration, Supabase function deployment, production frontend change, or production-data change was performed.
**Next slice:** After explicit cutover authorization, follow `docs/phase8-cutover.md`: produce and verify the encrypted/private production export before applying any migration, then announce and use the short single-user maintenance window for the final transactional, idempotent backfill and cutover.

---

## 2. Product outcome in simple words

### What the dashboard is today

The current dashboard is six small applications living beside each other. Jobs, people, projects, learning, ideas, and daily logs each have their own model, database path, screen, forms, and rules. They meet on Today, but the system does not understand that a project deadline, a person follow-up, and a learning review are all versions of the same thing: something owed on a date.

### What the dashboard will become

Command v3 will feel like one operating desk instead of six separate databases.

- **Today** tells you the most important exception, your three practice floors, weekly application and outreach progress, and what is due.
- **Due** is one queue for every follow-up, deadline, review, drill, and next action.
- **Browse** shows any registered kind of record using the same list screen.
- **Item** opens every record in the same detail layout, including its fields, commitments, and history.
- **Capture** is always available. You choose a type and the form builds itself from that type's registered fields.
- **Agent inbox** holds AI-created proposals until you approve them.
- **Week** explains what happened this week.
- **Run** asks whether the work is creating real progress over months.

Adding a simple tracked type later should be configuration, not a frontend and database rewrite. Types that need special behaviour, such as spaced-repetition scheduling, will attach to a small code-backed behaviour module.

### What will feel different day to day

Morning use becomes exception-first:

1. If something is overdue, it becomes the lead story.
2. You see the three daily floors and the weekly application and outreach targets.
3. You see the short unified queue.
4. You can log, capture, or record an outcome without losing the current screen.

Evening use remains fast: open the Log sheet, enter three practice durations and habits, add an optional note, and save.

Managing work becomes simpler: instead of remembering which screen contains a due date, you open Due. Instead of trusting that an agent wrote the right thing, you inspect its proposal before it enters the system.

---

## 3. Decision register

### 3.1 Approved architecture and product decisions

| ID | Proposed decision | Reason | Status |
|---|---|---|---|
| D-01 | Adopt the Gazette visual direction, rebuilt mobile-first in React/CSS | The desktop hierarchy is strong; the prototype code is not production or responsive | **Approved 2026-08-31** |
| D-02 | Keep canonical state in `entities` and `commitments`; use `activity_events` as an immutable audit log | Delivers provenance and safe retries without requiring full event replay and projections | **Approved 2026-08-31** |
| D-03 | Put untrusted MCP writes in `agent_proposals`; approval applies them transactionally | A pending event cannot also be immutable without a second approval model | **Approved 2026-08-31** |
| D-04 | Add an explicit generic `entities` table | Registry-driven Browse, Item, and Capture cannot work from `entity_types` alone | **Approved 2026-08-31** |
| D-05 | Treat plugins as internal behaviour strategies; do not let them add public MCP tools | Preserves the fixed five-tool surface | **Approved 2026-08-31** |
| D-06 | Defer the standalone Calendar route until after core v3 usage; retain Calendar integration | The IA specifies seven screens while v12 adds an eighth; Due already owns dated work | **Approved 2026-08-31** |
| D-07 | Remove Ideas as a dedicated screen, but preserve all idea data as note records tagged `idea` | No data loss and no ongoing dedicated-module cost | **Approved 2026-08-31** |
| D-08 | Use visibility-change refresh first; add realtime only if it proves necessary | Simplest reliable solution for a single user and a few writers | **Approved 2026-08-31** |
| D-09 | Archive records by default; do not expose hard delete in normal workflows | Fits auditability and makes agent/user mistakes recoverable | **Approved 2026-08-31** |
| D-10 | Ship v3 in vertical slices instead of completing six invisible architecture steps first | Produces testable product value and reduces migration risk | **Approved 2026-08-31** |

### 3.2 Resolved Phase 0 decisions

- [x] **Job-hunt unit:** Weekly targets are 15 submitted applications and 2 new people contacted. Preserve historical `job_minutes` as minutes; never reinterpret it as a count, and do not collect job hunt as a new daily floor in v3.
- [x] **Today priority:** Today is exception-first only when an overdue commitment exists. Otherwise the three practice floors lead.
- [x] **First viewport:** At 380px, the urgent exception or floor summary, weekly application progress, and primary action are visible without scrolling.
- [x] **Calendar surface:** The standalone Calendar route is deferred. Google Calendar integration remains.
- [x] **Calendar sync rule:** Export is manual and initially limited to interviews, hard deadlines, and important milestones.
- [x] **Agent trust:** Every MCP write requires approval initially. Later trust may be granted only by the combination of client, operation, and entity type. Calendar writes always require explicit approval.
- [x] **Type creation power:** Settings may create data-only types and select only allow-listed built-in behaviour plugins.
- [x] **Schema editing:** Field keys are permanent. Labels may change. Removed fields are deprecated without deleting stored data. A type change creates a new field and requires an explicit migration.
- [x] **Commitment lifecycle:** Canonical states are `open`, `completed`, and `cancelled`; overdue and missed are derived.
- [x] **Run markers:** Phase 7 will define final filters and targets before implementation, using only canonical entities, commitments, and immutable activity events. Trends compare the three most recent completed calendar months and are suppressed until all three have data. This deliberate deferral cannot add a route or require marker-specific Phase 2 tables/columns.
- [x] **Archive retention:** Normal workflows expose archive and restore only. Hard delete is not exposed.
- [x] **Ideas:** Preserve ideas as note records tagged `idea`; there is no dedicated Ideas screen in v3.
- [x] **Brand vocabulary:** The product remains `Command`; `Gazette` is the visual language, not the product name.
- [x] **Refresh model:** Refresh on visibility change first. Do not introduce realtime subscriptions yet.
- [x] **State architecture:** Use canonical entities and commitments plus immutable activity events; do not implement full event sourcing.
- [x] **Agent proposals:** Store unapproved agent changes in `agent_proposals` and apply approved changes transactionally.
- [x] **MCP permissions:** Use `command:types:read`, `command:data:read`, and `command:proposals:write` as separate Command application grants keyed by owner and OAuth client. Access to person records additionally requires `command:data:people`; broad reads omit people without it. Supabase's supported identity scopes such as `openid` and `email` grant no Command tool access. The proposal-write grant creates reviewable proposals only and does not grant direct canonical or Calendar writes.

### 3.3 Superseded design material

This approved plan supersedes conflicting sections of the older specifications and prototypes concerning the product name and visual direction, event sourcing, missing generic entities, dedicated Ideas and Calendar routes, the daily job-hunt floor, MCP tool proliferation and write trust, hard deletion, realtime subscriptions, commitment states, field-key mutation, and unrestricted behaviour plugins. Older documents remain historical design inputs for details this plan does not settle.

### 3.4 Architecture alternative deliberately not chosen

The original v3 proposal makes the event log the source of truth and entity rows replayable projections. That remains a possible future architecture, but it is not the proposed first implementation here.

Promote events to canonical truth only if real requirements appear for replay, temporal queries, multi-device conflict resolution, or reconstruction of new projections. Until then, canonical rows plus immutable transactional audit events are easier to query, migrate, validate, secure, and operate.

---

## 4. Scope

### 4.1 Required for v3 completion

- Registry-defined data-only entity types.
- A generic entity store and universal Item view.
- Unified commitments and Due queue.
- Responsive Gazette UI for mobile and desktop.
- Global Capture, Log, Outcome, Edit/Schedule, and Agent review workflows.
- Provenance for UI, MCP, and Calendar-originated changes.
- Agent proposal approval and rejection.
- Five generic MCP tools with server-side validation and bounded output.
- Three daily practice floors, 15 submitted applications per week, and 2 new people contacted per week.
- Week review and defined readiness register.
- Dynamic JSON and per-type CSV export.
- Cached reads, refused offline writes, and draft retention.
- Visibility refresh so MCP changes appear without manual reload.
- Production-safe data migration with no lost existing records.
- RLS, rate limits, idempotency, auditability, accessibility, and test coverage.

### 4.2 Explicit non-goals

- Multi-user collaboration.
- CRDT or offline write queue.
- Runtime installation of arbitrary third-party code.
- General-purpose Notion-style formulas, rollups, relations, or page building.
- Gmail, Drive, Contacts, or arbitrary web import.
- Native iOS application or widgets.
- Automatic destructive cleanup of legacy data.
- A full event-sourced projection engine unless D-02 is rejected.
- New productivity modules unrelated to the current job/study outcome.

---

## 5. Target information architecture

### 5.1 Core routes

| Route | Screen | Purpose |
|---|---|---|
| `/#/` | Today | Immediate status, exception, floors, weekly target, short queue, agent indicator |
| `/#/due` | Due | Unified open commitment queue with window and type filters |
| `/#/t/:type` | Browse | Registry-driven list, search, filters, sort, and capture |
| `/#/i/:id` | Item | Universal detail, commitments, history, edit, schedule, archive |
| `/#/week` | Week | Monday–Sunday execution and movement review |
| `/#/run` | Run | Monthly readiness and outcome markers |
| `/#/settings` | Settings | Targets, types, integrations, export, theme, audit access |

`/#/calendar` is deferred unless D-06 changes. Calendar integration remains available from commitments and Settings.

### 5.2 Global overlays and sheets

| Workflow | Responsibility |
|---|---|
| Log | Three practice durations, habits, optional note; target under two minutes |
| Capture | Type picker plus registry-generated fields and optional first commitment |
| Outcome | Record what happened, close the commitment, and optionally create/schedule the next one |
| Agent inbox | Review, edit-and-approve, approve, or reject a pending proposal |
| Edit | Reuse the registry form to edit an entity without a type-specific screen |
| Schedule | Add or modify a commitment from Item |

Every overlay must restore focus, scroll position, filters, and route context when it closes. Unsaved input must survive accidental dismissal and save failure.

### 5.3 Viewport rules

**Mobile, starting at 380px**

- Compact wordmark; do not render the full desktop masthead on every visit.
- Bottom navigation: Today, Due, Capture, Browse, More.
- Single-column content and forms.
- No fixed desktop grids, clipped content, horizontal scaling, or horizontal scrolling.
- Minimum 44px touch targets.
- Without scrolling, Today must show the overdue exception or, when nothing is overdue, the three-floor summary; weekly application progress; and the primary action.

**Desktop**

- Full Gazette masthead may appear on Today; use a compact header on secondary screens if repeated height harms task speed.
- Wider registry tables may show additional schema-marked columns.
- Sheets become centred dialogs.
- Due and Today may share visual context, but routes remain linkable and independent.

### 5.4 Visual rules carried forward

- Paper/ink base with a usable night edition.
- Display serif for headlines; mono for metadata; readable serif or sans for body content.
- Vermilion means urgent exception or destructive-risk attention.
- Green means completed/safe success; purple is reserved for agent-originated work.
- Colour is never the only signal.
- Newspaper rules and spacing must clarify hierarchy, not decorate empty space.
- Brahmi/Sanskrit elements must have defined meaning and remain secondary to task content.
- Critical controls use plain language even when surrounding copy uses the Gazette metaphor.

---

## 6. Target data architecture

Names below are planning names. The migration phase may refine columns, but it must preserve these responsibilities.

### 6.1 Tables that remain

- `profiles`
- `user_settings` — revised to three daily floors plus weekly targets of 15 submitted applications and 2 new people contacted
- `daily_logs` — historical `job_minutes` remains preserved as minutes even though the new form stops collecting it
- `integration_accounts`
- `integration_links`
- `oauth_states`
- `edge_rate_limits`
- `mcp_audit_log`

### 6.2 New `entity_types`

Defines data-only types per user.

Required responsibilities:

- Stable id and user ownership.
- Unique type key per user.
- Singular/plural display names.
- Icon/glyph identifier from an allow-listed set.
- Versioned field schema.
- List-visible and filterable field metadata.
- Default sort and optional grouping.
- Allowed commitment kinds.
- Optional built-in behaviour plugin key.
- Active/disabled state.

Initial supported field kinds should remain deliberately small:

- text
- textarea
- number
- boolean
- date
- URL
- single select

Do not build formulas, relations, arbitrary HTML, user JavaScript, or deeply nested schemas.

### 6.3 New `entities`

Canonical record store for applications, people, projects, learning records, notes, and future data-only types.

Required responsibilities:

- UUID id and user ownership.
- Foreign key to `entity_types` with same-user integrity.
- Human-readable title.
- JSONB fields validated against the type's active schema version.
- Schema version used when the row was last validated.
- Archive timestamp and created/updated timestamps.
- Common indexed columns only where they apply to every entity.

The title, ownership, type, archival state, and timestamps are real columns. Type-specific fields remain JSONB. At this single-user scale, bounded JSONB filtering is preferable to adding a migration for each field.

### 6.4 New `commitments`

Canonical store for anything owed on a date.

Required responsibilities:

- UUID id and user ownership.
- Same-user foreign key to an entity.
- Commitment kind from the owning type's allowed kinds.
- Clear action/title.
- Due date.
- State: open, completed, cancelled.
- Outcome and completion timestamp.
- Origin source.
- Created/updated timestamps.

Initial kinds:

- follow-up
- deadline
- review
- contact
- drill
- milestone

Kinds are constrained vocabulary, not free text. The registry declares which kinds a type may create.

### 6.5 New `activity_events`

Immutable provenance and audit history. It does not drive projections in the first v3 release.

Required responsibilities:

- UUID id and user ownership.
- Optional entity and commitment references.
- Event type and bounded JSONB payload.
- Source: UI, MCP, Calendar, or migration.
- Optional client id.
- Optional idempotency key with a uniqueness rule appropriate to source/client/user.
- Occurrence timestamp.

Normal authenticated users may read their events but may not update them. Event creation occurs in the same transaction as the canonical mutation. Corrections append a new event.

### 6.6 New `agent_proposals`

Review gate for untrusted MCP-originated changes.

Required responsibilities:

- UUID id and user ownership.
- MCP client identity.
- Proposed operation and target type/entity.
- Schema-validated proposed entity and commitment payloads.
- State: pending, approved, rejected, expired.
- Created and decided timestamps.
- Optional decision note and resulting entity/event ids.
- Idempotency key so retrying does not create duplicate proposals.

Approval must be a transaction: revalidate the current schema, apply canonical changes, append activity events, mark the proposal decided, and return the result.

### 6.7 Behaviour plugins

Plugins are code-backed strategies selected by an allow-listed `plugin_key`; they are not user-uploaded code.

Initial contract:

```text
Behaviour plugin
  validate(entity, commitment, outcome)
  schedule(entity, commitment, outcome, today) -> next commitment or none
  derive(entity, related commitments/events) -> display fields
```

The existing spaced-repetition `applyRecall` behaviour is the first validation case. A data-only type works without a plugin. Plugins do not add routes, overlays, or public MCP tools.

### 6.8 Derived data

Compute weekly totals, floor status, overdue counts, funnel conversion, and readiness summaries on read through pure shared functions, bounded queries, or Postgres views.

“Do not store derived values” means do not persist business metrics that can drift. It does not prohibit indexes, canonical current state, or deliberately cached database views.

---

## 7. Existing-data migration map

No migration may delete an existing source row. Backfills must be idempotent and testable more than once.

| Existing source | v3 destination | Commitment backfill |
|---|---|---|
| `job_applications` | `application` entities | `follow_up_on` → follow-up; `window_closes_on` → deadline; preserve next action |
| `people` | `person` entities | `next_follow_up_on` → contact |
| `projects` | `project` entities | `deadline_on` → deadline; preserve next action |
| `learning_items` | `learning` entities | `next_review_on` → review; preserve recall state and history fields |
| `ideas` | `note` entities tagged `idea` | No automatic commitment unless an existing next action and explicit policy require one |
| `daily_logs` | Remain in place | No entity conversion |
| Existing Calendar links | Relink to the resulting commitment where possible | Preserve provider event ids and avoid duplicate creation |

Migration events use `source = migration` so provenance is honest without claiming the historical UI/MCP source when it is unknown.

Data verification must compare:

- Row counts by source and destination type.
- Every source id to its v3 id mapping.
- Required and optional field values.
- Null dates versus created commitments.
- Learning recall state.
- Application referrer information.
- Calendar link ownership.
- Export before and after migration.

Legacy tables stay untouched through at least one stable v3 release. Cleanup requires a separate later migration and explicit approval.

---

## 8. Complete v3 feature inventory

This section is the user-visible and operational feature checklist. A checked feature must work against its current verified phase environment, not only in a static prototype. Features that depend on the unapplied v3 production schema remain subject to the explicit Phase 8 live-mode and smoke-test gate.

### 8.1 Today

- [x] Dynamic date and India timezone dateline.
- [x] Optional urgent/overdue lead story.
- [x] Node, DSA, and Math floor status with values and targets.
- [x] Weekly submitted-application progress against 15 and new-people-contacted progress against 2.
- [x] Short unified open commitment queue.
- [x] Record Outcome from a queue row.
- [x] Open the owning Item.
- [x] Global daily Log action.
- [x] Agent inbox indicator only when proposals are pending.
- [x] Calm nothing-due state.
- [ ] Seven-day execution strip only if it does not harm the first-viewport goal.

### 8.2 Due

- [x] One queue across all entity types.
- [x] Overdue, Today, This week, and All windows.
- [x] Type filter populated from the registry.
- [x] Stable due-date ordering with overdue first.
- [x] Record Outcome without navigation.
- [x] Link to universal Item.
- [x] Distinct unfiltered-empty and filtered-empty states.
- [x] Bounded reads and pagination or virtualisation.

### 8.3 Browse

- [x] One route for every registered type.
- [x] Unknown-type state with link to Settings.
- [x] Registry-driven columns.
- [x] Registry-driven filters and default sort.
- [x] Text search with bounded results.
- [x] Item and open-commitment counts.
- [x] Capture preselected to the current type.
- [x] Empty-type state.
- [x] Last-used or explicit type selection on mobile Browse.

### 8.4 Item

- [x] Universal detail page for every type.
- [x] Type, title, reference, and creation metadata.
- [x] Every registered field rendered, including unset fields.
- [x] Edit entity.
- [x] Add or reschedule a commitment.
- [x] Open and closed commitment history.
- [x] Record outcomes.
- [x] Provenance timeline with source and client where applicable.
- [x] Archive and restore.
- [x] Read-only archived state.
- [x] Indistinguishable not-found/not-owned state.

### 8.5 Week

- [x] Monday–Sunday boundaries in `Asia/Kolkata`.
- [x] Three practice totals against weekly budgets.
- [x] Weekly submitted applications and new people contacted against their targets.
- [x] Seven-day table with future days shown as pending, not zero.
- [x] Application movement this week through immutable submitted-application outcomes; do not infer unrecorded status transitions.
- [x] Agent proposal activity: proposed, approved, rejected.
- [x] Commitments completed, cancelled, and missed.
- [x] Empty-week structure.

### 8.6 Run

- [x] Public portfolio projects against target three.
- [x] DSA patterns covered/mastered.
- [x] Mock interviews completed.
- [x] Precisely defined application conversion marker, with final Phase 7 filters using canonical activity history.
- [x] Referral conversations held.
- [x] Current value, target, and trailing trend.
- [x] Insufficient-history state without a misleading trend.
- [x] Monthly, not daily, prominence.

Final Phase 7 marker contract:

- **Public portfolio — target 3:** current non-archived project entities whose `project_type` is `portfolio`, `status` is `done`, `is_public` is true, documentation is non-empty, and either repository or demo URL is non-empty. The canonical `updated_at` is the conservative qualification date used for completed-month history.
- **DSA patterns — target 24 mastered:** covered means a current non-archived learning entity with `track = dsa` and `item_type = pattern`; mastered additionally requires `confidence = 5`, `mastery_hits >= 2`, and a `last_reviewed_on` date. History uses that final review date and the card retains the covered count as context.
- **Mock interviews — target 10:** completed `drill` commitments whose trimmed action is `Mock interview` or begins `Mock interview` followed by a separator. Completion time supplies immutable month placement; generic Schedule and Outcome remain the only workflow.
- **Application-to-first-round conversion — target 25%:** denominator is one latest immutable `application.submitted` event per application; numerator is the corresponding canonical application currently at `phone`, `onsite`, or `offer`. Current value is the all-submission conversion through the as-of day; completed-month history is calculated per submission cohort. `oa` is not treated as a first round, and rejected records are not guessed to have converted.
- **Referral conversations — target 12:** distinct person entities with at least one completed `contact` commitment. The first completed contact supplies month placement, so later archive or status changes do not erase a held conversation.
- Count histories are cumulative as of each of the three most recent completed calendar month ends in the owner timezone. Zero is a valid observation once the account existed; conversion requires a non-empty submitted-application cohort in every month. Otherwise the trend is suppressed as insufficient history.

### 8.7 Settings

- [x] Targets with explanation that historical status is derived from current targets.
- [x] Type registry list.
- [x] Create and edit data-only types.
- [x] Version and validate schemas.
- [x] Mark list-visible and filterable fields.
- [x] Configure allowed commitment kinds and defaults.
- [x] Disable a type without deleting records.
- [x] Google Calendar connect, disconnect, and last-sync state.
- [x] Connected MCP clients, application permissions, last activity, and revocation.
- [x] Agent audit/provenance access.
- [x] JSON export.
- [x] Per-type CSV export.
- [x] Theme selection.

### 8.8 Capture, Log, Outcome, and drafts

- [x] Global Capture available on every route.
- [x] Registry-generated forms with labels, types, options, and required rules.
- [x] Optional first commitment during Capture.
- [x] Edit reuses the same schema form.
- [x] Daily Log remains under two minutes.
- [x] Outcome records what happened rather than only a done flag.
- [x] Plugin may propose the next commitment after an outcome.
- [x] User sees and can adjust a computed next date before saving when appropriate.
- [x] Unsaved drafts survive overlay dismissal, save failure, and connection loss.
- [x] Successful saves clear only the submitted draft.

### 8.9 Agent and MCP

- [x] `command_describe_types` returns allowed types, schemas, and commitment kinds.
- [x] `command_capture` creates a validated pending proposal.
- [x] `command_complete` proposes an approval-gated outcome under the initial trust policy.
- [x] `command_schedule` proposes an approval-gated schedule change under the initial trust policy.
- [x] `command_query` supports constrained type, due-window, and text filters.
- [x] No arbitrary SQL or unbounded query language.
- [x] Server validates against the current registry schema.
- [x] Idempotent retries return the existing proposal/result and never overwrite UI edits.
- [x] Read and write application permissions are separate and narrow.
- [x] Sensitive people records are excluded without the additional people-data permission.
- [x] Tool calls remain rate-limited and privately audited.
- [x] Pending proposals never appear in Browse or Due.
- [x] Approve, edit-and-approve, reject, and expire paths work.
- [x] Calendar/external side effects remain outside MCP and require a first-party action.

### 8.10 Platform behaviour

- [ ] Google owner-only authentication.
- [x] OAuth consent for MCP clients.
- [x] Google Calendar token encryption and revocation.
- [ ] PWA install and service worker update prompt.
- [ ] Update prompt never clears an active form.
- [ ] Cached reads and visible staleness state.
- [ ] Offline writes refused explicitly.
- [x] Visibility refresh after MCP or Calendar writes.
- [x] Versioned local cache that cannot load incompatible v2 shapes as v3.
- [x] Demo mode follows the same v3 model as live mode.
- [ ] Loading, empty, error, stale, and offline states on every route.
- [ ] Keyboard shortcuts on desktop without overriding form typing.
- [ ] Accessible focus management, live regions, labels, and reduced motion.

---

## 9. Remaining missing or underspecified work

The source proposal and prototypes do not yet define the following well enough to implement safely.

### Product and interaction gaps

- Settings Export appears in the IA but not v12.
- The IA lists four overlays, while Item requires edit and schedule interactions too.
- Mobile Browse currently points to `application`; it does not define how the user chooses among dynamic types.
- The transactional edit-and-approve contract and Agent inbox review UI are implemented; proposals are bounded to 50 recent records and stale/expired proposals cannot enter canonical views.
- Outcome vocabulary and allowed outcomes per commitment kind are not defined.
- Draft lifetime, expiry, and cross-device behaviour are not defined.
- Archive/search behaviour for archived records is not defined.
- No mobile wireframes exist for Due, Browse, Item, Week, Run, or Settings.

### Data and domain gaps

- Registry schema format, supported field kinds, bounds, key permanence, deprecation, and version evolution are resolved in Phase 2.
- Commitment transitions are resolved in PLAN-016. Multiple simultaneous commitments are allowed and have stable UUID identity rather than an entity/kind/date uniqueness rule.
- Event immutability, correction-by-append, and idempotency uniqueness are resolved in PLAN-017. Phase 7 export includes canonical immutable activity history.
- Final Run filters and targets are resolved in PLAN-027 and use only canonical entities, commitments, and activity events without a marker-specific table, column, or route.
- Changing floor and weekly targets intentionally reinterprets derived historical status using current settings; raw logs and events remain unchanged.
- Calendar links are commitment-scoped. Existing mapped links are preserved, eligible events are rendered from owner-filtered server reads, and retries use deterministic provider event ids.
- Due and readiness reads are bounded; Browse uses bounded server paging and registry-defined sorting from Phase 5.
- Registry deactivation rules and archived-search defaults remain unspecified; field-key and field-change rules are resolved in Section 3.2.

### Security gaps

- Exact MCP permissions and default grants are resolved by PLAN-025. Command privileges are never inferred from Supabase identity scopes, and people data requires its additional data-class grant.
- The storage and administration model for narrowly trusted client/operation/entity-type combinations remains to be defined; the approval boundary is fixed in Section 3.2.
- Registry, entity, activity, and proposal JSON depth/count/size limits are enforced server-side.
- Registry-provided labels/options must be rendered as text, never trusted HTML.
- Same-user referential integrity is enforced for types, entities, commitments, events, proposal targets, and proposal results.
- Proposal approvals use a row lock, target-version precondition, and a single-winner transaction.
- Authenticated canonical writes use security-definer RPCs; users cannot directly insert events or bypass transactional provenance. Connected-client OAuth tokens are denied direct table, UI-RPC, and Calendar access and must use the permission-gated MCP edge boundary.

### Design-system gaps

- v12 contains no responsive rules and cannot serve as production CSS.
- Repeated masthead behaviour on mobile and secondary routes is unresolved.
- Night-edition colours and contrast have not been accessibility-tested.
- Brahmi glyph use is decorative in places despite the old brief prohibiting script as texture.
- Typography loading, offline font behaviour, and final licensed font assets need confirmation.
- Long titles, long select values, large registries, and empty data have responsive regression coverage.

### Operational gaps

- The exact production cutover, smoke-test, monitoring, and fix-forward procedure is defined in `docs/phase8-cutover.md`; executing it remains explicitly unauthorized.
- The v2-to-v3 backup format is a private, encrypted `public` schema/data export with bounded before/after reports, checksum and byte-for-byte decryption verification. Production data and reports never enter Git, CI artifacts, issues, or pull requests.
- PLAN-029 selects a short single-user maintenance window rather than compatibility writes. The backfill locks the legacy sources and runs twice inside one serializable transaction before functions or frontend deployment.
- Existing hash bookmarks remain valid, and the useful legacy hash routes already map to v3 routes from Phase 5.
- README, `AGENTS.md`, and deployment documentation consistently describe the Vercel frontend, Supabase backend, isolated v3 branch, and controlled Phase 8 cutover.
- The original 1–2 week estimate does not include a safe migration, responsive implementation, and full verification.

Every item above must be resolved, explicitly deferred, or turned into a checked task before Phase 8 can complete.

---

## 10. Implementation phases

### Phase 0 — Ratify product and architecture decisions

**Status:** Complete

Tasks:

- [x] Review and approve or amend D-01 through D-10.
- [x] Resolve every blocking question in Section 3.2.
- [x] Confirm target routes and overlay workflows.
- [x] Confirm the canonical-state-plus-audit architecture or restore full event sourcing with a complete projection design.
- [x] Define the job-hunt weekly unit and migration treatment.
- [x] Bound Run marker sources and trend rules; deliberately defer final filters and targets to Phase 7 without permitting schema or route changes.
- [x] Define MCP permission and approval policy.
- [x] Declare which older design/spec sections are superseded.
- [x] Update this document to version 1.0 and mark it Approved.

Exit gate:

- [x] No unresolved decision can change the database schema or primary navigation.

### Phase 1 — Stabilise the current system

**Status:** Complete

Tasks:

- [x] Change MCP capture retries so an identical idempotency key cannot overwrite an existing row.
- [x] Add regression tests proving UI edits survive an MCP retry.
- [x] Make MCP Today read user settings and return derived floor status.
- [x] Share or consolidate date/floor logic used by browser and edge functions.
- [x] Refresh remote data on `visibilitychange` when returning to the app.
- [x] Bound and order current reads needed during migration.
- [x] Record ADRs for Vercel and the deliberately hand-rolled router/sync/forms.
- [x] Reconcile README, `AGENTS.md`, and deployment documentation.

Exit gate:

- [x] Current tests pass and the known multi-writer data-loss bug is closed before the v3 migration expands writing capability.

Verification on 2026-08-31:

- Targeted MCP, API, date/floor, and visibility-refresh tests: 5 files, 17 tests passed.
- `npm test`: 8 files, 27 tests passed.
- `npx tsc -b`: passed with no errors.
- `npm run build`: passed; Vite production bundle completed.
- Blockers: none.

### Phase 2 — Add the v3 data foundation

**Status:** Complete

Tasks:

- [x] Add the next append-only migration number; never edit applied migrations.
- [x] Create `entity_types` with RLS, grants, indexes, constraints, and seed types.
- [x] Create `entities` with same-user type integrity and schema-version fields.
- [x] Create `commitments` with state constraints and due indexes.
- [x] Create immutable `activity_events` and its idempotency constraints.
- [x] Create `agent_proposals` and approval/rejection transition constraints.
- [x] Add transactional mutation/approval RPCs.
- [x] Implement bounded server-side registry schema validation.
- [x] Add views/queries for Today, Due, Week, and readiness inputs.
- [x] Add pgTAP tests for every select/insert/update/archive path and cross-user denial.
- [x] Regenerate `src/lib/database.types.ts`.
- [x] Add app row types and mappers without removing legacy ones.

Exit gate:

- [x] Database tests prove ownership, immutability, idempotency, and approval atomicity.

Progress verified on 2026-08-31:

- Added `0013_v3_data_foundation.sql` for `entity_types` and append-only `0014_entity_type_validation_lint.sql` for validator corrections found after local application.
- Seeded stable `application`, `person`, `project`, `learning`, and `note` type identities at schema version 1. Full legacy-field definitions remain the first Phase 3 task and will advance them to version 2 before backfill.
- Enforced bounded schemas, allow-listed fields/icons/commitments/plugins, permanent type and field keys, explicit schema-version evolution, deprecation instead of field removal, owner RLS, and no authenticated hard delete.
- Added the `EntityType` app model, database row alias, mapper, and mapper regression test without removing legacy types or mappers; dependent Phase 2 mappers were completed in later slices below.
- Added append-only `0015_v3_entities.sql` with same-owner type integrity, active schema-version enforcement, bounded primitive field validation, owner RLS, archive/restore, and no authenticated hard delete. Identity, ownership, type, and creation timestamp are permanent.
- Historical entities remain title-editable and archivable/restorable after schema evolution or type disablement; changing their typed fields requires explicit migration to the current schema version.
- Added the `Entity` app model, database row alias, mapper, and mapper regression test; the remaining Phase 2 mappers were completed below.
- Added append-only `0016_v3_commitments.sql` with same-owner entity integrity, allow-listed kinds, open/completed/cancelled invariants, terminal closed states, due indexes, RLS, and no authenticated direct writes or hard delete.
- Added append-only `0017_v3_audit_and_proposals.sql` with bounded immutable activity events, source/client/user idempotency, schema-valid pending proposals, permanent targets, expiry, and result integrity.
- Added append-only `0018_v3_transactional_writes.sql` with idempotent entity/commitment mutation RPCs and single-winner proposal approval/rejection. Canonical state and provenance commit atomically; stale approvals and invalid edit-and-approve payloads roll back without partial state.
- Added append-only `0019_v3_derived_reads.sql` with the approved weekly target columns and bounded, owner-scoped Today, Due, Week, and readiness functions.
- Added commitment, activity, proposal, weekly-target, database-row, and mapper models without removing any legacy model or mapper. Older local settings caches gain the approved 15/2 targets without losing saved values.
- `npm run test:db`: 6 files, 235 assertions passed.
- `npx supabase db lint --local --level warning`: no schema errors or warnings.
- `npm test`: 9 files, 32 tests passed.
- `npx tsc -b`: passed with no errors.
- `npm run build`: passed; Vite production bundle completed.
- Blockers: none.

### Phase 3 — Backfill and prove data compatibility

**Status:** Complete

Tasks:

- [x] Seed initial application, person, project, learning, and note type definitions.
- [x] Write idempotent backfills for every mapping in Section 7.
- [x] Preserve a stable source-to-v3 id map.
- [x] Backfill multiple commitments where a source row has multiple meaningful dates.
- [x] Preserve existing ideas as note records tagged `idea`.
- [x] Preserve historical daily logs and job-minute values.
- [x] Relink Calendar integration records where safely possible.
- [x] Append migration provenance events.
- [x] Produce automated before/after row and field reports.
- [x] Compare full JSON and CSV exports before and after.
- [x] Test backfill twice and prove the second run creates no duplicates.
- [x] Keep all legacy tables intact.

Exit gate:

- [x] Every existing record is accounted for, required values match, and no source table has been deleted or rewritten destructively.

Progress verified on 2026-08-31:

- Added append-only `0020_v3_seed_type_schemas.sql` with version-2 definitions for the five stable types; untouched v1 seeds upgrade in place and new profiles receive v2 seeds.
- Added append-only `0021_v3_legacy_backfill.sql` with service-role-only preflight, stable source maps, idempotent entity/commitment backfills, migration and historical outcome events, Calendar relinking, JSON/CSV compatibility exports, and row/field reports. `0022`–`0024` preserve deferred map ordering, restore deferred ownership FKs, and correct the Calendar report without editing applied migrations.
- Added representative pgTAP coverage proving every Section 7 mapping, both application commitments, idea tagging, historical minutes, Calendar preservation/relinking, migration provenance, exact JSON/CSV exports, legacy-table retention, preflight safety, and no duplicates on a second run.
- `npm run test:db`: 7 files, 270 assertions passed.
- `npx supabase db lint --local --level warning`: no schema errors or warnings.
- `npm test`: 9 files, 32 tests passed.
- `npx tsc -b`: passed with no errors.
- `npm run build`: passed; Vite production bundle completed.
- Blockers: none. Production backfill remains intentionally deferred to the Phase 8 maintenance-window/cutover procedure.

### Phase 4 — Build the responsive Gazette shell

**Status:** Complete

Tasks:

- [x] Translate the visual direction into repo-native React and CSS; do not embed the artifact runtime.
- [x] Define shared typography, colour, spacing, rule, focus, and state tokens.
- [x] Build responsive AppHeader/masthead variants.
- [x] Build desktop navigation and mobile bottom navigation.
- [x] Build the shared Sheet/Dialog primitive with focus trap and restoration.
- [x] Build toast/live-region, offline, stale, saving, and update states.
- [x] Implement day and night editions with persisted preference.
- [x] Implement compact mobile masthead and secondary-screen header.
- [x] Remove every fixed grid that overflows at 380px.
- [x] Add visual/component tests for 380px, common iPhone widths, tablet, and desktop.
- [x] Test 200-character titles, empty sections, many types, and large values.

Exit gate:

- [x] No horizontal overflow; essential Today status fits the approved first-viewport hierarchy; keyboard and screen-reader navigation work.

Progress (2026-08-31):

- Added Gazette typography, spacing, rule, focus, and state tokens with day/night palettes; persisted the edition through Settings, local cache, and `user_settings`.
- Added responsive AppHeader controls, desktop/mobile navigation semantics, compact masthead rules, and modal layering above the mobile rail.
- Verified Sheet focus trapping/restoration and Escape handling in `src/ui.test.tsx`; existing sync, toast, update, stale, and offline states remain bounded and live-region backed.
- Added the date-scoped weekly application/contact progress summary to Today and verified that it stays visible with the floor summary and primary action at 380px.
- Added Playwright coverage for 380px, 390px, 768px, 1280px, every legacy type route at 380px, empty sections, 200-character titles, and large captured notes; `npm run test:e2e` passes 10/10.
- Exit gate verified: no horizontal overflow, first-viewport hierarchy is visible at 380px, and keyboard/screen-reader-oriented Sheet and navigation behavior pass tests.

### Phase 5 — Build the core v3 product workflows

**Status:** Complete

Tasks:

- [x] Replace fixed `CommandData` arrays with the v3 data model.
- [x] Version the local cache and demo data.
- [x] Add bounded API loaders for registry, Today, Due, Browse, and Item.
- [x] Preserve optimistic local updates through generic mutators.
- [x] Implement Today.
- [x] Implement Due with URL-backed filters.
- [x] Implement registry-driven Browse.
- [x] Implement universal Item.
- [x] Implement global Capture and Edit.
- [x] Implement Schedule and Outcome.
- [x] Adapt Daily Log to the approved three-floor/job metric model.
- [x] Implement archive and restore.
- [x] Implement per-overlay draft retention.
- [x] Redirect or map useful legacy hash routes.
- [x] Add unit, mapper, API, component, and mobile E2E tests.

Progress (2026-09-01):

- Replaced the fixed top-level aggregate with versioned canonical `entityTypes`, `entities`, `commitments`, and `activityEvents` collections plus an explicit `legacy` compatibility payload for routes not yet migrated.
- Added the complete five-type built-in demo registry and a deterministic legacy-to-v3 projection that preserves historical daily/job minutes, converts dated obligations to open commitments, and retains ideas as notes tagged `idea`.
- Versioned demo, live, and settings caches at v3; existing v1 browser caches migrate forward without deleting the old data, and incompatible partial v3 payloads are not exposed to the app.
- Extended the bounded aggregate remote read to include ordered registry, entity, commitment, and activity tables while retaining the bounded legacy reads required during migration.
- Verified focused cache/API/mapper/projection coverage, all 42 unit tests, clean TypeScript, production build, and all 10 current-route/mobile Playwright tests.
- Completed the Phase 5 route replacement: Today is exception-first only for overdue commitments and otherwise exposes the three practice floors, weekly 15/2 progress, and primary Log action; Due has stable URL-backed window/type filters; Browse and Item are registry-driven; and global Capture/Edit, Schedule, Outcome, archive/restore, and draft retention use canonical entities and commitments.
- Added bounded screen loader contracts, generic optimistic UI mutators backed by `write_v3_entity` and `write_v3_commitment`, deterministic demo migration provenance, and useful legacy hash mapping without deleting legacy code or data.
- Verified the exit workflow in demo mode through unit and browser coverage: capture a seeded type, schedule it, find it in Due/Browse, record an outcome, inspect provenance, and archive/restore it. Live mode uses the same RPC and cache boundaries after the separately authorised production cutover.
- Final verification: `npm test` passed 13 files / 47 tests; `npx tsc -b` passed; `npm run build` passed; and `npm run test:e2e` passed all 9 workflow, empty-state, PWA, long-value, legacy-route, and 380px mobile tests.
- Production verification correction (2026-09-01): the Phase 5 frontend was deployed before the v3 database migrations and failed after authentication because `public.entity_types` was absent. The public Vercel alias was restored to the compatible Phase 4 deployment from `e2d5d15`; authenticated production verification remains reserved for the controlled Phase 8 migration and smoke tests.
- Correction pass completed on 2026-09-01: live Due and Browse use bounded 25-row server pages with cached fallback; registry sorting uses canonical entity timestamps; weekly 15/2 progress uses the same immutable outcome events as `get_v3_today`; and append-only migration `0025_v3_phase5_write_corrections.sql` makes entity-plus-first-commitment capture atomic while preserving stale-retry safety.
- Restored cache compatibility for older timestamp-less v3 entities, desktop overdue-plus-floor hierarchy, mobile action wrapping, explicit pagination, common phone/tablet/desktop coverage, large dynamic-registry coverage, and long-value stress coverage.
- Corrected verification: `npm test` passed 14 files / 57 tests; `npx tsc -b` passed; `npm run build` passed; `npm run test:e2e` passed 12/12; `npm run test:db` passed 8 files / 283 assertions; and local database lint reported no schema errors.

Exit gate:

- [x] A user can capture any seeded type, schedule it where the registered type permits commitments, find it in Due/Browse, record an outcome, inspect provenance, and archive/restore it against the demo and local production-contract environments. Authenticated production smoke testing remains explicitly gated by Phase 8.

### Phase 6 — Rebuild MCP and agent review

**Status:** Complete

Tasks:

- [x] Replace seven hardcoded tools with the approved five generic tools.
- [x] Implement registry discovery.
- [x] Validate all write payloads server-side against current schema and commitment rules.
- [x] Route untrusted writes into `agent_proposals`.
- [x] Enforce per-client read/write/data-class application permissions.
- [x] Add strict query filters, limits, and safe error messages.
- [x] Make capture, complete, and schedule retries idempotent.
- [x] Build Agent inbox with approve, edit-and-approve, reject, and expired states.
- [x] Show source/client provenance on Item.
- [x] Refresh the browser after proposal decisions and external writes.
- [x] Preserve OAuth discovery, consent, rate limiting, and private audit.
- [x] Add tool-contract, repository, authorization, idempotency, and injection-resistance tests.

Exit gate:

- [x] A newly registered data-only type is discoverable and capturable through MCP without redeployment, while no unapproved proposal appears in primary views.

Progress verified on 2026-09-02:

- Replaced the MCP surface with the five generic tools and made discovery, capture validation, commitment validation, bounded querying, safe errors, rate limiting, and private audit registry-aware.
- All MCP writes create owner/client/idempotency-keyed proposals. Retries return the original proposal before changed registry or target state can reject the replay; canonical changes occur only through the transactional owner review RPC.
- Added the Agent inbox with pending-only Today indicator, approve, edit-and-approve, reject, derived expiry, bounded recent history, and post-decision refresh. Approved changes retain MCP source/client provenance on Item; pending records never enter canonical primary views.
- Added owner/client application permissions for type read, data read, proposal write, and additional person data. Supabase OAuth identity scopes grant no Command permission.
- Added defense in depth for Supabase OAuth's authenticated database tokens: direct PostgREST access, permission self-escalation, first-party mutation RPCs, and Calendar actions are denied. The MCP Edge Function uses service-only reads with explicit owner/client filters.
- Added append-only migrations `0026`–`0032` for current-target proposal guards, stale rejection, permission storage and management, direct OAuth database isolation, service-only Due reads, and explicit guards on every first-party UI mutation RPC. Generated database types were refreshed.
- Targeted MCP, authorization, consent, Agent inbox, Calendar-token, and API coverage: 7 files / 33 tests passed.
- `npm test`: 18 files / 77 tests passed.
- `npx tsc -b`: passed with no errors.
- `npm run build`: passed; Vite production bundle completed with the existing non-blocking chunk-size warning.
- `npm run test:e2e`: 13/13 browser tests passed, including the 380px Agent inbox and first-viewport gate.
- `npm run test:db`: 11 files / 329 assertions passed.
- `npx supabase db lint --local --level warning`: no schema errors or warnings.
- Blockers: none. Production deployment and live smoke testing remain Phase 8 work.

### Phase 7 — Add review, readiness, export, and integrations

**Status:** Complete

Tasks:

- [x] Implement Week from derived data.
- [x] Implement the five approved Run markers and insufficient-history states.
- [x] Port `applyRecall` into the behaviour-plugin contract without changing its tested schedule.
- [x] Implement plugin-scheduled follow-on commitments through Outcome.
- [x] Implement Targets and Type registry Settings.
- [x] Implement Integrations, permissions, clients, revocation, and audit access.
- [x] Implement dynamic JSON and per-type CSV export.
- [x] Generalise Calendar event mapping from applications/projects to approved commitment kinds.
- [x] Preserve Calendar idempotency, unlinking, refresh, and encrypted tokens.
- [x] Decide whether a Calendar route has earned inclusion; D-06 remains unchanged, so no route was added.
- [x] Add derived-query, export, plugin, and Calendar tests.

Progress verified on 2026-09-02:

- Implemented the responsive `/#/week` review from the existing bounded `get_v3_week` contract, with direct desktop navigation and a mobile entry under More.
- Week uses Monday–Sunday `Asia/Kolkata` dates, the three practice budgets, weekly 15/2 application and outreach outcomes, a seven-day execution view with future days marked pending, proposal activity, commitment outcomes, and an explicit empty-week structure.
- Live mode reads the owner-scoped RPC through `src/lib/api.ts`; demo/cached mode derives the same typed shape locally without introducing a second database contract or changing an applied migration.
- Targeted Week/application coverage: 3 files / 19 tests passed; the focused Week pgTAP contract passed 1 file / 38 assertions; the corrected focused mobile Week browser check passed 1/1.
- `npm test`: 19 files / 80 tests passed.
- `npx tsc -b`: passed with no errors.
- `npm run build`: passed; Vite production bundle completed with the existing non-blocking chunk-size warning.
- `npm run test:e2e`: 14/14 browser tests passed, including direct desktop Week navigation, mobile More navigation, four pending future days at 380px, and route-wide overflow coverage.
- `npm run test:db`: 11 files / 335 assertions passed.
- `npx supabase db lint --local --level warning`: no schema errors or warnings.
- `git diff --check`: passed.
- Defined the final Run filters and targets in PLAN-027, then added append-only migration `0033_v3_run_summary.sql` with a fixed five-marker, three-month, owner-scoped derived read. No marker-specific table or column was added.
- Implemented `/#/run` with current values, targets, supporting counts, cumulative completed-month histories, conversion-cohort history, and explicit insufficient-history suppression. Run stays under More/Settings instead of occupying the daily primary rail.
- Live mode uses `get_v3_run`; demo/cached mode derives the same typed contract from canonical entities, commitments, and activity events.
- Targeted Run application coverage: 2 files / 15 tests passed; focused Run pgTAP coverage passed 1 file / 18 assertions; the focused 380px Run browser flow passed 1/1.
- `npm test`: 20 files / 83 tests passed.
- `npx tsc -b`: passed with no errors.
- `npm run build`: passed; Vite production bundle completed with the existing non-blocking chunk-size warning.
- `npm run test:e2e`: 15/15 browser tests passed, including the five-marker Run review, honest trend suppression, mobile More navigation, and route-wide overflow coverage.
- `npm run test:db`: 12 files / 353 assertions passed.
- `npx supabase db lint --local --level warning`: no schema errors or warnings.
- `git diff --check`: passed.
- Added an explicit allow-listed behaviour-plugin contract and ported spaced repetition without changing its 21/7/3/1-day schedule. Outcome validates and records the result transactionally, previews an adjustable next date, updates mastery fields, and optionally creates the follow-on commitment without a type-specific screen.
- Added registry administration for data-only types, permanent type/field keys, schema-versioned evolution, field metadata, allowed commitment kinds, plugin selection, safe disablement, weekly targets, and immediate generic Capture/Browse support.
- Separated OAuth identity grants from all four Command application permissions in Settings, including per-client grant editing, revocation, last activity, and bounded private MCP audit access. Installed Supabase Auth types confirm `getAuthorizationDetails` supplies the `client.id` and `user.id` consumed by the consent screen.
- Replaced legacy export shapes with canonical v3 JSON and schema-driven per-type CSV that includes archived rows and deprecated fields with correct escaping.
- Generalised manual Calendar export to approved open commitments: deadlines, milestones, and explicitly labelled mock-interview drills. The Edge Function re-reads owner-scoped canonical rows, maps content server-side, uses deterministic Google event ids, updates existing links, unlinks closed/ineligible records, records provenance, and keeps OAuth-client access blocked.
- Extracted Calendar token storage to authenticated AES-256-GCM encryption with a random IV and exact 32-byte key validation. Settings retains connect, verification, last-sync, disconnect, and revocation state; no standalone Calendar route was added because D-06 remains valid.
- Added append-only local migrations `0034_v3_phase7_plugins_and_registry.sql`, `0035_v3_plugin_outcome_qualification_fix.sql`, `0036_v3_plugin_registry_guard.sql`, and `0037_v3_plugin_retry_result_fix.sql`; each correction after local application was added as a new migration rather than rewriting history.
- Targeted MCP/auth/API/Agent/consent/Calendar/plugin/Week/Run coverage: 13 files / 59 tests passed.
- Targeted Phase 7 database coverage: 1 file / 24 assertions passed.
- Targeted data-only type and adjustable-recall browser coverage: 2/2 tests passed.
- `npm test`: 22 files / 97 tests passed.
- `npx tsc -b`: passed with no errors.
- `npm run build`: passed; Vite production bundle completed with the existing non-blocking chunk-size warning.
- `npm run test:e2e`: 17/17 browser tests passed.
- `npm run test:db`: 13 files / 377 assertions passed.
- `npx supabase db lint --local --level warning`: no schema errors or warnings.
- `deno check --no-config supabase/functions/google-calendar/index.ts`: passed.
- `git diff --check`: passed.
- Blockers: none. Production deployment, migration, live authentication, and smoke testing remain explicitly gated Phase 8 work.

Exit gate:

- [x] Weekly/monthly review, type administration, export, recall scheduling, and approved Calendar workflows operate without type-specific frontend screens.

### Phase 8 — Cut over, harden, and retire legacy paths

**Status:** Not started

Preparation completed on 2026-09-03 without starting the phase: the production
runbook now separates safe local work from every production/external command,
the backend workflow has independent migration and function stages pinned to a
full release SHA, and repo-owned SQL provides the bounded pre-export report plus
atomic idempotent backfill/verification gate. No production access, export,
migration, deployment, push, alias change, or external-system mutation occurred.

Preparation verification on 2026-09-03:

- The pre-migration SQL deliberately rejected the already-migrated local schema;
  the backfill gate passed against empty and representative disposable local
  single-owner data. The representative report balanced five entities, five
  commitments, twelve migration events, exact JSON/CSV compatibility, one
  Calendar relink, zero pending links, and an unchanged second pass. The local
  fixture was removed and the immutable-event trigger was confirmed enabled.
- Workflow YAML parsing, backup-artifact ignore checks, and `git diff --check`
  passed.
- `npm test`: 22 files / 97 tests passed.
- `npx tsc -b`: passed with no errors.
- `npm run build`: passed with only the existing chunk-size warning.
- `npm run test:e2e`: 17/17 passed after making the fixed-time Week/Run setup
  survive route initialization.
- `npm run test:db`: 13 files / 377 assertions passed.
- `npx supabase db lint --local --level warning`: clean.
- Deno checks passed for both Edge Functions, using the function import map for
  `command-mcp` and the existing no-config check for `google-calendar`.

Tasks:

- [ ] Produce an encrypted/private production export before migration.
- [ ] Announce and use a short single-user maintenance window for final backfill/cutover.
- [ ] Apply additive migrations and run the final idempotent backfill.
- [ ] Verify counts, fields, commitments, and ownership before frontend deployment.
- [ ] Deploy v3 frontend and edge functions.
- [ ] Run production smoke tests for auth, Today, Capture, Outcome, Calendar, MCP consent, proposal approval, export, PWA update, and sign-out.
- [ ] Monitor audit/error state through the stabilisation window.
- [ ] Fix forward after v3 writes begin; do not destructively roll the database back.
- [ ] Keep legacy tables untouched for at least one stable release.
- [ ] Remove old frontend views/mappers only after production verification.
- [ ] Move superseded specifications to an explicit historical status and update README/AGENTS.
- [ ] Create a separately approved cleanup migration if legacy tables are ever retired.

Exit gate:

- [ ] Every criterion in Section 15 passes and no required task remains unchecked.

---

## 11. Safe migration and rollback rules

- All database changes are additive migrations.
- Never change or delete an applied migration.
- Never delete source data during the v3 build.
- Every backfill is idempotent and reports what it created, skipped, and could not map.
- Test migration against representative data before production.
- Take and verify a production export immediately before cutover.
- Use a short maintenance window because the system has one owner; rerun the idempotent backfill immediately before deployment.
- Before the first successful v3 write, frontend rollback to v2 remains possible.
- After v3 writes begin, prefer fixing forward. A v2 frontend would not understand new dynamic types or commitments.
- Legacy tables remain available for verification and manual recovery through the stabilisation period.
- Any later destructive cleanup requires a new plan entry and explicit approval.

---

## 12. Security requirements

- Every user-owned row has RLS for each permitted operation.
- Generic relationships enforce same-user ownership, not only application-level checks.
- Browser components never call Supabase directly; they call `useCommandData` mutators and `lib/api`.
- Canonical mutations and audit-event insertion are transactional.
- Agent proposals are schema-validated before storage and revalidated on approval.
- Repeated idempotency keys never overwrite later UI edits.
- MCP query results are bounded, scoped, and exclude unnecessary sensitive fields.
- Calendar write permission is separate from Command database write permission.
- No registry value becomes executable code, SQL, HTML, a URL fetch, or an unrestricted asset path.
- Payload depth, field count, string size, options count, and query limits are enforced server-side.
- MCP audit summaries avoid storing secrets or full sensitive payloads unnecessarily.
- Archive and correction are normal user operations; delete is not.
- OAuth, PKCE, token encryption, owner allow-list, rate limiting, and request-scoped CORS remain intact.

---

## 13. Verification matrix

### Required on every implementation handoff

```bash
npm test
npx tsc -b
npm run build
```

### Required for affected phases

- `npm run test:e2e` for routes, sheets, mobile layout, and critical workflows.
- `npm run test:db` for migrations, RLS, constraints, and RPCs.
- Edge-function tests for MCP and Calendar contract changes.
- Backfill verification report for migration phases.

### Manual viewport checks

- 380px mobile width.
- Current iPhone portrait viewport.
- Tablet portrait and landscape.
- 1280px desktop.
- 200% browser zoom.
- Reduced-motion preference.
- Keyboard-only navigation.
- Day and night editions.

### Manual live checks

- Owner Google sign-in and sign-out.
- Session expiry and re-authentication.
- Calendar connect, refresh, push, unlink, and disconnect.
- MCP OAuth consent, application-permission display, and revocation.
- Agent proposal approval/rejection.
- Visibility refresh after an MCP write.
- Offline cached read and refused write with retained draft.
- JSON and every seeded type's CSV export.
- PWA install and update prompt during/without active form entry.

---

## 14. Rough delivery estimate

Estimate only after Phase 0 decisions are resolved.

| Work | Focused solo estimate |
|---|---|
| Current-system safety fixes | 2–4 days |
| Schema, RLS, RPCs, validation, and tests | 4–7 days |
| Backfill and compatibility proof | 3–5 days |
| Responsive Gazette shell and core screens | 6–10 days |
| MCP, proposal gate, and provenance | 4–7 days |
| Week, Run, plugins, export, Calendar adaptation | 4–7 days |
| Cutover, accessibility, E2E, docs, stabilisation | 3–5 days |

Expected production-safe range: approximately **4–6 focused weeks**. Removing full event sourcing makes a **2–3 week core slice** possible, but it does not remove the remaining review, readiness, integration, accessibility, and cutover work.

This estimate must not be converted into a deadline until the missing product decisions are closed.

---

## 15. Final completion gate

Command v3 is complete only when all of the following are true:

- [x] All decisions in Section 3 are resolved and recorded.
- [ ] Every required feature in Section 8 is checked or explicitly deferred with approval.
- [ ] Every missing item in Section 9 is resolved, implemented, or explicitly deferred.
- [ ] Existing production data is migrated and verified with no unexplained loss.
- [x] A new data-only type works in Settings, Capture, Browse, Item, export, and MCP without deployment.
- [ ] Every dated record uses the unified commitment path.
- [x] An MCP retry cannot overwrite a UI edit.
- [x] Unapproved agent proposals never enter Browse, Due, Item, or Calendar.
- [ ] Every canonical change shows honest provenance.
- [x] Existing recall scheduling passes unchanged through the plugin contract.
- [x] The browser refreshes external changes without manual reload.
- [x] Today is fast and legible at 380px with no horizontal overflow.
- [ ] Every route has loading, empty, error, stale, and offline behaviour.
- [ ] Accessibility requirements pass keyboard and screen-reader-oriented review.
- [x] RLS and permission tests prevent cross-user, direct-OAuth, or over-broad access.
- [x] `npm test`, `npx tsc -b`, and `npm run build` pass.
- [ ] Required E2E, database, edge, migration, and production smoke tests pass.
- [x] README, AGENTS, architecture docs, and deployment instructions describe reality.
- [ ] Legacy cleanup, if any, is separately approved and recoverable.

---

## 16. Decision log

Add a row whenever a decision changes implementation, scope, migration, or user behaviour.

| Date | ID | Decision | Reason | Consequences |
|---|---|---|---|---|
| 2026-08-30 | PLAN-001 | Create a living v3 plan before implementation | The proposal, IA, prototypes, and current app contain unresolved conflicts | Phase 0 becomes mandatory |
| 2026-08-30 | PLAN-002 | Recommend canonical state plus immutable audit events | Preserves provenance and safe writes with lower complexity than immediate full event sourcing | Requires approval as D-02 |
| 2026-08-31 | PLAN-003 | Approve D-01 through D-10 | The product, architecture, migration, and delivery direction is accepted | Phase 1 may begin; this plan supersedes conflicting older material |
| 2026-08-31 | PLAN-004 | Set weekly job-hunt targets to 15 submitted applications and 2 new people contacted | Applications and outreach are weekly outcomes, not daily time floors | Preserve historical job minutes; v3 has only three daily practice floors |
| 2026-08-31 | PLAN-005 | Make Today exception-first only for overdue work and fix the 380px first viewport | Urgency should interrupt practice only when action is late | Show the exception or floor summary, application progress, and primary action without scrolling |
| 2026-08-31 | PLAN-006 | Defer the Calendar route and keep manual, allow-listed Calendar export | Due owns dated work and external writes carry additional risk | Initially export only interviews, hard deadlines, and important milestones; always require approval |
| 2026-08-31 | PLAN-007 | Require approval for all MCP writes initially, with only narrow future trust | Limits confused-agent impact without ruling out earned automation | Future trust is keyed by client, operation, and entity type; unapproved writes remain proposals |
| 2026-08-31 | PLAN-008 | Make registry field keys permanent and plugin selection allow-listed | Prevents silent data reinterpretation and executable user configuration | Labels may change; removal deprecates; type changes require a new field and explicit migration |
| 2026-08-31 | PLAN-009 | Fix commitment states at open, completed, and cancelled | Overdue and missed are temporal interpretations, not competing canonical states | Derive overdue and missed on read |
| 2026-08-31 | PLAN-010 | Preserve Ideas as tagged notes and expose archive/restore instead of hard delete | Keeps historical data recoverable while simplifying navigation | No dedicated Ideas route and no normal hard-delete control |
| 2026-08-31 | PLAN-011 | Keep the product name Command and use Gazette as its visual language | Separates brand identity from presentation | Older conflicting naming and yantra-first visual direction are superseded |
| 2026-08-31 | PLAN-012 | Use visibility refresh before realtime and canonical state plus immutable audit instead of event sourcing | Matches the current single-user/multi-writer scale with lower complexity | Realtime and full replay/projections remain out of scope |
| 2026-08-31 | PLAN-013 | Bound Run to canonical v3 sources and defer final formulas to Phase 7 | Exact targets were not part of the approved inputs and do not need schema specialization | Use three completed calendar months; suppress trends until sufficient history exists |
| 2026-08-31 | PLAN-014 | Seed stable type identities in Phase 2 and add full legacy field definitions in Phase 3 | Backfill mappings should be finalized immediately before they are exercised, without delaying registry ownership and security work | Initial seeds use empty schema version 1; Phase 3 adds fields as version 2 before any entity backfill |
| 2026-08-31 | PLAN-015 | Validate typed field edits against the current active schema while allowing title edits and archive/restore on historical entities | Schema evolution or disabling a type must not trap or discard existing records | Field changes on stale rows require explicit schema-version migration; historical records remain recoverable and minimally editable |
| 2026-08-31 | PLAN-016 | Allow multiple simultaneous commitments and make `open` the only state that can transition to `completed` or `cancelled` | Entity/kind/date uniqueness would incorrectly collapse distinct obligations; overdue and missed remain derived | Closed states are terminal, both closed paths require an outcome, and corrections retain the same state while appending provenance |
| 2026-08-31 | PLAN-017 | Require authenticated canonical writes to use transactional RPCs and scope event idempotency by owner, source, client, and key | Direct writes could separate canonical state from provenance or let retries overwrite later edits | Entity/commitment changes and immutable events commit together; reused keys return the original result or fail safely across mutation kinds |
| 2026-08-31 | PLAN-018 | Revalidate proposals on approval and require a row lock plus target-version match | A valid pending proposal may become stale before the user decides it | One decision wins; stale or invalid approvals leave proposal, canonical rows, and events unmodified |
| 2026-08-31 | PLAN-019 | Store weekly 15/2 targets in settings and expose only bounded derived reads in Phase 2 | Today, Due, Week, and Run inputs need a stable database contract without prematurely implementing their UI or final Phase 7 formulas | Current targets reinterpret summaries; raw logs/events stay unchanged; readiness formulas remain deferred |
| 2026-08-31 | PLAN-020 | Finalize the five built-in schemas at version 2 and backfill through stable service-role source maps with compatibility exports | Dated legacy fields need canonical commitments without losing source values, and the cutover must be repeatable and auditable | Source tables remain intact; migration provenance is explicit; Calendar links relink only when a mapped commitment is unambiguous |
| 2026-09-01 | PLAN-021 | Begin Phase 6 with the fixed generic MCP contract and registry discovery | The approved five-tool public surface must replace type-specific tools before trust, proposal-review UI, and scope work can safely build on it | MCP integration work uses current registry schemas and existing canonical proposal/RPC boundaries; no production function deployment occurs in this slice |
| 2026-09-01 | PLAN-022 | Restore the production frontend alias to the Phase 4 deployment until the Phase 8 database cutover | Phase 5 requires v3 tables that were not yet present in production, so authenticated loading failed on `public.entity_types` | Preserve Phase 5 and Phase 6 source work without exposing it at the public alias or applying production migrations early |
| 2026-09-01 | PLAN-023 | Repair the Phase 5 implementation gate before resuming Phase 6 and isolate remaining v3 work from the production branch | Audit found unwired screen loaders, incomplete pagination/sort semantics, inconsistent weekly metrics, a split capture workflow, and lost regression coverage | Continue on `command-v3`; production stays on Phase 4 and live v3 verification remains a Phase 8 gate |
| 2026-09-01 | PLAN-024 | Treat local production-contract verification as the Phase 5 implementation gate and reserve authenticated production smoke testing for Phase 8 | Requiring live v3 reads before the planned schema/backfill cutover creates an impossible and unsafe phase dependency | Phase 5 may close after local application/database/browser gates pass; the public alias stays on Phase 4 until the coordinated cutover |
| 2026-09-02 | PLAN-025 | Split MCP authorization into owner/client application grants for registry read, data read, proposal write, and additional people data | Supabase currently supports only OIDC identity scopes and explicitly does not support custom resource scopes; Command still needs independent, honest permissions | Store selected grants in an RLS-protected Command row during consent; missing rows deny all tools, broad reads omit people without `command:data:people`, all writes remain approval-gated proposals, and Calendar permission stays separate |
| 2026-09-02 | PLAN-026 | Deny Supabase OAuth-client tokens direct access to Command tables, first-party mutation RPCs, and Calendar; let the MCP edge read only through explicitly owner-scoped service queries | Supabase OAuth access tokens use the normal `authenticated` database role, so tool-level permissions alone would otherwise be bypassable through PostgREST or existing UI RPCs | Restrictive RLS and guarded RPCs keep the five-tool MCP boundary authoritative; application permission rows cannot be self-escalated and Calendar stays first-party only |
| 2026-09-02 | PLAN-027 | Fix Run at targets 3 public portfolios, 24 mastered DSA patterns, 10 explicitly labelled mock-interview drills, 25% application-to-first-round conversion, and 12 distinct completed person contacts | The approved marker names lacked implementable filters and targets; the final contract must use only canonical entities, commitments, and immutable activity without a special-purpose table or column | `get_v3_run` may add one bounded derived-read RPC; count history is cumulative over three completed owner-local months, conversion uses monthly submission cohorts, and missing coverage suppresses trends rather than inventing a slope |
| 2026-09-02 | PLAN-028 | Keep spaced repetition as the first allow-listed behaviour plugin and make Calendar export a manual, commitment-scoped, server-mapped first-party action | Plugin code must remain bounded and testable, while Calendar content and eligibility cannot be trusted to browser or MCP payloads | Outcome may atomically create an adjustable plugin follow-on; only open deadlines, milestones, and explicit mock-interview drills are eligible; deterministic provider ids, owner-scoped reads, encrypted tokens, unlinking, and provenance preserve safe retries |
| 2026-09-03 | PLAN-029 | Use a short single-user maintenance window and split the backend release into migration and function stages around a serializable backfill/verification gate | Compatibility writes would add unnecessary dual-write risk, while the existing all-in-one workflow could deploy functions before production data was proven | The authorized operator first verifies a private encrypted export, idles all writers, applies migrations only, runs the backfill twice with exact compatibility/ownership/provenance checks, then deploys functions and the frontend from one immutable SHA |

---

## 17. Change log

| Plan version | Date | Change |
|---|---|---|
| 0.1 | 2026-08-30 | Initial living plan: product explanation, architecture, feature inventory, missing work, phased implementation, migration rules, and completion gates |
| 1.0 | 2026-08-31 | Approved D-01–D-10; resolved Phase 0 decisions; completed Phase 0 and Phase 1 with MCP idempotency, settings-aware floors, visibility refresh, bounded reads, ADRs, documentation, and passing verification |
| 1.1 | 2026-08-31 | Started Phase 2 and completed the verified `entity_types` foundation slice with append-only migrations, pgTAP coverage, generated database types, and the first v3 mapper |
| 1.2 | 2026-08-31 | Completed the verified canonical `entities` slice with bounded field validation, same-owner integrity, archive/restore semantics, pgTAP coverage, regenerated database types, and the entity mapper |
| 1.3 | 2026-08-31 | Completed Phase 2 with commitments, immutable activity, proposal approval atomicity, idempotent RPC-only writes, bounded derived reads, weekly targets, generated types, full mappers, and passing database/application verification |
| 1.4 | 2026-08-31 | Completed Phase 3 with v2 type schemas, idempotent legacy backfill, stable source maps, commitment/date conversion, idea preservation, migration provenance, Calendar relinking, compatibility reports/exports, and passing database/application verification |
| 1.5 | 2026-08-31 | Started Phase 4 with the responsive Gazette shell, persisted day/night editions, modal and navigation accessibility coverage, route-wide narrow viewport checks, and passing browser validation; first-viewport product summary and broader stress coverage remain open |
| 1.6 | 2026-08-31 | Completed Phase 4 with the approved weekly application/contact summary, first-viewport verification, empty/large-value stress coverage, and 10 passing browser tests; Phase 5 is next |
| 1.7 | 2026-08-31 | Deployed the verified Phase 0–4 frontend working tree to the Vercel production alias; homepage and PWA manifest returned 200, while production database migrations, data, and Supabase functions remained untouched |
| 1.8 | 2026-09-01 | Started Phase 5 with the client-side v3 data-model and versioned-cache foundation as the first controlled slice; routes remain on the legacy compatibility payload until the new boundary is verified |
| 1.9 | 2026-09-01 | Completed the first Phase 5 slice with the canonical client aggregate, deterministic demo projection, non-destructive versioned-cache migration, bounded canonical aggregate reads, and passing unit/type/build/browser regression checks |
| 2.0 | 2026-09-01 | Completed Phase 5 with canonical registry-driven Today, Due, Browse, Item, Capture/Edit, Schedule, Outcome, archive/restore, drafts, legacy-route mapping, and passing unit/type/build/mobile browser verification; Phase 6 is next |
| 2.1 | 2026-09-01 | Started Phase 6 after committing and pushing Phase 5 (`a3552ac`) to the GitHub-triggered Vercel deployment; the first slice replaces the MCP contract foundation locally without deploying database or Edge Function changes |
| 2.2 | 2026-09-01 | Completed the first local Phase 6 MCP-contract slice: the public surface is the approved five generic tools and `command_describe_types` reads active registry schemas; added contract/repository tests. Fixed CI to install Chromium rather than WebKit, matching the configured Playwright browser, and pushed the fix as `e1b6676` for deployment verification |
| 2.3 | 2026-09-01 | Corrected the Phase 5 live-mode claim after production exposed the missing `public.entity_types` cutover dependency; restored the public Vercel alias to the compatible Phase 4 deployment from `e2d5d15` and left production database/functions/data unchanged |
| 2.4 | 2026-09-01 | Reopened Phase 5 for an evidence-backed correction pass, paused the partial Phase 6 slice, and moved ongoing work to `command-v3` so production remains pinned safely to Phase 4 |
| 2.5 | 2026-09-01 | Completed the Phase 5 correction pass with wired paged reads, timestamp sorting, event-consistent weekly outcomes, transactional capture, restored responsive/large-data coverage, corrected deployment documentation, and passing unit/type/build/browser/database verification; resumed Phase 6 |
| 2.6 | 2026-09-02 | Completed Phase 6 with five registry-aware MCP tools, schema-valid idempotent proposals, owner/client application permissions, OAuth database/RPC/Calendar isolation, Agent inbox review, source/client provenance, visibility and post-decision refresh, append-only migrations `0026`–`0032`, and passing unit/type/build/browser/database/lint verification; Phase 7 Week work is next |
| 2.7 | 2026-09-02 | Completed the first Phase 7 slice with a responsive Week route backed by the bounded `get_v3_week` contract, India-local Monday–Sunday execution, three practice budgets, 15/2 outcomes, pending future days, proposal and commitment outcomes, empty-state coverage, and no database migration; Run-marker filters and targets are next |
| 2.8 | 2026-09-02 | Defined and implemented the five Run markers at targets 3/24/10/25%/12, added bounded owner-scoped migration `0033`, rendered honest three-completed-month or insufficient-history states at `/#/run`, kept the monthly review under More, and added application/database/mobile-browser coverage; the existing recall schedule is the next behaviour-plugin slice |
| 2.9 | 2026-09-02 | Completed Phase 7 with the allow-listed behaviour-plugin contract and adjustable atomic recall follow-ons, registry/target/integration settings, canonical dynamic exports, manual server-mapped commitment Calendar export, AES-256-GCM token storage, append-only migrations `0034`–`0037`, and full application/browser/database/edge verification; Phase 8 remains unstarted pending explicit production-cutover authorization |
| 3.0 | 2026-09-03 | Completed Phase 8 preparation without starting the phase: added the exact encrypted-export/cutover/smoke/fix-forward runbook, split the backend workflow into SHA-pinned migration and function stages, and added transactional preflight/backfill verification SQL; production remains untouched pending explicit authorization |
