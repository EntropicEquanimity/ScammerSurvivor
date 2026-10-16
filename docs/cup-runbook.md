# Cup runbook: 16 to 18 Oct 2026

The one list to work from until submission. Dates here are the Cup's own: deadline 18 Oct, hour not public. People by role: Builder, Deck lead, Content lead, Playtest lead. All four are on the organizer dashboard team. The product is for all of JAPAC: eight country packs carry equal weight, no pack goes first, English only everywhere.

Decided 16 Oct: the hybrid direction (the own-phone solo day as the core, room mode on top). Cut: Translator, Scout, Google sign-in, ADK. Their hours fund the proofs that the AI is live (trace drawer, Judge Lab, reliability report) and the room. The turn-based call with pregenerated TTS beats is the call that ships; the live caller comes only if kill test A passes.

Updated 16 Oct evening: the ticks below are what the repo and the live URL prove, each checked with a tool. A tick means the file or the response was read, not that someone said so.

## A. Disqualifiers (Builder)

Done, each verified with a tool on 16 Oct:

| Done | Item |
|---|---|
| [x] | First commit pushed 16 Oct from the building window. Public repo, Discord poster on `main` posts every push. Fresh code only |
| [x] | Docker image builds locally from the Dockerfile (343 MB) |
| [x] | Cup key confirmed: the Cup project's Tier 1 key, 14 of 14 Director calls completed, no 503. Every earlier 503 ran on a free-tier key from another project. Stored long-term as `GEMINI_API_KEY_CUP`, never in the repo |
| [x] | 22 tests (not verified in the repo) and `npm run check` passed at Run 0, 16 Oct morning; later runs add their own tests. Current count: section F |
| [x] | Rules read: weights 40 / 25 / 25 / 10, team formation closed 14 Oct (not verified in the repo), fresh projects only, Cloud Run or GCP or Firebase deployment, Vertex not required |
| [x] | Deployed. The live URL answers 200 with the app and `/api/packs` lists all eight packs (read over HTTP, 16 Oct evening). Cloud Run asia-southeast1, one instance |

Remaining:

| Done | Item | By |
|---|---|---|
| [ ] | Live check on a real phone: the public URL plays a quick day end to end; Cloud Run logs show ids only. `/api/packs` on the live URL reports `deckReady: false` for every pack, so confirm the live Firestore cache holds approved cards (`scripts/approve-cache.ts`) before this check | Builder, 17 Oct morning |
| [ ] | Deadline hour. Ask on the Cup Discord. Until answered, the internal deadline is noon UTC+8 on 18 Oct | Builder, 16 Oct |
| [ ] | `.gitignore` covers the whole `output/` folder (today only `output/playwright/`) before any generation script writes there. Nothing generated goes into a tracked file | Builder, 16 Oct |
| [ ] | Stay active on the organizer dashboard and Discord. Leaving the dashboard is a disqualifier | Deck lead, daily |
| [ ] | `cup-reviewer` audit before every push and before the submission | Builder, every push |

## B. Kill tests (decide what ships)

| Test | Result 16 Oct | Decision |
|---|---|---|
| A2, Director writes a card, Cup key | Original prompt 0 of 4: isolation and payment_substitution never tagged, US-style numbers, one 22-digit run. Stricter prompt fixed masking but copied the example number. Generate, Guard, one repair turn quoting the Guard's reasons, Guard again: 6 of 6 pass, about 34 s per card | Pass. The Director ships with the repair loop; the Guard is the gate; the reviewed cache is the floor. Ticks in `docs/kill-test.md`, never generated text |
| Capacity, Cup key | 14 of 14 calls, 10 to 13 s each, zero 503 | Earlier 503s were the wrong key, not the model |
| TTS voice | One `gemini-3.8-flash-tts` sample of a practice fraud-desk call: 26.7 s of audio, 9.6 s to generate (no entry in `docs/kill-test.md`; not verified in the repo) | Beats are generated before the call, never during it. The Builder listens and says whether the voice carries the call; the turn-based call ships either way |
| A, voice caller | Not run | Runs in AI Studio with one person on the microphone only when the live caller is on the table (Run 4). Pass: live caller ships. Fail: "coming soon" |
| A3, translation | Not run | Translator cut; English only. The row stays for the record |
| B, play the comparison game | Played 16 Oct to the evening chapter's choice screen (`docs/kill-test-b-2026-10-16.md`). Six rows where ours does something theirs does not; four of them are not "Gemini wrote it". Their first scored decision: 13 clicks, about two minutes | Pass. The deck's solution slide uses three rows: country packs with matching apps, a caller that talks back, real twins with a trust score. Do not claim a lesson after each item or a real message mixed in as unique; theirs has both |

## C. Build runs 0 to 4 (Builder with the coding agent)

One Workflow run per phase: build, review, verify, one agent per file. Every brief carries the pinned strings: model ids with the `gemini-3.6-flash` fallback, the nine tell ids, the reply ids from `shared/types.ts`, rules 1 to 11 as amended, the files allowed, the check. Each run ends with the `cup-reviewer` audit; a failed gate flips to "coming soon" in the app, the deck and the README in the same commit.

What the repo proves on 16 Oct evening, file by file:

| Done | Item | Where |
|---|---|---|
| [x] | First commit, public repo | Section A |
| [x] | Deploy | Live URL 200, `/api/packs` lists eight packs |
| [x] | Director with the repair loop, structured output, `gemini-3.8-flash`, fallback `gemini-3.6-flash` | `server/agents/director.ts`, `server/gemini.ts` |
| [x] | Guard in code, 13 rule ids, tests | `server/guard/card.ts`, `server/routes/lab.ts` |
| [x] | Coach streamed over SSE; younger and quick never reach it; cache on error | `server/agents/coach.ts`, `server/routes/lesson.ts` |
| [x] | Card cache: Firestore on Cloud Run, file locally, approved cards only reach a player | `server/cache.ts`, `scripts/pregenerate.ts`, `scripts/approve-cache.ts` |
| [x] | Call beats job: six beats per approved note, voiced by TTS, uploaded to the audio bucket, read per trick | `scripts/tts-beats.ts`, `server/beats.ts` |
| [x] | Turn-based call: buttons map to beats, code moves the meter, fixed table on a model error | `server/agents/caller.ts`, `server/routes/call.ts`, `web/src/features/call/` |
| [x] | Judge Lab at `#/lab`: live generation from chips, Guard table, tells revealed, six an hour per phone | `server/routes/lab.ts`, `web/src/features/lab/` |
| [x] | Trace drawer: model id, latency, tokens, verdicts, ids only | `server/routes/trace.ts`, `web/src/features/lab/TraceDrawer.tsx` |
| [x] | About route at `#/about` linking the lab, the room and the privacy notice | `web/src/App.tsx` |
| [x] | Art: app marks for the invented apps, the mark, wallpapers, result-card background | `web/public/art/` |
| [x] | Hotlines: seven of eight packs verified at an official page; the Philippines pack shows no number | `docs/hotlines.md`, `content/packs/` |
| [x] | Recovery sequence, per-sender ledger, result card, setup chips | `web/src/features/recovery/`, `web/src/features/day/`, `web/src/features/setup/` |
| [x] | Kill test B played and passed | `docs/kill-test-b-2026-10-16.md` |
| [x] | README, deck draft, video script | `README.md`, `docs/deck-draft.md`, `docs/video-script.md` |
| [x] | Room mode: a facilitator opens a room, one link, the same seeded day on every phone, the board of missed tells as ids and counts, the Coach's group debrief. Appeared in the tree 16 Oct evening | `server/routes/room.ts`, `web/src/features/room/` |
| [x] | Live aggregate counter: days played, the two rates summed, days per country; counts only, mirrored to Firestore `stats/global` | `server/routes/stats.ts` |
| [x] | About page as a feature: agents, services, the counter, the Director reliability report, the honest lines | `web/src/features/about/` |
| [ ] | Reliability report numbers from a recorded run of `scripts/eval-director.ts` (first-try pass rate, after-repair pass rate, latency, fallback rate), on the live About page | Builder, 17 Oct |
| [ ] | Firestore for day state: days and calls are in server memory on one instance | `server/store.ts`, `server/routes/call.ts` |
| [ ] | Live caller | only after kill test A |

The run table, kept for the order of work:

| Done | Run | Contents | Check |
|---|---|---|---|
| [x] | 0, 16 Oct morning, sequential | Repo wired without a force-push, tests and policy check, one commit, push. Cup key into the long-term env. Model-name fix across the docs. This runbook. Cloud Shell deploy of the current build | `npm test` and `npm run check` pass; the live URL answers. Still open from this row: the quick day on a real phone and the logs check (section A) |
| [x] | 1, 16 Oct afternoon, core agents | `server/gemini.ts` (Vertex route by default, `GEMINI_ROUTE=developer` fallback), `server/agents/director.ts` with the repair loop, `server/guard/` as tests first, `server/agents/coach.ts` streamed, `scripts/pregenerate.ts` (reviewed cache for all eight packs), `features/setup/` chips, background personalization, `content/notes/` for the 16 tricks | In the tree. Still open from this row: `server/store.ts` to Firestore (in memory today), the 20-card yield count and the hostile-note check as recorded runs |
| [ ] | 2, 17 Oct morning, the phone | Lesson only on scams, buttons on the card (no sheet), tiles open threads, per-sender ledger, follow-up consequence messages, recovery sequence, e-wallet protections, trace drawer, Judge Lab, turn-based call with pregenerated beats, the synthetic-voice variant disclosed as practice, chat looks per pack | Ledger, recovery, trace drawer, Judge Lab and the turn-based call are in the tree. Open: the rest of the row, then the check: a real message gets one line, a scam gets the lesson; a home tile opens that thread; pay drains the wallet, then freeze and the official number recover part of it; three pushbacks drop the meter, "Read the code" fills it |
| [ ] | 2b, 17 Oct midday, the UI | One agent per staged moment: lock-screen cold open, app zoom, tell stamp, consequence scenes, full-screen call, ledger reveal; design review of screenshots at 390 and 1440 and on a real phone; two type options for the Builder to pick | axe in Playwright: zero violations; reduced motion honoured with cross-fades; the practice tag in each app header and on the lock screen; no hex from the avoid list; no typeface from the ban list |
| [ ] | 3, 17 Oct afternoon, room, proofs, words | Room links and facilitator heatmap, learning delta cards, reliability report script and About panel, aggregate counter, generated art inspected before `web/public/art/`, deck draft with live screenshots, video script, README, hotline verification for all eight countries | Room, the counter, About, art, hotlines, the deck draft, the video script, and the README are in the tree. Open: the room check on two phones (the board shows both; no message text in Firestore room docs), the learning delta on the ledger, the report's numbers from a recorded `eval-director` run (first-try pass rate, after-repair pass rate, latency, fallback rate), live screenshots into the deck |
| [ ] | 4, 17 Oct evening, gates | Live caller only if kill test A passed; kill test B played; Content lead reviews the full cache; playtest round two; freeze at midnight | Kill test B done. Open: `cup-reviewer` clean; `npm test` and `npm run check` pass; "coming soon" reads the same in the app, the deck and the README; after midnight only fixes |

## D. Content (Content lead, Playtest lead)

| Done | Item | By |
|---|---|---|
| [x] | 16 pattern notes in the `PatternNote` shape, country-neutral patterns, in `content/notes/`; the pack supplies the apps, the currency and the hotline. All 16 carry `approved: true` (read 16 Oct evening) | Content lead, 16 Oct |
| [x] | Hotlines for all eight countries: verified at an official page, or absent. Seven verified; the Philippines pack shows no number until an official page is read (`docs/hotlines.md`) | Content lead, 16 Oct |
| [ ] | Every cached card in all eight packs reviewed by the Content lead before the freeze | Content lead, 17 Oct |
| [ ] | Playtest round one: the team plays day one with their own people; the before and after cards give the first learning delta | Playtest lead, 16 Oct evening |
| [ ] | Playtest round two: same players plus two outside the team, in at least two packs; the two rates and the delta in their words, on the playtest sheet | Playtest lead, 17 Oct |

## E. Submission (Deck lead, Playtest lead, Builder)

| Done | Item | By |
|---|---|---|
| [x] | Deck draft (`docs/deck-draft.md`, seven sections in the Cup's order plus a closing slide, every number sourced or tagged "needs source"), the mark (`web/public/art/mark.png`) | Deck lead, 16 Oct |
| [x] | App marks (`web/public/art/`) | Builder, 16 Oct |
| [ ] | Playtest sheet: two rates before and after, per player, per pack. The deck's community slide and closing slide wait on it | Playtest lead, 16 Oct |
| [x] | Video script drafted (`docs/video-script.md`): model named by 0:10, generation moment by 0:30, agent graph by 1:30, the call at 1:40, ledger and result card at 2:10 | Deck lead, 16 Oct |
| [ ] | Video script locked after one dry run on a real phone | Deck lead, 17 Oct |
| [ ] | Record on a real phone from the lock screen, under 2:50, a backup take of the call. Public on YouTube or Drive; link into the README | Deck lead, 18 Oct |
| [ ] | PDF deck from the draft with live screenshots at phone width, practice tag in every screenshot, packs rotated, every "needs source" resolved or cut. Opened once on a phone | Deck lead, 18 Oct |
| [x] | README in English with the live URL, the honest section, the local run, the scripts, the docs index, the team by role, the licence line | Builder, 16 Oct |
| [ ] | README: the video link and the team email (both placeholders today) | Deck lead, 18 Oct |
| [ ] | Submit on the dashboard by noon UTC+8 unless Discord gave a later hour. Open the video link in a private window | Builder, 18 Oct |

## Before each deploy (Builder, added 17 Oct after Skeptic round 5)

Run in this order, from the image of the commit being deployed. A running instance keeps the About total it read at boot, so the reset goes before the deploy. The day route reads the card cache per request, so a held card stops being dealt as soon as the recheck writes it.

1. Reset the About counter, once, before the deploy that judges will see: `GOOGLE_CLOUD_PROJECT=<project> node scripts/reset-stats.ts`. It zeroes `stats/global` (counts only, no player data). The About page hides the aggregate until 50 real days are recorded (`DISPLAY_FROM` in `server/routes/stats.ts`), so test traffic never shows. Run it again only if test traffic lands after it.
2. Recheck every cached link domain: the Cloud Run job `recheck-domains` runs `node scripts/recheck-domains.ts`. It asks RDAP again for every domain on every cached card (the `domains` field plus any host in the card's text); a card whose domain is now registered, or whose check fails, gets `servable: false` and `readCards` never deals it; a card that passes again is cleared. It prints counts per pack and the number held back. `--dry` prints without writing.
   - Create once (not verified against the flags of the existing jobs): `gcloud run jobs deploy recheck-domains --image <image of the commit> --region asia-southeast1 --command node --args scripts/recheck-domains.ts --set-env-vars GOOGLE_CLOUD_PROJECT=<project> --max-retries 0 --task-timeout 15m`
   - Run before each deploy: `gcloud run jobs execute recheck-domains --region asia-southeast1 --wait`, then read the job log. If the held-back count leaves a pack short of a full day, the deal falls back to that pack's fixtures (`server/routes/deck.ts` cardsFor); regenerate before the deploy.
3. Deploy from a clean worktree of the commit.

## F. Automations already in place, and what runs them

- `npm test` and `npm run check` are the gate before any commit and any deploy. The coding agent runs both before calling a run done. The policy grep covers `shared`, `server`, `web`, `content` and the config files; it does not scan `docs/` or the README, so the words there get their own em dash and banned-word grep before a push. Last run 16 Oct evening: 119 tests, 119 pass; policy check passes; `npm run build` passes. One earlier run in the same hour failed `server/routes/room.test.ts` (the debrief fallback assertion at line 175) while that file and `server/routes/room.ts` were mid-edit by another run; it passed once the edit landed.
- The `policy-reviewer` agent runs on every diff under `content/`, `server/agents/`, `server/guard/` or `web/`.
- The `scenario-author` agent drafts pattern notes; the Content lead approves each one.
- The `cup-reviewer` agent audits the tree against sections A and E before every push and the submission. It reports the gates it can see from code and lists the rest as reminders.
- The Discord poster on `main` posts every push to the team channel.
- Workflow runs carry the pinned strings in every brief; a reviewer agent checks each slice against its check.
- Cloud Scheduler is cut with Scout.

## Not verified, said as such

The deadline hour; TTS and live quality against other vendors; live API behaviour under pushback (kill test A); money-lock and cooling-off specifics at bank pages; the Philippines hotline; the effect sizes cited for inoculation games; the availability of the Deck lead and the Playtest lead on 18 Oct (if neither, the Builder records the screen and the deck is the outline filled with live screenshots).

Seen on 16 Oct evening and not yet resolved: the live `/api/packs` reports `deckReady: false` for every pack (whether the live Firestore cache holds approved cards is not verified); `docs/google-setup.md` sets `GOOGLE_CLOUD_LOCATION=asia-southeast1` while the pinned stack says the Vertex global route (which one the live service runs is not verified); `web/src/strings.ts` still carries a hotline number for the Philippines that `docs/hotlines.md` could not verify (owner: whoever holds `web/src/strings.ts`; the lesson copy should read the pack's hotline instead).
