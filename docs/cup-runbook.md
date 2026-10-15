# Cup runbook: 16 to 18 Oct 2026

The one list to work from until submission. Dates here are the Cup's own: deadline 18 Oct, hour not public. People by role: Builder, Deck lead, Content lead, Playtest lead. All four are on the organizer dashboard team. The product is for all of JAPAC: eight country packs carry equal weight, no pack goes first, English only everywhere.

Decided 16 Oct: the hybrid direction (the own-phone solo day as the core, room mode on top). Cut: Translator, Scout, Google sign-in, ADK. Their hours fund the proofs that the AI is live (trace drawer, Judge Lab, reliability report) and the room. The turn-based call with pregenerated TTS beats is the call that ships; the live caller comes only if kill test A passes.

## A. Disqualifiers (Builder)

Done, each verified with a tool on 16 Oct:

| Done | Item |
|---|---|
| [x] | First commit pushed 16 Oct from the building window. Public repo, Discord poster on `main` posts every push. Fresh code only |
| [x] | Docker image builds locally from the Dockerfile (343 MB) |
| [x] | Cup key confirmed: the Cup project's Tier 1 key, 14 of 14 Director calls completed, no 503. Every earlier 503 ran on a free-tier key from another project. Stored long-term as `GEMINI_API_KEY_CUP`, never in the repo |
| [x] | 22 tests and `npm run check` passed at Run 0, 16 Oct morning; later runs add their own tests |
| [x] | Rules read: weights 40 / 25 / 25 / 10, team formation closed 14 Oct, fresh projects only, Cloud Run or GCP or Firebase deployment, Vertex not required |

Remaining:

| Done | Item | By |
|---|---|---|
| [ ] | Deploy. `gcloud` is broken on the Builder's machine; Cloud Shell runs `docs/google-setup.md` step 18. Before it: enable Vertex AI, Cloud Run, Cloud Build, Artifact Registry, Firestore, Secret Manager; Firestore Native in asia-southeast1 and the secret through the Cloud console (never the Firebase console). Check: the public URL plays a quick day on a real phone; Cloud Run logs show ids only | 16 Oct noon |
| [ ] | Deadline hour. Ask on the Cup Discord. Until answered, the internal deadline is noon UTC+8 on 18 Oct | 16 Oct |
| [ ] | `.gitignore` covers the whole `output/` folder (today only `output/playwright/`) before any generation script writes there. Nothing generated goes into a tracked file | 16 Oct |
| [ ] | Stay active on the organizer dashboard and Discord. Leaving the dashboard is a disqualifier | daily |
| [ ] | `cup-reviewer` audit before every push and before the submission | every push |

## B. Kill tests (decide what ships)

| Test | Result 16 Oct | Decision |
|---|---|---|
| A2, Director writes a card, Cup key | Original prompt 0 of 4: isolation and payment_substitution never tagged, US-style numbers, one 22-digit run. Stricter prompt fixed masking but copied the example number. Generate, Guard, one repair turn quoting the Guard's reasons, Guard again: 6 of 6 pass, about 34 s per card | Pass. The Director ships with the repair loop; the Guard is the gate; the reviewed cache is the floor. Ticks in `docs/kill-test.md`, never generated text |
| Capacity, Cup key | 14 of 14 calls, 10 to 13 s each, zero 503 | Earlier 503s were the wrong key, not the model |
| TTS voice | One `gemini-3.8-flash-tts` sample of a practice fraud-desk call: 26.7 s of audio, 9.6 s to generate | Beats are generated before the call, never during it. The Builder listens and says whether the voice carries the call; the turn-based call ships either way |
| A, voice caller | Not run | Runs in AI Studio with one person on the microphone only when the live caller is on the table (Run 4). Pass: live caller ships. Fail: "coming soon" |
| A3, translation | Not run | Translator cut; English only. The row stays for the record |
| B, play the comparison game | Not played yet | Deck lead plays to the end on a phone and a laptop on 17 Oct; pass needs three rows ours does that theirs does not |

## C. Build runs 0 to 4 (Builder with the coding agent)

One Workflow run per phase: build, review, verify, one agent per file. Every brief carries the pinned strings: model ids with the `gemini-3.6-flash` fallback, the nine tell ids, the reply ids from `shared/types.ts`, rules 1 to 11 as amended, the files allowed, the check. Each run ends with the `cup-reviewer` audit; a failed gate flips to "coming soon" in the app, the deck and the README in the same commit.

| Done | Run | Contents | Check |
|---|---|---|---|
| [ ] | 0, 16 Oct morning, sequential | Repo wired without a force-push, tests and policy check, one commit, push. Cup key into the long-term env. Model-name fix across the docs. This runbook. Cloud Shell deploy of the current build | `npm test` and `npm run check` pass; the live URL plays a quick day on a real phone; logs show ids only |
| [ ] | 1, 16 Oct afternoon, core agents | `server/gemini.ts` (Vertex route by default, `GEMINI_ROUTE=developer` fallback), `server/agents/director.ts` with the repair loop, `server/guard/` as tests first, `server/agents/coach.ts` streamed, `server/store.ts` to Firestore, `scripts/pregenerate.ts` (reviewed cache for all eight packs), `features/setup/` chips, background personalization, `content/notes/` for the 16 tricks | 20 cards, at least 18 pass after one repair; a hostile note yields the cache; the client payload has no answer key; a 503 tries `gemini-3.6-flash` once through the same Guard, then the cache; under 18 and the quick day never call a model; A2 ticks in `docs/kill-test.md` |
| [ ] | 2, 17 Oct morning, the phone | Lesson only on scams, buttons on the card (no sheet), tiles open threads, per-sender ledger, follow-up consequence messages, recovery sequence, e-wallet protections, trace drawer, Judge Lab, turn-based call with pregenerated beats, the synthetic-voice variant disclosed as practice, chat looks per pack | A real message gets one line, a scam gets the lesson; a home tile opens that thread; pay drains the wallet, then freeze and the official number recover part of it; the trace drawer shows model id, latency, verdicts and ids only; Judge Lab generates a card live; three pushbacks drop the meter, "Read the code" fills it, microphone blocked still scores |
| [ ] | 2b, 17 Oct midday, the UI | One agent per staged moment: lock-screen cold open, app zoom, tell stamp, consequence scenes, full-screen call, ledger reveal; design review of screenshots at 390 and 1440 and on a real phone; two type options for the Builder to pick | axe in Playwright: zero violations; reduced motion honoured with cross-fades; the practice tag in each app header and on the lock screen; no hex from the avoid list; no typeface from the ban list |
| [ ] | 3, 17 Oct afternoon, room, proofs, words | Room links and facilitator heatmap, learning delta cards, reliability report script and About panel, aggregate counter, generated art inspected before `web/public/art/`, deck draft with live screenshots, video script, README, Social Choice post, hotline verification for all eight countries | Two phones in one room and the heatmap shows both; no message text in Firestore room docs; the learning delta appears on the ledger; the report's numbers come from the script run (first-try pass rate, after-repair pass rate, latency, fallback rate); every pack's hotline is verified at an official page or absent |
| [ ] | 4, 17 Oct evening, gates | Live caller only if kill test A passed; kill test B played; Content lead reviews the full cache; playtest round two; freeze at midnight | `cup-reviewer` clean; `npm test` and `npm run check` pass; "coming soon" reads the same in the app, the deck and the README; after midnight only fixes |

## D. Content (Content lead, Playtest lead)

| Done | Item | By |
|---|---|---|
| [ ] | 16 pattern notes in the `PatternNote` shape, country-neutral patterns; the pack supplies the apps, the currency and the hotline. Drafted with the scenario-author agent, every note approved by the Content lead | 16 Oct |
| [ ] | Hotlines for all eight countries: verified at an official page, or absent. No number ships unverified | 17 Oct |
| [ ] | Every cached card in all eight packs reviewed by the Content lead before the freeze | 17 Oct |
| [ ] | Playtest round one: the team plays day one with their own people; the before and after cards give the first learning delta | 16 Oct evening |
| [ ] | Playtest round two: same players plus two outside the team, in at least two packs; the two rates and the delta in their words | 17 Oct |

## E. Submission (Deck lead, Playtest lead, Builder)

| Done | Item | By |
|---|---|---|
| [ ] | Deck skeleton, the mark, the Social Choice post | 16 Oct |
| [ ] | App marks, playtest sheet | 16 Oct |
| [ ] | Video script locked. Opening: the phone buzzes on a table, the thumb hovers over Send money, the voice-over names Gemini on Vertex AI and the code Guard by 0:10, the trace drawer by 0:12, a real verify call, the pressure call by 0:27, title and URL by 0:30 | 17 Oct |
| [ ] | Record on a real phone from the lock screen, under 2:50, a visible generation moment by 0:30, the agent graph by 1:30, a backup take of the call. Public on YouTube or Drive | 18 Oct |
| [ ] | PDF deck, seven sections: problem, solution vision, community benefit, feasibility, scalability, architecture, business case. Numbers only with sources; practice label in every screenshot; examples rotate across packs | 18 Oct |
| [ ] | README in English with the live URL, the video link, the contact email | 18 Oct |
| [ ] | Submit on the dashboard by noon UTC+8 unless Discord gave a later hour. Open the video link in a private window | 18 Oct |

## F. Automations already in place, and what runs them

- `npm test` and `npm run check` are the gate before any commit and any deploy. The coding agent runs both before calling a run done.
- The `policy-reviewer` agent runs on every diff under `content/`, `server/agents/`, `server/guard/` or `web/`.
- The `scenario-author` agent drafts pattern notes; the Content lead approves each one.
- The `cup-reviewer` agent audits the tree against sections A and E before every push and the submission. It reports the gates it can see from code and lists the rest as reminders.
- The Discord poster on `main` posts every push to the team channel.
- Workflow runs carry the pinned strings in every brief; a reviewer agent checks each slice against its check.
- Cloud Scheduler is cut with Scout.

## Not verified, said as such

The deadline hour; TTS and live quality against other vendors; live API behaviour under pushback (kill test A); money-lock and cooling-off specifics at bank pages; most hotlines; the effect sizes cited for inoculation games; the availability of the Deck lead and the Playtest lead on 18 Oct (if neither, the Builder records the screen and the deck is the outline filled with live screenshots).
