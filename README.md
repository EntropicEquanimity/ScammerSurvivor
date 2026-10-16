# Scammer Survivor

A practice phone for spotting scams, for anyone in the JAPAC region. Built for AI Builder Cup 2026 (Google Cloud JAPAC, Hack2skill), theme 1: banking, finance and fraud.

Scammer Survivor puts you on your own phone for a day: messages arrive in made-up apps that follow the layouts people in your country use, some from scammers and some from people you named, and you act on each one instead of labelling it. Every scam has a real twin of the same kind, so you are scored twice: scams caught and real messages trusted. You tap the parts of the message that gave it away, a practice caller talks back when you push, and if you slip, the next screen is the recovery, not a game over.

Live: https://scammer-survivor-713399259482.asia-southeast1.run.app

Video: [link to be added by the Deck lead]

Contact: team email: to be added by the Deck lead

Everything inside the phone is practice. The label "Practice. Not a real message." is on every screen. No real money, accounts, brands or people.

## How to play in 30 seconds

1. Open the live link on your phone. The country comes from your clock; change it on the lock screen if it is wrong.
2. Say whether you are 18 or older. Under 18 plays reviewed cards only, with no call.
3. Swipe up. Pick the people on your phone (Mom, Dad, Boss and so on) from name chips, or skip.
4. Tap the notification. Read the message. Press a button: reply, ignore, block and report, call their usual number, or the thing the message asks for.
5. Tap what you noticed. Read the lesson. The day ends on a ledger, one row per sender.

Quick day: two cards, from reviewed cards only. Full day: four cards and the practice call. To play with others, open About and start a room; the link you share seats everyone in the same day.

## How it is built

One Cloud Run service in asia-southeast1 (one instance): Node 24 and Express serving a Vite React app and `/api`. TypeScript runs directly under Node.

| Agent | Model | Job |
|---|---|---|
| Director | `gemini-3.8-flash`, structured output | Writes one card with its real twin from an approved pattern note and the people you picked |
| Guard | code, no model | 13 checks on every Director draft: tells on the ask parts, planted tells match, no digit runs, masked numbers, distinct last four, twin carries no tells, twin has an acceptable reply, allowed replies, invented link hosts checked unregistered over RDAP at write time and again before each deploy, no real brand, allowed names, a non-empty ask, known tell ids |
| Coach | `gemini-3.8-flash`, streamed | Writes the lesson after code has scored the slot; never scores |
| Caller | `gemini-3.8-flash-tts` ahead of time, `gemini-3.8-flash` at play time | The six beats of each practice call are written and voiced before any call (`scripts/tts-beats.ts`); at play time the model picks which beat answers your button, from ids and roles only, and code moves the meter |

A 503 from the first model tries `gemini-3.6-flash` once, through the same Guard, then serves the reviewed cache. Model ids live in `server/gemini.ts` and nowhere else.

Google Cloud: Cloud Run (the service), Vertex AI through `@google/genai` in enterprise mode on the global route (the service account signs; no key in the image), Firestore (the card cache, the call beats, the room and About counters), Cloud Storage (the beat audio), Secret Manager (the `GEMINI_API_KEY` used only by the Developer API fallback route).

Room mode (`#room`): a facilitator opens a room and shares one link; everyone plays the same seeded day on their own phones; the board shows who fell for which tell as ids and counts; the Coach writes the group debrief. About (`#/about`) shows the agents, the services, a live counter of days played and the Director reliability report.

Designed, not in this build: Scout (reads advisories and drafts notes), Translator (part-by-part translation of approved cards), the live voice caller (`gemini-3.8-live`, only after kill test A passes).

## The honest section

- Generated ahead of time and reviewed: the cards in the cache. `scripts/pregenerate.ts` runs every approved pattern note through the Director and the Guard for all eight country packs; every card lands unapproved and a person approves it before it can be dealt. The practice-call beats are written and voiced the same way.
- Live at play time: the Director rewrites cards two to four of a full day around the people you picked while card one plays; the Guard checks each one; the Coach streams the lesson; the Caller picks the next beat from the pregenerated set. The call needs beats loaded by `tts-beats`; without them the browser skips the call. The trace drawer shows each step with its model id, latency, token counts and verdict, ids only.
- The Judge Lab (`#/lab`) generates one card live from a chip-picked country, trick and person, shows the Guard's pass-or-fail table and reveals the tells. Six live cards an hour per phone (`server/routes/lab.ts`).
- The Guard is code. It never calls a model. The Director gets one repair turn with the Guard's reasons; a draft that still fails is dropped and the cache is served.
- Gemini never decides a score. `shared/score.ts` does, as a pure function with tests. The answer key stays on the server until you act.
- No typed input. There is no `<input>` or `<textarea>` in the app and `npm run check` greps for them. Nothing is generated from anything a player wrote, because nothing can be written. On the call you press buttons; there is no microphone in this build.
- Under 18 and the quick day never reach a model. Cache only.
- What the app stores: your age group, country and chosen people chips on your device; the day in server memory under a random id for the length of the day; cards and beats in Firestore; room boards and the About counter as ids, counts and verdicts only, mirrored to Firestore; logs carry ids and counts only, never message text.
- Made-up apps only (`shared/brands.ts`). Layout conventions of real apps, invented names, original marks, none of the real colours. Fake links are plain text.
- The repo holds the tell taxonomy (`shared/taxonomy.ts`: nine tells, ten categories) and pattern notes (`content/notes/`, 16 of them). Never a ready-to-send scam message. Generated cards live only in Firestore.

Playtest figures: to be filled from the playtest sheet.

## Run it locally

```
npm ci
```

Create `.env` in the repo root:

```
GEMINI_ROUTE=developer
GEMINI_API_KEY=your key
CARD_CACHE=file
```

Then:

```
npm run dev
```

`GEMINI_ROUTE=developer` uses the Developer API with your key. Unset, the server takes the Vertex route and expects `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION` and default credentials. `CARD_CACHE=file` keeps cards in `output/cache/` instead of Firestore; `output/` is not tracked.

Gates: `npm test`, `npm run check` (the policy grep), `npm run build`.

## Scripts

| Script | What it does |
|---|---|
| `node scripts/pregenerate.ts [--country SG] [--limit 4] [--dry]` | Fills the card cache: every pack times every approved note, through the Director and the Guard. Prints ids and counts only |
| `node scripts/tts-beats.ts [--limit N] [--dry]` | Writes and voices the practice-call beats, uploads the audio, stores the beats |
| `node scripts/approve-cache.ts [--dry]` | Marks cached cards approved where their pattern note is approved |
| `node scripts/probe-gemini.ts` | One tiny model call on whichever route the environment selects; proves a deploy |
| `node scripts/eval-director.ts [--n 50] [--country SG] [--seed 1] [--dry]` | The Director reliability report: seeded generations through generate, Guard, repair, Guard, no cache writes; writes counts, latencies, tokens and Guard rule ids to `web/public/eval.json` for the About page |

## Docs

- `AGENTS.md`: the rules that never bend, the stack, the layout
- `docs/cup-runbook.md`: the one list to work from until submission
- `docs/prd.md`: the problem with sources, the game loop, the competitors
- `docs/kill-test.md` and `docs/kill-test-b-2026-10-16.md`: the model tests and the play of Google's own game
- `docs/compliance.md`: every policy rule with its source
- `docs/hotlines.md`: what the official pages say for each country
- `docs/deck-draft.md`, `docs/video-script.md`: the submission words
- `docs/google-setup.md`: every Google product, step by step
- `server/agents/README.md`, `server/guard/README.md`, `scripts/README.md`, `content/README.md`

## Team

Four people, by role: Builder (code, deploy, kill tests), Deck lead (deck and video), Content lead (pattern notes and the card review), Playtest lead (the playtest sheet and its numbers).

## Licence

MIT. Copyright (c) 2026 EntropicEquanimity. See `LICENSE`.
