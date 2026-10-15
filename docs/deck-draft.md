# Deck draft: seven sections in the Cup's order, plus a closing slide

Draft for the PDF deck, written 16 Oct 2026. One message per slide. Every slide names its proof, the live screenshot that goes on it, and the source of every number. A number without a source carries the tag "needs source" and does not go on a slide until it has one. The architecture slide names only what is live in the repo today.

Sources used: `docs/prd.md` (the SPF, NASC and UCSD figures, each read at the source page), `docs/kill-test-b-2026-10-16.md` (the play of Google's own game), `docs/kill-test.md` (the 16 Oct Director run), and the repo itself for counts (`content/packs/`, `content/notes/`, `shared/taxonomy.ts`, `server/routes/lab.ts`). The playtest numbers come from the Playtest lead's sheet; until then the slides that need them say so.

Every screenshot comes from the live URL at phone width and shows the practice tag. Examples rotate across the eight packs: no two slides use the same country.

## Section 1: Problem

| Item | Content |
|---|---|
| The one message | People lose money by pressing send themselves, in the apps they use every day. Reading a warning does not change that |
| Proof | 81.8% of Singapore scam cases in 2025 were transfers the victim made; 37,308 cases; SGD 913.1M lost. Source: Singapore Police Force, Annual Scam and Cybercrime Brief 2025 (`docs/prd.md`, read at source) |
| Proof | Australia lost AUD 2.18B to scams in 2025. Source: National Anti-Scam Centre, Targeting Scams report 2025 (`docs/prd.md`, read at source) |
| Proof | Passive phishing training cut clicks by about 2% across 19,500 staff. Source: UC San Diego Today (`docs/prd.md`, read at source) |
| Screenshot | Lock screen (Singapore pack) with one practice notification from a new number, the practice tag visible |
| Hold | The Philippines fraud figures and the 2026 Singapore mid-year figures in `docs/prd.md`: needs source confirmation before use |

## Section 2: Solution vision

| Item | Content |
|---|---|
| The one message | Play a day on your own phone. Act, never label. Keep your money, keep your people, beat the caller |
| Proof | The three differences from Google's own Be Scam Ready game, confirmed by playing it to the evening chapter on 16 Oct (`docs/kill-test-b-2026-10-16.md`): eight country packs with the apps and hotline that change with the country (theirs: no country choice); a caller that talks back to your buttons (theirs: fixed lines, advance only); real messages scored as a trust rate beside the catch rate (theirs: one real text folded into a dollar balance) |
| Proof | Their first scored decision takes 13 clicks and about two minutes (`docs/kill-test-b-2026-10-16.md`, counted during play, time read from the in-call clock). Ours: a target of under 60 seconds; needs source until timed on a clean phone |
| Screenshot | A chat card (Indonesia pack, green-chat look) with the action buttons on the card, then the tell picker with two tells stamped |
| Say out loud | Nothing is typed anywhere. The practice label is on every screen |

## Section 3: Community benefit

| Item | Content |
|---|---|
| The one message | It teaches people across JAPAC to catch scams without teaching them to fear their own family and bank |
| Proof | People 65 and over lost the most per victim in Singapore in 2025: SGD 37,053. Source: SPF brief 2025 (`docs/prd.md`, read at source) |
| Proof | Older Australians are 17.1% of people and 26.5% of scam losses. Source: NASC 2025 (`docs/prd.md`, read at source) |
| Proof | The trust rate: every scam has a real twin and trusting the real one is scored. The recovery sequence after a slip: freeze, call the official number, report, partial recovery if fast |
| Proof | Playtest table: scams caught and real messages trusted, before and after, from the Playtest lead's sheet. Needs source until the sheet is filled |
| Screenshot | End-of-day ledger (Malaysia pack): one row per sender, the two rates as the footnote, the hotline line |
| Honest line | The country hotline is shown only where an official page states it (`docs/hotlines.md`): seven of eight packs; the Philippines pack shows no number |

## Section 4: Feasibility

| Item | Content |
|---|---|
| The one message | It runs on a public URL today, and it cannot be used to write scams |
| Proof | Live URL and public repo on the slide. The policy table: practice label on every screen, no typed input (the check greps for it), fake links as plain text, generation on the server from approved pattern notes only, the Guard on every card, the reviewed cache or the fixed table on any refusal, error or outage |
| Proof | Director run of 16 Oct on the Cup project's key: original prompt 0 of 4 cards passed; generate, Guard, one repair turn, Guard again: 6 of 6 passed, about 34 s per card (`docs/kill-test.md`, 16 Oct entry) |
| Proof | 16 pattern notes (`content/notes/`), eight packs (`content/packs/`), nine tells and ten categories (`shared/taxonomy.ts`), 13 Guard checks (`server/routes/lab.ts`) |
| Screenshot | Judge Lab (India pack) after a live generation: the trace rows with model id and latency, the Guard table, the revealed tells |
| Do not say | Anything about the live voice caller or kill test A. Not run |

## Section 5: Scalability

| Item | Content |
|---|---|
| The one message | A new country or a new scam is a data change, not a rebuild |
| Proof | A country is one pack file: layouts, currency, number mask, hotline, deck order, sources. A scam is one pattern note in neutral words from a public advisory; a person approves it; `scripts/pregenerate.ts` fills the cache for every pack |
| Proof | The eight packs today: AU, HK, ID, IN, JP, MY, PH, SG, equal weight, no lead country (`content/packs/`) |
| Proof | Cost per day: needs source. `docs/prd.md` carries a list-price estimate to be replaced by measured usage; nothing measured yet |
| Screenshot | Country picker on the lock screen (all eight packs listed), beside the Japan home screen with its three app tiles |
| Proof | Room mode (`server/routes/room.ts`, `web/src/features/room/`): one link, a family, an office or a group plays the same seeded day on their own phones; the facilitator board shows who fell for which tell as ids and counts, never message text; the Coach writes the group debrief. The same mechanism serves a bank branch or a community centre in any pack |
| Designed, not in this build | Scout (advisory reading with human approval), Translator (part-by-part translation of approved English). Named as such on the slide |

## Section 6: Architecture

| Item | Content |
|---|---|
| The one message | Four agents, one job each, and code keeps the score |
| Graph | Director (`gemini-3.8-flash`, structured output, one repair turn) writes the card. Guard (code) checks it: pass, or reasons back to the Director once, then the reviewed cache. Coach (`gemini-3.8-flash`, streamed) writes the lesson after the score exists. Caller (`gemini-3.8-flash-tts`) voiced the beats ahead of time; at play time `gemini-3.8-flash` picks which beat answers the button and code moves the meter. A 503 tries `gemini-3.6-flash` once through the same Guard |
| Google Cloud on the graph | Cloud Run asia-southeast1 (one service, one instance); Vertex AI through `@google/genai` enterprise mode on the global route, service account credentials; Firestore (card cache, call beats, room and stats counters); Cloud Storage (beat audio); Secret Manager (the key for the Developer API fallback route) |
| Must be visible | The human approval step at the pattern-note level and the card review. The line where the answer key stays on the server. The fallback that runs the same Guard. Under 18 and the quick day never reach a model |
| Screenshot | Trace drawer (Hong Kong pack) open over a day: Director, Guard, repair, Coach rows with model id, latency and tokens, ids only |
| Not on the graph | Scout, Translator, the live caller, Firebase Authentication, Cloud Scheduler, Maps. None is in this build |

## Section 7: Business case

| Item | Content |
|---|---|
| The one message | Banks, e-wallets and regulators across JAPAC run fraud education; this gives them a number to show for it |
| Proof | Who pays later: a bank or e-wallet edition where the packs, the lesson copy and the results page carry the sponsor's name, never the mock scam screens. What they get: catch rate and trust rate across their customers, as ids and counts, never message text. Room mode is the shape of that product today: a facilitator link, a board of missed tells, a group debrief |
| Proof | The loss scale is on slide 1 (SPF, NASC). Do not claim losses prevented; no data supports a number |
| Numbers | Price per seat, cost per day, market size: needs source. None goes on the slide without one |
| Screenshot | Result card (Australia pack): the share-ready card from the ledger, practice tag on it |
| If available | One quote from a fraud or education person at a bank or e-wallet, named by role. Not verified that one is reachable in time |

## Closing slide

| Item | Content |
|---|---|
| The one message | The two rates, big, from real players. Needs source until the playtest sheet is filled; if it is not, the slide shows the live URL and the four-agent line instead |
| Also on it | Team by role, the live URL, the repo, the Google services in one line: Cloud Run, Vertex AI, Firestore, Cloud Storage, Secret Manager |
| Screenshot | The lock screen again, a different pack from slide 1 |

## Checklist before export

- [ ] Seven sections present, in the Cup's order, then the closing slide
- [ ] Every number traced to its source above; every "needs source" either sourced or removed
- [ ] No real brand logo or look-alike colour; real brands in text only
- [ ] Every screenshot from the live URL, at phone width, practice tag visible, eight packs rotated
- [ ] The architecture slide names only what is live; the designed agents are marked as such
- [ ] No message text from any card on any slide; bracketed placeholders only
- [ ] English only; no em dashes
- [ ] Exported to PDF and opened once on a phone
