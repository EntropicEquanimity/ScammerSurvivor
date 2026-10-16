# Scammer Survivor: agent contract

A practice phone for spotting scams, for anyone in the JAPAC region, any age, built for AI Builder Cup 2026 (Google Cloud JAPAC, Hack2skill). The player plays a day on a phone: messages and calls arrive in the apps people in their country use, some real and some scams; they act, never label; they tap the tells. Code scores. Gemini writes the day and explains the tells. The product is Scammer Survivor. Design of record: `docs/superpowers/specs/2026-10-03-practice-phone-design.md`.

## Rules that never bend

1. The practice label "Practice. Not a real message." is in the DOM of every screen for assistive technology (`PhoneShell` renders it visually hidden). The non-affiliation sentence from `shared/strings.ts` is shown once per visit as a notice the player dismisses, and in full on the Privacy page. Calls say "Practice call". No visible practice chip or eyebrow sits on app headers or notification cards (the Builder removed it on Oct 16: it broke the own-phone fiction the pitch rests on).
2. Made-up apps only, from `shared/brands.ts`: layout conventions of the real app, an invented name, an original mark, and none of the real brand's colours, typefaces or icons. No real brand name, logo or sound-alike in any mock. Real brands appear only as plain text in lesson copy.
3. No typed input anywhere in the app. No `<input>` or `<textarea>`. No field for a password, PIN, one-time code, card, account or phone number; the code moment is a button. Exception, ruled by the Builder on 16 Oct 2026: practice pages in the in-game browser may show rows for a name, birthday, address, card, password, code or ID photo. They are not inputs: they fill only by tapping a suggestion from the pretend profile in `shared/profile.ts`, nothing the player knows can be entered, and nothing is sent anywhere outside the game. On practice calls the player speaks: audio is never stored, the transcript is deleted once the lesson is shown, and speech is never scored.
4. Cards are generated on the server from approved pattern notes, and from nothing else: nothing is generated from a player's typed text because there is none. Human approval sits at the pattern-note level. The Guard checks every card; the Director repairs once with the Guard's reasons; a card that still fails is dropped and a reviewed cached day is the fallback. The quick day and under 18 are cache-only. No route takes free text; the Judge Lab generates only from approved notes and chips. No export, copy button, share control or fake receipt (a receipt object a player could save or show; a message that mentions a purchase in words is a message, ruled 16 Oct 2026). Fake links are plain text spans, never anchors. Amended 16 Oct 2026.
5. If a model refuses, errors or returns nothing, serve a cached card or the scripted call. Never rephrase a prompt to get around a refusal.
6. The repo holds the tell taxonomy and pattern notes, never ready-to-send scam messages. That covers docs, fixtures and wireframes too: bracketed placeholders only. Generated cards live only in Firestore.
7. Gemini never decides a score. `shared/score.ts` does, as a pure function with tests: actions against the card's safe and unsafe replies, tell taps against the planted tells, the call meter per delivered beat. Scored actions come only from buttons and taps.
8. Translations come only from approved English cards, part by part so tells stay tagged, with the "translated by AI" note and the "this reads wrong" button. Nothing is generated in another language first.
9. Under 18 never reaches a model: cache-only day, no sign-in, no call.
10. Google AI only inside the app: `@google/genai` and Google's ADK. No non-Google AI SDK in `package.json`.
11. Fresh code only. Nothing copied from an earlier project (Cup rule, disqualifying).

## Cup gates in short

- Live URL on Cloud Run, public GitHub repo, video under 3 minutes, 7-section PDF deck, all in English.
- Deadline Oct 18 2026, hour not public. Internal code freeze at midnight on Oct 17; only fixes after that.
- Scoring: Technical and Gen AI 40, Impact 25, Innovation 25, UX 10.

## Stack

- One Cloud Run service in asia-southeast1: Node, Express, serving a Vite React app and `/api`. Secret Manager for the Gemini key. Tier 1 key only, from the Cup project.
- Model routing: Vertex AI by default on Cloud Run, through the enterprise mode of `@google/genai` (`new GoogleGenAI({ enterprise: true, project, location })` on the service account's default credentials). `GEMINI_ROUTE=developer` is the fallback flag: it switches to the Developer API with `GEMINI_API_KEY`; set it locally to use the key, leave it unset for Vertex.
- Firestore: pattern notes, card cache, days, progress, rooms. Google sign-in is cut (no Firebase Authentication). Maps Geocoding and Cloud Scheduler are cut with the location option and Scout.
- Agents in this build, one job each: Director (`gemini-3.8-flash`, structured output, generate, Guard, one repair turn), Guard (code), Coach (`gemini-3.8-flash`, streamed), Caller (`gemini-3.8-flash-tts` beats generated before the call; `gemini-3.8-live` only after kill test A passes). Model names live in `server/gemini.ts` only. A 503 tries `gemini-3.6-flash` once through the same Guard, then the reviewed cache. Scout and Translator are designed, not in this build; ADK is cut.

## Layout

- `shared/` types (the pattern note and card shapes live here), taxonomy (nine tells, ten categories), brands (institution and app names), strings, score, mask
- `content/README.md` how to write a pattern note; `content/notes/` pattern notes per country; `content/packs/` one country pack per file (layouts, hotline, `numberMask`, sources)
- `server/` routes, `agents/` (scout, director, translator, caller, coach, one per file), `guard/` (the deterministic checks), difficulty, store
- `web/src/shell/` and `web/src/features/{day,card,layouts,lesson,call,languages,review,progress}/`
- Seven layouts: one chat component with green, blue, sticker, cloud and purple looks; text messages; email; e-wallet. The colours to avoid are listed once, in `docs/ux-plan.md`
- `scripts/` and `docs/`

## Conventions

- Files under 400 lines, functions under 50, nesting under 4 levels. Organise by feature.
- Return new objects; do not mutate.
- Commits: `<type>: <description>` with type in feat, fix, refactor, docs, test, chore, perf, ci.
- No em dashes in code, copy or docs. Plain words; short sentences. English only in the source; other languages come from the Translator at run time.
- People appear by role, never by name. No machine paths in tracked files.
- Mark any unconfirmed fact about a Google product as "not verified" instead of guessing.

## Docs

- `docs/superpowers/specs/2026-10-03-practice-phone-design.md` the design of record
- `docs/features.md` the feature list, `docs/team-questions.md` answers to team questions
- `docs/ux-plan.md` screens, layouts, copy rules; `docs/build-plan.md` architecture, data model, slices and checks
- `docs/compliance.md` every policy rule with its source; `docs/kill-test.md` the model tests and their results
- `docs/sources/` the two scam catalogues; `docs/tools.md`, `docs/app-readiness.md`, `docs/submission-deck-outline.md`, `docs/google-setup.md` (every Google product, step by step, who does what), `docs/cup-runbook.md` (the one list to work from)

## Before you call a change done

1. `npm test` passes.
2. `npm run check` passes (policy grep: any text input, real brand names, anchors in scenario components, copy or share controls, non-Google AI SDKs).
3. Rules 1 to 11 above still hold for what you touched.
4. You opened the changed screen at phone width and saw it work.
