# Command

A quiet, mobile-first personal operating dashboard. The current build is a functional local prototype of the daily instrument described in the three source documents in this repository.

## Run it

```bash
npm install
npm run dev
```

Production and verification:

```bash
npm run build
npm test
```

## Implemented in this slice

- Four derived bindu states for today's Node, DSA, Math, and job-hunt floors.
- A fast daily log sheet with habits, diet, minutes, and a short note.
- Monday–Sunday totals against the 7h / 14h / 7h / 7h weekly budgets.
- Closing application windows, active applications, people due, and active work.
- Recall-first learning review with the specified 21 / 7 / 3 / 1 day intervals.
- Responsive desktop and phone layouts, manifest, service worker, and exportable SVG assets.
- Local browser persistence behind a single data hook, ready to replace with Supabase queries.

The first visit is seeded with clearly fictional prototype records so every state is visible. Edits are stored only in that browser under `command.prototype.v1`.

## Next build boundary

The next vertical slice is the secure data core: Supabase migrations, Google owner authentication, Row Level Security, and replacing local persistence with typed queries. Google Calendar and Drive remain later integrations, as specified.
