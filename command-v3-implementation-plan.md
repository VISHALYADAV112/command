# COMMAND v3 — Living Implementation Plan

**Status:** Approved
**Plan version:** 1.7
**Created:** 2026-08-30
**Last updated:** 2026-08-31
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
| 5. Build the core v3 product workflows | **Not started** | Today, Due, Browse, Item, and overlays work end to end |
| 6. Rebuild MCP and agent review | **Not started** | Dynamic tools, scopes, approval, and provenance pass |
| 7. Add review, readiness, export, and integrations | **Not started** | Week, Run, settings, export, and Calendar rules work |
| 8. Cut over, harden, and retire legacy paths | **Not started** | Production smoke tests and final completion gate pass |

**Active phase:** None. Phase 4 is complete; Phase 5 is next.
**Current blocker:** None.
**Repository state:** Phases 0–4 are complete. The repo-native Gazette shell has shared tokens, persisted day/night edition, responsive header/navigation, modal focus behavior, a date-scoped weekly application/contact summary, route-wide 380px overflow coverage, empty/large-value stress coverage, and browser-width tests. The current frontend is deployed to the Vercel production alias; no production database migration, Supabase function deployment, or production-data change was performed.
**Next slice:** Begin Phase 5 by replacing fixed `CommandData` arrays with the v3 model and versioning demo/local-cache data. Keep the Phase 5 Today migration aligned with the approved three practice floors, exception-first overdue behavior, weekly 15/2 targets, and the deferred Calendar route. Migrations `0001`–`0019` remain unchanged; Phase 3 uses append-only `0020`–`0024`.

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

This section is the user-visible and operational feature checklist. A checked feature must work in live mode, not only in the prototype.

### 8.1 Today

- [ ] Dynamic date and India timezone dateline.
- [ ] Optional urgent/overdue lead story.
- [ ] Node, DSA, and Math floor status with values and targets.
- [ ] Weekly submitted-application progress against 15 and new-people-contacted progress against 2.
- [ ] Short unified open commitment queue.
- [ ] Record Outcome from a queue row.
- [ ] Open the owning Item.
- [ ] Global daily Log action.
- [ ] Agent inbox indicator only when proposals are pending.
- [ ] Calm nothing-due state.
- [ ] Seven-day execution strip only if it does not harm the first-viewport goal.

### 8.2 Due

- [ ] One queue across all entity types.
- [ ] Overdue, Today, This week, and All windows.
- [ ] Type filter populated from the registry.
- [ ] Stable due-date ordering with overdue first.
- [ ] Record Outcome without navigation.
- [ ] Link to universal Item.
- [ ] Distinct unfiltered-empty and filtered-empty states.
- [ ] Bounded reads and pagination or virtualisation.

### 8.3 Browse

- [ ] One route for every registered type.
- [ ] Unknown-type state with link to Settings.
- [ ] Registry-driven columns.
- [ ] Registry-driven filters and default sort.
- [ ] Text search with bounded results.
- [ ] Item and open-commitment counts.
- [ ] Capture preselected to the current type.
- [ ] Empty-type state.
- [ ] Last-used or explicit type selection on mobile Browse.

### 8.4 Item

- [ ] Universal detail page for every type.
- [ ] Type, title, reference, and creation metadata.
- [ ] Every registered field rendered, including unset fields.
- [ ] Edit entity.
- [ ] Add or reschedule a commitment.
- [ ] Open and closed commitment history.
- [ ] Record outcomes.
- [ ] Provenance timeline with source and client where applicable.
- [ ] Archive and restore.
- [ ] Read-only archived state.
- [ ] Indistinguishable not-found/not-owned state.

### 8.5 Week

- [ ] Monday–Sunday boundaries in `Asia/Kolkata`.
- [ ] Three practice totals against weekly budgets.
- [ ] Weekly submitted applications and new people contacted against their targets.
- [ ] Seven-day table with future days shown as pending, not zero.
- [ ] Application/pipeline movement this week.
- [ ] Agent proposal activity: proposed, approved, rejected.
- [ ] Commitments completed, cancelled, and missed.
- [ ] Empty-week structure.

### 8.6 Run

- [ ] Public portfolio projects against target three.
- [ ] DSA patterns covered/mastered.
- [ ] Mock interviews completed.
- [ ] Precisely defined application conversion marker, with final Phase 7 filters using canonical activity history.
- [ ] Referral conversations held.
- [ ] Current value, target, and trailing trend.
- [ ] Insufficient-history state without a misleading trend.
- [ ] Monthly, not daily, prominence.

### 8.7 Settings

- [ ] Targets with explanation that historical status is derived from current targets.
- [ ] Type registry list.
- [ ] Create and edit data-only types.
- [ ] Version and validate schemas.
- [ ] Mark list-visible and filterable fields.
- [ ] Configure allowed commitment kinds and defaults.
- [ ] Disable a type without deleting records.
- [ ] Google Calendar connect, disconnect, and last-sync state.
- [ ] Connected MCP clients, scopes, last activity, and revocation.
- [ ] Agent audit/provenance access.
- [ ] JSON export.
- [ ] Per-type CSV export.
- [ ] Theme selection.

### 8.8 Capture, Log, Outcome, and drafts

- [ ] Global Capture available on every route.
- [ ] Registry-generated forms with labels, types, options, and required rules.
- [ ] Optional first commitment during Capture.
- [ ] Edit reuses the same schema form.
- [ ] Daily Log remains under two minutes.
- [ ] Outcome records what happened rather than only a done flag.
- [ ] Plugin may propose the next commitment after an outcome.
- [ ] User sees and can adjust a computed next date before saving when appropriate.
- [ ] Unsaved drafts survive overlay dismissal, save failure, and connection loss.
- [ ] Successful saves clear only the submitted draft.

### 8.9 Agent and MCP

- [ ] `command_describe_types` returns allowed types, schemas, and commitment kinds.
- [ ] `command_capture` creates a validated pending proposal.
- [ ] `command_complete` proposes or applies an outcome according to client trust policy.
- [ ] `command_schedule` proposes or applies a schedule change according to client trust policy.
- [ ] `command_query` supports constrained type, due-window, and text filters.
- [ ] No arbitrary SQL or unbounded query language.
- [ ] Server validates against the current registry schema.
- [ ] Idempotent retries return the existing proposal/result and never overwrite UI edits.
- [ ] Read and write scopes are separate and narrow.
- [ ] Sensitive people fields are excluded from broad/default query scopes.
- [ ] Tool calls remain rate-limited and privately audited.
- [ ] Pending proposals never appear in Browse or Due.
- [ ] Approve, edit-and-approve, reject, and expire paths work.
- [ ] Calendar/external side effects require their own explicit scope and review policy.

### 8.10 Platform behaviour

- [ ] Google owner-only authentication.
- [ ] OAuth consent for MCP clients.
- [ ] Google Calendar token encryption and revocation.
- [ ] PWA install and service worker update prompt.
- [ ] Update prompt never clears an active form.
- [ ] Cached reads and visible staleness state.
- [ ] Offline writes refused explicitly.
- [x] Visibility refresh after MCP or Calendar writes.
- [ ] Versioned local cache that cannot load incompatible v2 shapes as v3.
- [ ] Demo mode follows the same v3 model as live mode.
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
- The transactional edit-and-approve data contract is defined; its review UI and draft interaction still need Phase 6 design.
- Outcome vocabulary and allowed outcomes per commitment kind are not defined.
- Draft lifetime, expiry, and cross-device behaviour are not defined.
- Archive/search behaviour for archived records is not defined.
- No mobile wireframes exist for Due, Browse, Item, Week, Run, or Settings.

### Data and domain gaps

- Registry schema format, supported field kinds, bounds, key permanence, deprecation, and version evolution are resolved in Phase 2.
- Commitment transitions are resolved in PLAN-016. Multiple simultaneous commitments are allowed and have stable UUID identity rather than an entity/kind/date uniqueness rule.
- Event immutability, correction-by-append, and idempotency uniqueness are resolved in PLAN-017. Retention and export presentation remain Phase 7 work.
- Final Run filters and targets are deliberately deferred to Phase 7; they must use only canonical entities, commitments, and activity events and cannot change the schema or routes.
- Changing floor and weekly targets intentionally reinterprets derived historical status using current settings; raw logs and events remain unchanged.
- Calendar link migration from domain-specific events to commitments is unspecified.
- Due and readiness reads are bounded in Phase 2; Browse search indexing and pagination remain Phase 5 work.
- Registry deactivation rules and archived-search defaults remain unspecified; field-key and field-change rules are resolved in Section 3.2.

### Security gaps

- Exact MCP scopes and default grants are not defined.
- The storage and administration model for narrowly trusted client/operation/entity-type combinations remains to be defined; the approval boundary is fixed in Section 3.2.
- Registry, entity, activity, and proposal JSON depth/count/size limits are enforced server-side.
- Registry-provided labels/options must be rendered as text, never trusted HTML.
- Same-user referential integrity is enforced for types, entities, commitments, events, proposal targets, and proposal results.
- Proposal approvals use a row lock, target-version precondition, and a single-winner transaction.
- Authenticated canonical writes use security-definer RPCs; users cannot directly insert events or bypass transactional provenance.

### Design-system gaps

- v12 contains no responsive rules and cannot serve as production CSS.
- Repeated masthead behaviour on mobile and secondary routes is unresolved.
- Night-edition colours and contrast have not been accessibility-tested.
- Brahmi glyph use is decorative in places despite the old brief prohibiting script as texture.
- Typography loading, offline font behaviour, and final licensed font assets need confirmation.
- Long titles, long select values, large numbers, and empty data have not been stress-tested.

### Operational gaps

- No exact production cutover procedure exists yet.
- No v2-to-v3 backup and verification report format exists.
- No decision has been made about a maintenance window versus compatibility writes.
- Old bookmarks need a redirect/mapping policy.
- Documentation source-of-truth is inconsistent: current README says Vercel while older design and `AGENTS.md` still mention GitHub Pages.
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
- [x] Define MCP scope and approval policy.
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

**Status:** Not started

Tasks:

- [ ] Replace fixed `CommandData` arrays with the v3 data model.
- [ ] Version the local cache and demo data.
- [ ] Add bounded API loaders for registry, Today, Due, Browse, and Item.
- [ ] Preserve optimistic local updates through generic mutators.
- [ ] Implement Today.
- [ ] Implement Due with URL-backed filters.
- [ ] Implement registry-driven Browse.
- [ ] Implement universal Item.
- [ ] Implement global Capture and Edit.
- [ ] Implement Schedule and Outcome.
- [ ] Adapt Daily Log to the approved three-floor/job metric model.
- [ ] Implement archive and restore.
- [ ] Implement per-overlay draft retention.
- [ ] Redirect or map useful legacy hash routes.
- [ ] Add unit, mapper, API, component, and mobile E2E tests.

Exit gate:

- [ ] A user can capture any seeded type, schedule it, find it in Due/Browse, record an outcome, inspect provenance, and archive/restore it in demo and live modes.

### Phase 6 — Rebuild MCP and agent review

**Status:** Not started

Tasks:

- [ ] Replace seven hardcoded tools with the approved five generic tools.
- [ ] Implement registry discovery.
- [ ] Validate all write payloads server-side against current schema and commitment rules.
- [ ] Route untrusted writes into `agent_proposals`.
- [ ] Enforce per-client read/write/data-class scopes.
- [ ] Add strict query filters, limits, and safe error messages.
- [ ] Make capture, complete, and schedule retries idempotent.
- [ ] Build Agent inbox with approve, edit-and-approve, reject, and expired states.
- [ ] Show source/client provenance on Item.
- [ ] Refresh the browser after proposal decisions and external writes.
- [ ] Preserve OAuth discovery, consent, rate limiting, and private audit.
- [ ] Add tool-contract, repository, authorization, idempotency, and injection-resistance tests.

Exit gate:

- [ ] A newly registered data-only type is discoverable and capturable through MCP without redeployment, while no unapproved proposal appears in primary views.

### Phase 7 — Add review, readiness, export, and integrations

**Status:** Not started

Tasks:

- [ ] Implement Week from derived data.
- [ ] Implement the five approved Run markers and insufficient-history states.
- [ ] Port `applyRecall` into the behaviour-plugin contract without changing its tested schedule.
- [ ] Implement plugin-scheduled follow-on commitments through Outcome.
- [ ] Implement Targets and Type registry Settings.
- [ ] Implement Integrations, scopes, clients, revocation, and audit access.
- [ ] Implement dynamic JSON and per-type CSV export.
- [ ] Generalise Calendar event mapping from applications/projects to approved commitment kinds.
- [ ] Preserve Calendar idempotency, unlinking, refresh, and encrypted tokens.
- [ ] Decide whether a Calendar route has earned inclusion; implement only if D-06 changes.
- [ ] Add derived-query, export, plugin, and Calendar tests.

Exit gate:

- [ ] Weekly/monthly review, type administration, export, recall scheduling, and approved Calendar workflows operate without type-specific frontend screens.

### Phase 8 — Cut over, harden, and retire legacy paths

**Status:** Not started

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
- MCP OAuth consent, scope display, and revocation.
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

- [ ] All decisions in Section 3 are resolved and recorded.
- [ ] Every required feature in Section 8 is checked or explicitly deferred with approval.
- [ ] Every missing item in Section 9 is resolved, implemented, or explicitly deferred.
- [ ] Existing production data is migrated and verified with no unexplained loss.
- [ ] A new data-only type works in Settings, Capture, Browse, Item, export, and MCP without deployment.
- [ ] Every dated record uses the unified commitment path.
- [x] An MCP retry cannot overwrite a UI edit.
- [ ] Unapproved agent proposals never enter Browse, Due, Item, or Calendar.
- [ ] Every canonical change shows honest provenance.
- [ ] Existing recall scheduling passes unchanged through the plugin contract.
- [x] The browser refreshes external changes without manual reload.
- [ ] Today is fast and legible at 380px with no horizontal overflow.
- [ ] Every route has loading, empty, error, stale, and offline behaviour.
- [ ] Accessibility requirements pass keyboard and screen-reader-oriented review.
- [ ] RLS and scope tests prevent cross-user or over-broad access.
- [ ] `npm test`, `npx tsc -b`, and `npm run build` pass.
- [ ] Required E2E, database, edge, migration, and production smoke tests pass.
- [ ] README, AGENTS, architecture docs, and deployment instructions describe reality.
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
