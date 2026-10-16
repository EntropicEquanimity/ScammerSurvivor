# Build plan: Scammer Survivor

Rewritten 3 Oct 2026 from `docs/superpowers/specs/2026-10-03-practice-phone-design.md`. Where this file and the spec disagree, the spec wins. Model names and limits come from the team's Google stack research (28 Sep 2026) and the kill-test runs of 2 and 3 Oct.

Fixed dates: roster cutoff 4 Oct per the terms, 11 Oct per the site, treated as 4 Oct; code freeze 16 Oct; submission 18 Oct; judging 19 Oct to 6 Nov. No other dates in this file; sizes are scope and difficulty.

## 1. What is being built

A day on a phone. The country deck deals four cards (two for the quick day) and then the call. Each card is one decisive moment inside a made-up app that looks like the ones people in that country use. The player acts (reply, ignore, block and report, verify by calling a known number, pay, or the buttons the scam offers), then taps the tells. Code scores. The card turns over into the collection under its category. End of day: money kept, people kept, tricks collected, the tell most missed. New advisories surface as "new this week".

Every scam card has a real twin. A four-card day holds at least two real messages; a quick day at least one.

## 2. Build route

Scaffold and code locally with Claude Code, deploy to Cloud Run from the repository. Google AI Studio is used for the kill tests and prompt tuning only. One builder, one tool writing the repository.

## 3. Architecture

```
Browser (Vite React app, installable)
  |  /api (JSON)                 |  live-call token only
  v                              v
Cloud Run service, asia-southeast1 (Node, Express)
  |-- deal a day        <- Firestore cache of approved, generated cards
  |-- score action/tap  <- shared/score.ts (pure code)
  |-- lesson            <- Coach (gemini-3.8-flash)
  |-- translate         <- Translator (gemini-3.8-flash), approved cards only
  |-- token             <- short-lived locked token for gemini-3.8-live
  |-- scripted call     <- gemini-3.8-flash-tts
  |-- scout run         <- Scout (gemini-3.8-flash + Search grounding), Cloud Scheduler weekly
  |-- approval page     <- a person approves pattern notes
  |-- geocode           <- Google Maps Geocoding, result discarded
Secret Manager: Gemini key, Maps key
Firestore: decks, notes, cards, translations, days, progress
Firebase Authentication: Google sign-in after the first day
```

Models are served from the global endpoint through the Gemini Developer API on the Tier 1 key of the Cup project.

## 4. Six agents, one job each

| Agent | Model | Job | Never |
|---|---|---|---|
| Scout | `gemini-3.8-flash`, Search grounding, URL context | Reads each country's official advisories, matches each to one of the 67 catalogue entries, writes an English pattern note (the `PatternNote` shape in section 5). Weekly on Cloud Scheduler, and on demand | Writes message text |
| Approval page | a person | Approves or rejects each note. Only approved notes reach a deck | |
| Director | `gemini-3.8-flash`, structured output | Turns an approved note into a card: setup, the ask as message parts with tell ids attached, safe and unsafe replies, usual ending, the real twin, the call beats. Institutions, people and numbers are constrained fields chosen from the registry | Free-text names; takes instructions from player input (there is none) |
| Guard | code | Rejects real brand names on a whole-word denylist ("grabbed" contains "Grab" and must pass), unmasked numbers, live links, unknown tell ids, real twins carrying tells. One regeneration, then a cached card | |
| Translator | `gemini-3.8-flash`, structured output | Translates an approved English card part by part into a target language, keeping every part id and tell id. Runs ahead of time per language; a Guard pass runs on the result | Translates unapproved cards |
| Caller | `gemini-3.8-live` | Voices the call from the Director's beats, English only for the Cup | Scores anything |
| Coach | `gemini-3.8-flash` | Writes the side-by-side lesson after code has scored | Scores anything |

## 5. Data model

```ts
type TellId = 'trust_building' | 'urgency' | 'isolation' | 'escalation' | 'authority'
  | 'payment_substitution' | 'credential_theft' | 'platform_migration' | 'synthetic_identity'
type Category = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J'
type Layout = 'green-chat' | 'blue-chat' | 'sticker-chat' | 'cloud-chat' | 'purple-chat'
  | 'sms' | 'email' | 'wallet' | 'call'
type Action = 'reply' | 'ignore' | 'block_report' | 'verify_known_number' | 'pay'
  | 'open_link' | 'send_money' | 'share_code' | 'install' | 'keep_secret'
  | 'ask_reference' | 'call_back' | 'refuse_code' | 'read_code' | 'hang_up' | 'hang_up_call_official'

type CountryPack = {
  code: string                         // ISO 3166 alpha-2
  layouts: Layout[]                    // the three apps scams arrive on, in order
  confidence: 'high' | 'medium' | 'low' // shown as "from police statistics" or "based on usage"
  deckOrder: TrickId[]                 // from the catalogue line; unlisted tricks dealt less often
  hotline: { label: string; number: string; reportUrl: string }
  numberMask: string                   // e.g. '+65 XXXX dddd'; X hides a digit, d keeps one
  sources: { title: string; url: string; date: string }[]
}

type Trick = { id: TrickId; category: Category; name: string; commonRank?: 1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16;
  catalogueEntry: number; majorIn: string[]; newSince?: string; sourceUrl: string }   // one row of the catalogue

type PatternNote = {                   // what the Scout writes and a person approves; the shape scenario-author drafts
  id: string; country: string; category: Category; catalogueEntry: number; app: Layout
  setup: string; ask: string; tells: TellId[]; safeReplies: Action[]; unsafeReplies: Action[]
  usualEnding: string; realTwin: string; confidence: 'high' | 'medium' | 'low'
  source: { url: string; date: string }; approved: boolean
}

type MessagePart = { id: string; text: string; tellIds: TellId[] }   // tellIds empty on real twins

type Card = {
  id: string; trickId: TrickId; country: string; layout: Layout; difficulty: 1 | 2 | 3
  setup: MessagePart[]                 // up to two sentences, may be empty
  ask: MessagePart[]                   // the decisive message
  sender: { displayName: string; institutionId?: string; maskedNumber: string }
  safeReplies: Action[]; unsafeReplies: Action[]
  usualEnding: string                  // shown in the lesson
  plantedTells: TellId[]               // union of ask part tells; answer key, server only
  realTwin: { sender: Card['sender']; parts: MessagePart[]; acceptable: Action[] }
  callBeats?: { tellId: TellId; instruction: string; fallbackLine: string }[]
  language: 'en'; approved: boolean
}

type Translation = { cardId: string; language: string; parts: Record<string, string>; guardPassed: boolean;
  reviewed: boolean; flags: number }   // flags: count of "this reads wrong" taps

type Day = { id: string; playerId: string; country: string; language: string; quick: boolean
  cards: { cardId: string; action: Action; tappedTells: TellId[]; realTwinAction: Action }[]
  call?: { cardId: string; beatsDelivered: number; meterEnd: number; action: Action }
  wallet: number; peopleKept: number; scores: DayScore; playedAt: string }  // kept 30 days

type Progress = { playerId: string; level: 1 | 2 | 3; collected: { trickId: TrickId; category: Category }[]
  missedTells: Partial<Record<TellId, number>>; signedIn: boolean }       // until "Delete my data"
```

The browser receives a card without `plantedTells`, `safeReplies`, `unsafeReplies`, `usualEnding` and `callBeats`; part ids and tell ids stay on the server as the answer key.

## 6. Scoring (`shared/score.ts`)

- Action: correct when it is in `safeReplies` (scam) or `acceptable` (real twin). A real twin met with block, report or ignore is a false alarm.
- Tells: caught, missed and false are set operations between tapped tell ids and `plantedTells`. Taps on a real twin count as false.
- Wallet: an unsafe reply on a scam subtracts the card's stake. People: a false alarm on a real twin subtracts one.
- Call: scored flags are the beats the server recorded as delivered; the scored action comes only from the six buttons. The meter is moved by code per beat (reference number, call back, refuse: down; read code, agree to pay: up; silence: up a little).
- Day: scams caught rate, real messages trusted rate, money kept, people kept.
- Difficulty: the most-missed tells return subtler next day; level up when both rates are high, down when the catch rate is low. Thresholds tuned in playtests.

## 7. Country, age and language

| Step | Rule |
|---|---|
| Country | Time zone first (`Intl.DateTimeFormat().resolvedOptions().timeZone` mapped to a country, no prompt). "Use my location" only when the zone maps to more than one country; coordinates go to Google Maps Geocoding, the country code comes back, nothing is stored. Manual override always wins |
| Age | First screen: 18 or older, or under 18. Under 18: cached cards only, no sign-in, no call of any kind. Nothing is written server-side for that age group: the day is served from the cache and progress stays on the device |
| Guest | Random device id in the browser; the first day is always a guest day |
| Sign-in | End-of-day screen, 18 or older only: Firebase Authentication, Google provider. Stored: Google user id and email. Guest progress is linked on first sign-in |
| Language | Picker lists every JAPAC language. English cards are approved once; the Translator produces each language ahead of time; every card and lesson in that language shows a "translated by AI" note beside a one-tap "This reads wrong" button that increments `flags` on the translation record. A language a reviewer has read shows "reviewed". The call stays English |

## 8. Layouts

One chat component with five looks (green, blue, sticker, cloud, purple): header colour, bubble shape, read indicator, sticker row, call banner. Plus text messages, email, e-wallet, and the call screen. Each has an invented name and colours from `shared/brands.ts`, none of the real brands' colours, typefaces or icons (the one canonical list of hexes to avoid is in `docs/ux-plan.md`). Fake links are spans. The practice label and the non-affiliation sentence are rendered by `PhoneShell` on every route.

Build order: chat component with its five looks, text messages, e-wallet, call screen, email, cloud-chat polish. Unfinished layouts show as "coming soon" tiles in the packs that use them.

## 9. The call

- Last card of a full day: the trick the player handled worst. Quick days and under-18 days have no call.
- Screen: practice-call banner, invented institution, masked number, confidence meter, practice code (a word), six buttons: Ask for a reference number, I'll call you back, Refuse the code, Read the code, Hang up, Hang up and call the official number.
- Live path: `POST /api/call/token` mints a short-lived token locked to the model, the persona instructions and the two tools; the browser opens `gemini-3.8-live` with `@google/genai`, 16 kHz in, 24 kHz out. The model calls `next_beat(player_reaction)`; the server returns the next beat and records it as delivered. `end_call(outcome)` only closes the session. Whether the model waits for `next_beat` is a slice 0 spike (live function calls are non-blocking by default).
- Hard stops in the persona: never ask for a real one-time code, PIN or account detail; refer only to "the practice code on screen"; end the call when the player says they will call the official number; stay inside the exercise for anything off-script; stop at three minutes.
- Scripted path, built first: the same beats through `gemini-3.8-flash-tts`, same buttons, same meter, same scoring. Any refusal, bland caller, 503 or token failure lands here.
- Video-call variant: the "friend or family" card arrives as a video call with "camera broken, voice only" (a `synthetic_identity` tell). Same call underneath.
- Limits: three minutes per call; tokens limited per device and per IP. Audio never stored; transcript in server memory until the lesson is shown.

## 10. Policy guards in code

| Rule | Where enforced |
|---|---|
| Practice label and non-affiliation sentence on every screen | `web/src/shell/PhoneShell.tsx` renders the label visually hidden for assistive technology on every route and a "Practice" tag sits on every notification card and app header; the sentence is a one-time dismissible notice and a Privacy page row (changed 11 Oct 2026) |
| No typed input anywhere | `scripts/check-policy.sh` fails on any `<input>` or `<textarea>` |
| No real brand names, colours or icons | `shared/brands.ts` registry; the Guard's whole-word denylist; the policy check on source |
| Fake links are text | message renderer emits spans; policy check greps `href` under `web/src/features` |
| No scam text in the repo | the repo holds pattern notes, never messages; cards live in Firestore; fixtures are real messages or bracketed placeholders |
| Generation on the server only | no client route reaches a model; the browser holds only the call token |
| Model never scores | `shared/score.ts` with tests; Coach runs after scoring |
| Refusals never reworded | a refusal returns a cached card or the scripted call; no rephrase path exists |
| Under 18 never reaches a model | `/api/day` serves cache only for that age group; `/api/call/*` and sign-in reject it |
| No non-Google AI SDK | policy check on `package.json` |
| No export, copy or screenshot-friendly receipt | no copy, share or download controls; policy check greps for them |
| Translations only of approved cards | Translator reads `approved === true` cards only; Guard runs on every translation |

## 11. Repository layout

```
AGENTS.md, CLAUDE.md             contract for every AI tool; Claude-only notes
Dockerfile, .dockerignore        node:24-slim, two stages, non-root (not built yet)
package.json                     dev, build, start, test, check
shared/types.ts                  the types in section 5
shared/taxonomy.ts               nine tell ids and ten categories with labels and one-line explanations
shared/brands.ts                 invented app and institution registry (names, colours, glyphs); number masks live on the country pack
shared/strings.ts                the practice label, the non-affiliation sentence, UI strings
shared/score.ts (+test)          pure scoring (kept from slice 1, extended for tells and stakes)
shared/mask.ts (+test)           per-country number masking: digits become X except the last four
content/README.md                how to write a pattern note, for the Content lead and the scenario-author agent
content/notes/<cc>.json          pattern notes per country (the PatternNote shape): the 16 common cards and matched catalogue entries
content/packs/<cc>.json          one country pack per file (layouts, order, hotline, numberMask, sources)
server/index.ts                  Express: static files, /api, errors as JSON
server/gemini.ts                 one client; model-name constants; the 503 fallback to gemini-3.6-flash
server/routes/day.ts             deal a day (cache only; cache-only for under 18), submit an action or tap
server/routes/call.ts            token, next beat, scripted lines
server/routes/translate.ts       serve a translation, record "this reads wrong"
server/routes/review.ts          approval page API for Scout notes and translations
server/routes/account.ts         link guest progress to a Google user; "Delete my data"
server/agents/{scout,director,translator,coach}.ts   one agent per file, prompt inside
server/agents/caller.ts          persona instructions and tool definitions for the live call
server/agents/schemas.ts         structured-output schemas
server/guard/validateCard.ts (+test)   deterministic checks
server/country.ts                time zone map, geocode call, pack lookup
server/difficulty.ts             level and missed-tell logic
server/store.ts                  Firestore collections
scripts/check-policy.sh          the policy grep (kept from slice 1, extended)
scripts/scout.ts                 run the Scout for one country
scripts/pregenerate.ts           generate and Guard-check cards and translations for the cache
web/src/shell/                   PhoneShell, HomeScreen, FirstOpen, CountryPicker
web/src/features/day/            DayClock, Notification, StakesBar, EndOfDay
web/src/features/card/           ActionBar, TellPicker (tap the parts)
web/src/features/layouts/        ChatComponent with five looks; Sms, Email, Wallet
web/src/features/call/           CallScreen, Meter, liveSession, ScriptedCall
web/src/features/lesson/         SideBySide, Hotline
web/src/features/languages/      LanguagePicker, TranslatedNote, ReadsWrongButton
web/src/features/progress/       Collection, SignIn, DeleteMyData
web/src/features/review/         Approval page (behind sign-in of the reviewers)
docs/                            this plan, the spec, compliance, kill tests, tools, features
```

## 12. Slices

Each slice is demoable on its own. The check is what proves it.

| # | Slice | Size | Check |
|---|---|---|---|
| 0 | Kill tests A, A2, A3, B; spikes: `next_beat` waiting, token locking, Firebase sign-in in an installed iPhone web app, Dockerfile builds | small, low | Results written into `docs/kill-test.md`; each spike has a yes or no |
| 1 | Walking skeleton (done 2 Oct): phone frame, practice label, one real message, scoring in code, policy check | small, low | 13 tests pass; `npm run check` passes and provably fails |
| 2 | Country and age: time-zone country, picker, age screen, non-affiliation sentence, packs for eight countries from the catalogue | small, low | Open with the clock set to Asia/Singapore and get Singapore; change to Japan and see the sticker-chat first; under 18 sees no sign-in |
| 3 | The day engine on fixture cards: deal four cards (two for quick), clock, stakes bar, action buttons, tell picker, end-of-day screen | medium, medium | A perfect day gives 100% on both rates and full wallet; blocking a real twin costs one person; the "friend or family" card appears on day one |
| 4 | Director, Guard, Coach, pregeneration into the cache; Translator for two languages | medium, medium | 20 generated cards: at least 18 pass the Guard; a hostile note yields a cached card; the client payload has no answer key; a translation keeps every part id |
| 5 | Chat component with five looks, text messages, e-wallet; packs choose layouts | medium, medium | Philippines day shows purple-chat first; Japan day shows sticker-chat; no hex from the avoid list in CSS |
| 6 | Language picker, "translated by AI" note, "This reads wrong" button, "reviewed" mark | small, low | Switch to a second language mid-day and the next card is translated; the button increments `flags` |
| 7 | Google sign-in after the first day; guest progress linked; "Delete my data" | small, medium | Sign in on one device, open on another, progress matches; delete removes days, progress and the Google id and email record, and signs out |
| 8 | Scripted call: TTS beats, meter, six buttons, scoring | medium, medium | Three pushbacks each drop the meter; "Read the code" fills it; block the microphone and the call still scores |
| | **Submittable line.** Prototype gates pass here, with the scripted call in the build; the video and pitch deck still have to be finished | | |
| 9 | Live call on `gemini-3.8-live` (only if kill test A passed) | large, high | Three pushbacks each get a new pressure line; an off-script request is declined; close the socket mid-call and the scripted path finishes it |
| 10 | Scout, approval page, "new this week" | medium, medium | A note shows source and date; an unapproved note never reaches a deck; a new approved note shows the mark |
| 11 | Email layout, cloud-chat polish, video-call variant | medium, low | Email card renders with the shared mail conventions only; the video-call variant shows "camera broken" |

Cut from the bottom if time runs short. Anything after the line that is cut shows as "coming soon".

## 13. Google setup checklist

| Item | What |
|---|---|
| Project | The Cup project (seen in AI Studio on 2 Oct, Tier 1 prepay) |
| Billing | The AI Studio banner says API requests fail after 12 Oct until credits are bought. Buy credits before 12 Oct. Set a budget alert |
| Gemini key | The Tier 1 key of the Cup project only. A free-tier key hit "limit: 20" requests a day on `gemini-3.8-flash` and "503 high demand" on most calls on 2 and 3 Oct, and free-tier content may be used to improve Google products |
| Search grounding | Plan on linked billing; free-tier status unclear in the docs |
| APIs | Cloud Run, Firestore (Native mode, asia-southeast1), Secret Manager, Cloud Scheduler, Geocoding API (key restricted to the Cloud Run origin), Firebase Authentication (Google provider enabled; the Cloud Run domain in authorised domains). Console labels not verified |
| Runtime | The Dockerfile pins `node:24-slim` because the server runs TypeScript files directly. The image has not been built yet (Docker Desktop was not running on 2 Oct); build and run it locally before the first deploy |
| Deploy | `gcloud run deploy --source .`, public access, secrets mounted as environment variables, region asia-southeast1 |

## 14. Judging-window survival (19 Oct to 6 Nov)

- Every card and translation a judge can see is pregenerated, Guard-checked and reviewed before 16 Oct. Nothing is generated while a player waits.
- Any model error, refusal or 503 serves a cached card; `gemini-3.6-flash` is tried once through the same Guard first.
- Budget alert on; call tokens limited per device and per IP; the quick day never needs a model or a microphone.
- Firestore cache has no expiry; days expire after 30 days.

## 15. Risks

| Risk | Mitigation |
|---|---|
| `gemini-3.8-flash` returns 503 under load | Cache first; `gemini-3.6-flash` once; nothing generated live for players |
| Live caller refuses, goes bland or ignores `next_beat` | Kill test A gates it; scripted call built first and ships regardless |
| Translation quality in languages nobody on the team reads | Approved English source; part-by-part translation with ids; Guard on the result; "This reads wrong" count surfaces bad cards; "reviewed" only after a human read |
| A card slips past the Guard with a real brand or a real number | Denylist and mask tests; the Content lead's review before the freeze |
| Trade dress of layout-only skins | Invented names and colours, avoid list in `docs/ux-plan.md`; counsel before any store launch |
| Firebase popup sign-in fails in an installed iPhone web app | Slice 0 spike; redirect sign-in as fallback (not verified) |
| Cloud Run build picks the wrong Node | Dockerfile pins Node 24; build it locally first |

## 16. Not verified

- Whether the live caller waits for `next_beat`; whether `liveConnectConstraints` can lock the persona and tools.
- Firebase sign-in popup versus redirect in an installed iPhone web app.
- Console labels for Firebase Authentication, the Geocoding API and the budget alert.
- The Dockerfile has not been built.
- The Singapore figures in the catalogue (confirm at the Singapore Police mid-year brief of 26 Aug 2026 before any slide).
- The trade-dress legal question.
- TTS price; Memory Bank is not used.
