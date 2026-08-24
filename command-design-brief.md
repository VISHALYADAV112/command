# COMMAND — Dashboard Design Brief
### For Claude Design · upload this file and send the prompt in Section 0

---

## 0. THE PROMPT TO SEND WITH THIS FILE

> I've attached a design brief for a personal dashboard called Command. It will be rebuilt in Notion afterwards, so read Section 2 carefully — Notion allows almost no typographic or colour control, and the parts that can't be built natively have to be delivered as image assets instead.
>
> Before designing, tell me your read on the constraint boundary: which elements in Section 5 you think are natively buildable in Notion, which need to be image assets, and which should be dropped as untranslatable. Then design the full-fidelity version.
>
> Deliverables in Section 3. Ask me anything ambiguous before starting.

---

## 1. WHAT THIS IS

A single-page personal dashboard, opened twice a day by one person:

- **5:30 AM** — must show what to do today, readable in under two seconds
- **Late evening** — a two-minute log of hours and habits

The user is a fresher in AI/ML in India, working toward a high-paying software role over the next 8–10 months. The dashboard tracks four daily practice floors, a weekly hour budget, a job-application pipeline, and a review queue.

**It is not a productivity app.** It is closer to an instrument: something looked at every morning that says one thing clearly. Most of the design work is subtraction.

---

## 2. THE HARD CONSTRAINT — WHAT NOTION ACTUALLY ALLOWS

Read this before designing. It defines what survives translation.

### What Notion does NOT allow

| Cannot | Detail |
|---|---|
| Custom fonts | Three options only: Default sans, Serif, Mono. No uploads. Set per page under ••• → Style |
| Custom font sizes | No size control. Only heading levels H1/H2/H3 and a page-wide *Small text* toggle |
| Custom hex colours | Text and background colours come from Notion's fixed palette only. `#D4A03C` is not available |
| Text alignment | No native alignment. Workaround is an empty column beside the content |
| Custom dividers | One divider block, no colour or weight control |
| Custom spacing | No margin, padding, or line-height control. Empty blocks are the only spacer |
| Mobile styling | Font and style settings are unavailable in the mobile app |

### What Notion DOES allow

| Can | Use it for |
|---|---|
| **Custom uploaded images** — page cover, page icons, database row icons, inline image blocks | This is the primary escape hatch. Anything visually specific must ship as an asset |
| Native columns | Block-menu columns, and they nest inside callouts, toggles, and buttons |
| Callouts | Fixed palette background, custom uploaded icon |
| Full-width toggle | Controls page margins |
| Database view config | Table, board, gallery. Property show/hide. Column sums. Board colours inherit from a select property |
| LaTeX blocks (`/math`) | Renders typography Notion's text blocks cannot. Useful for glyphs and marks |
| Side peek / centre peek | Row-open behaviour |

### The design consequence

**Do not design a mockup that depends on typography or colour precision.** It will not survive.

Instead, split the design into two layers:

- **Layer A — structure.** Built natively: columns, callouts, database views, dividers, headings, spacing via empty blocks. This must work with Notion's default sans and fixed palette.
- **Layer B — assets.** Everything visually specific, delivered as exportable images: the bindu marks, gate glyphs, section dividers, database icons, page cover.

A good design here is one where **Layer A alone is already coherent**, and Layer B raises it. If the design collapses without the assets, it is the wrong design.

---

## 3. DELIVERABLES

1. **Constraint read** — your assessment of what's native, what's an asset, what should be dropped. Before designing.
2. **Full-fidelity mockup** — desktop, the ideal version, unconstrained.
3. **Notion-feasible mockup** — the same design using only Notion's real capabilities, with assets placed where they'd go.
4. **Mobile view** — ~380px, single column.
5. **Asset set**, exportable as individual images:
   - Bindu marks: 4 states (filled / hollow), small, high-contrast
   - Gate glyph: one open square mark, for section labels
   - Divider: a thin double-rule image, 3 widths
   - Database icons: 6 — Daily Log, Learning, Job Hunt, People, Projects, Ideas
   - Page cover: wide, very dark, minimal
6. **Delta note** — what was lost between deliverables 2 and 3, so the gap is a decision rather than a surprise.

---

## 4. THE ORGANISING IDEA

A yantra is not a picture. It is an instrument arranged so attention moves between an invariant centre and a contingent outer field. This dashboard is built on that principle **structurally** — not as ornament applied afterwards.

Each symbol below is used because the traditional meaning describes what that part of the dashboard actually does. Where a mapping would have to be stretched, it was dropped.

**The traversal.** A yantra is read inward, from the outer gates to the bindu. A page is read downward. These reconcile by inverting:

> **Scroll depth equals distance from the centre.**

Top of page = invariant, fully controlled, true every day. Scrolling moves outward into the contingent. This is also exactly progressive disclosure and inverted-pyramid hierarchy — both traditions agree, so the layout obeys them simultaneously.

| Zone | Symbol | Contains | Nature |
|---|---|---|---|
| 0 · Centre | **Bindu** — the origin point | Today, as four dots | Invariant |
| 1 · Gates | **Bhupura** — the four cardinal gates | The four daily floors | Invariant |
| 2 · Inner field | **Kolam** — threshold drawing, redrawn daily | This week's log and sums | Recent, self-made |
| 3 · Outer field | **Vairagya** — non-attachment to results | Job hunt, work, people | Contingent |
| 4 · Beyond | **Beeja** — the dormant seed | Ideas, off-page entirely | Potential |

Ideas being unreachable from the dashboard is deliberate. Seeds are stored, not forced.

**Why kolam is exact, not decorative:** a kolam is drawn at the threshold, before sunrise, daily, in one continuous line, and erased and redrawn tomorrow. The Daily Log is opened at dawn, marks the threshold of the day, is one row, and is superseded the next day. Same object, different medium.

---

## 5. THE DESIGN

### 5.1 Grid

**9-column grid**, after the vastu purusha mandala's nine-part division. The **centre column stays empty** — in the mandala the central zone is never built upon. Here it becomes the gutter: the two-column split in Zone 3 is 4 / void / 4.

Vertical rhythm on an 8px base, zone separations at 3×. Zones separated by space, never by boxes.

*Notion note:* native columns can approximate 4/1/4 with a narrow empty middle column.

### 5.2 Colour — temperature as meaning

> **Warm equals what you control. Cool equals what you do not.**

This encodes vairagya directly. The learning block glows; the job hunt does not. In a month when nothing is converting, the page says the right thing without a word of copy.

| Role | Ideal | Notion fallback |
|---|---|---|
| Ground | `#0E0E10` lamp black | Dark mode default |
| Accent — warm | `#D4A03C` turmeric | Notion **yellow** / **orange** text |
| Outer — cool | `#2B3A67` indigo | Notion **blue** or **gray** |
| Alert | `#A8452F` red ochre | Notion **red**, used almost never |
| Text | `#EDEAE4` | Default |
| Muted | `#8A867E` | Notion **gray** |

Turmeric appears **only in Zones 0 and 1**. Once the eye learns gold means *within your control*, hierarchy needs no explanation. Six colours total, and one of them is nearly unused.

### 5.3 Zone by zone

**Zone 0 — Bindu.** Four dots in a row, centred, above everything. Filled when a floor is met, hollow when not. ~10px, generously spaced. The entire status of the day as four points. No numbers, no labels, no percentages. A complete day is four filled dots and nothing else.

*Notion:* ships as image assets, or as callout icons.

**Zone 1 — Four gates.** The floors, set as four entries rather than a sentence. Each behind a small open square gate-mark. Static text: `Node 30m · DSA 1h · Math 30m · Job 1h`, with one muted line beneath: *floors first, then follow interest.*

*Notion:* a callout with a custom icon, or four narrow columns.

**Zone 2 — Kolam.** The week's table. Background carries a **very faint dot grid at ~4% opacity** — the kolam's pulli — the only texture on the page. The four column sums are the **largest type after the title**; they are the signal. Sums in turmeric, budget line beneath in muted text.

*Notion:* database table view with column sums enabled. The dot grid is not natively possible — either an image block above the table, or dropped.

**Zone 3 — Outer field.** Two columns, 4 / void / 4. Job hunt left, work right. Status pills indigo, low saturation, small. A **Closing soon** view sits above active applications and is the only element permitted red ochre — muhurta, the moment that must be acted on. Usually empty; when it isn't, it outranks the page.

**Zone 4 — Review queue.** Bottom. Smriti — what is retained rather than merely heard. A short list and a due count. Muted throughout; quiet by design.

**Dividers.** Thin double rules at ~15% opacity, after manuscript ruling. Inset to the grid, never full-width.

*Notion:* image assets. The native divider is a single full-width rule.

### 5.4 Typography

One sans-serif family. Devanagari **only** where it carries meaning — one word, as the page title, at most. Never as texture, never as a border, never behind content.

- Title: large, low weight, generous letter-spacing
- Zone labels: ~11px, uppercase, letter-spaced, 50% opacity, inside a gate-mark
- Sums: the largest numerals on the page
- Body: comfortable, high line-height

*Notion:* only three fonts and no size control. Hierarchy must come from heading levels and colour, not type size. Design accordingly.

---

## 6. MODERN PRINCIPLES THIS ALSO OBEYS

Stated so the design stands on either tradition alone:

- **Data-ink ratio** — no ornament, no chrome, no decorative fill
- **Progressive disclosure** — zones reveal outward as needed
- **Single accent discipline** — one hue carries all emphasis
- **Semantic colour** — hue means something fixed, never mood
- **Thumb-zone priority** — the two daily actions sit at the top of the scroll
- **Whitespace as structure** — separation by space, not borders

---

## 7. PROHIBITED

Gold gradients. Paisley or floral borders. Ornamental frames. Marigold-orange fields. Devanagari as decoration. Mandala graphics pasted as background images. Drop shadows, glows, progress rings, glassmorphism. Any second accent colour. Anything that reads as a template marketplace product.

**The rule: geometry yes, ornament no.** If an element carries no information or structure, remove it.

---

## 8. MOBILE

Stacks to single column at ~380px. The 4/void/4 split collapses to stacked full-width; the void becomes vertical space. **Zones 0 and 1 must be fully visible without scrolling on a small phone** — that is the entire 5:30 AM interaction. Everything below is optional.

---

## 9. SUCCESS TEST

1. At 5:30 AM, four dots answer *what is my status* in under two seconds.
2. Nothing on the page is decorative.
3. Layer A alone — no assets — is still coherent and calm.
4. Someone who knows the symbolism sees why each one is there. Someone who doesn't sees a clean dashboard.
