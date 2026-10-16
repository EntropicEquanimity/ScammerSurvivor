# Skeptic log

One entry per round. The Skeptic (`.claude/agents/skeptic.md`) asks; the builder answers in the same entry once the fix lands. The next round reads this first and does not repeat an answered question unless the evidence changed.

## Round 1, 2026-10-16 evening, against the live URL (revision 7) and the uncommitted UI tree

Verdict: does not place first as it stands. First-place estimate 5 percent, 15 after the fixes plus one real room played.

| # | Question | Evidence found | Answer or fix | Status |
|---|---|---|---|---|
| 1 | Is the practice call reachable by a human? | `CallScreen.tsx` imported nowhere; `App.tsx` renders DayScreen without `onCall`; `useDay.ts` skips the call without it; the API works | Mount the call through DayScreen's `onCall`; day ends after the call | fix run A |
| 2 | Does a judge see Gemini do anything on the default path? | "Gemini" on no day screen; trace drawer only in the lab; Skip gives a cache-only day | Gemini chip in the app header that opens the trace drawer for that day | fix run A |
| 3 | Why do "[institution]" and "[chat app name]" render raw? | 1 to 3 of 4 cards per live day; the lab preview too | Fill at deal time from `INSTITUTIONS` and the layout's brand; same in the lab route | fix run A |
| 4 | Is the live service on Vertex AI? | `eval.json` says developer route (run from a laptop) | Verified on the service: no developer flag, location global, scale 1 and 1. The chip will show the route on screen | answered |
| 5 | Is minute one fun for a stranger? | Two stacked modals live, seven taps to the first decision, no lock-screen notification | The uncommitted UI tree merges the modals and floats the indicator; measured by the Ruler; the lock notification is part of it | fix run A, then stopwatch |
| 6 | Will room mode be used by a real group before Oct 18? | `daysPlayed: 0`; rooms in memory | Team plays one room tonight; board screenshot to the deck | team |
| 7 | What breaks with two judges? | No `trust proxy`, so the lab limit of 6 per hour is global behind the load balancer | `app.set('trust proxy', true)` | fix run A |
| 8 | Can the video be shot from what exists? | Shots 4, 8, 18 to 21 show things that do not exist or too briefly | Rewrite after fixes 1 to 3 | Czar |
| 9 | Are the deck's numbers sourced? | Six "needs source"; Singapore named five times, other packs one to three | Fill or cut; rotate examples | Czar |
| 10 | English-only and JAPAC-neutral everywhere? | `strings.ts` hardcodes a Philippine hotline; the notice says "we may mention real platforms"; "really your Tomas" for a stranger | Remove the hotline, rewrite the notice, role-aware twin lines | fix run A |

Could not verify: the call reachable (play to the end), the room board with two phones, first scam inside 30 s (stopwatch), the voiced beats played in a browser.

Cuts accepted: no beats rerun yet; Scout and Translator rows off About and the deck body; the UI judges run after the fixes.

## Round 2, 2026-10-16 late, against live revision 8 (commit 107a6f5)

Verified from round 1: the call is reachable in the UI (Accept, pushbacks in 4 to 5 s, hang up, day over, result card); the Gemini chip and drawer are on every card; trust proxy set; hotline out of strings; no practice chips; 124 tests. Stopwatch: 12.7 s and five taps to the first card on a warm server.

Verdict: does not place first. Estimate 4 percent; 12 after question 1; about 20 with 2, 4 and 8.

| # | Question | Evidence | Fix | Status |
|---|---|---|---|---|
| 1 | Why does a wrong but free action on a scam strand the player? | Reply on a scam scores incorrect with the wallet unchanged; `useDay.ts` sends every incorrect scam to recovery; the server answers 400 nothing_to_recover; the ring runs out with no exit (reproduced in SG and JP) | Recovery only when money left the wallet, else the lesson | fix run B |
| 2 | Does the Skip path show Gemini before the call? | Skip sends no people, so no personalisation; every chip says "From the reviewed set"; with people, the chip flips only on card 3 at 19 s | Personalise cards 2 onward on Skip too, with neutral names | fix run B |
| 3 | Does the Coach reach a judge? | The lesson streams for 37.7 s; its trace event lands in a buffer the drawer never reads | One trace store; a short first sentence fast | fix run B |
| 4 | Which call tricks are silent? | fast_romance, loan_threat, prize_fee have no audio; those days skip the call silently | Voice the three, and exclude unvoiced tricks from the call pick | fix run B |
| 5 | Is the lab shootable live? | 13 s to 178 s per generation | Record a 13 s take or cut the shot | Deck lead |
| 6 | Is the call JAPAC-neutral? | "federal crime", "Investigator Vance", "officer Smith"; header hardcoded "Your bank" | Regenerate beats with a neutral-names rule; header from the trick's sender role | fix run B |
| 7 | Do the apps change with the country? | Six of eight packs report deckReady false; a JP day dealt green-chat and sms while JP lists sticker-chat, sms, wallet | Deal each card into the pack's matching layout | fix run B |
| 8 | What does the About counter say? | 9 days, trusted 1 of 18, all test traffic, persisted in Firestore | Reset before freeze; hide below 50 days | fix run B |
| 9 | Why does a placeholder still render? | `[wallet]` in a MY loan card | Fill every bracketed token, test that none survive | fix run B |
| 10 | Where is the product's name? | Title "Practice Phone", manifest "Practice"; "Scammer Survivor" nowhere in the app | Title, manifest, About header | fix run B |

Also: sign-in still promised in two places after it was cut; the Privacy contact is a placeholder address; the home widget says "from police statistics" where the source is ScamShield; About says Vertex and later "developer route"; a card wrote "Mum" next to a "Mom" chip; the ended call shows no hotline.

Cuts accepted: the 34 "Deck coming" countries in the picker; the sign-in lines; the laptop-run reliability block until a Cloud Run run replaces it.

## Round 4, 2026-10-16 night, HEAD 9b18a5e on the local preview and live revision 8

Verdict: does not place first. Estimate 4 percent; 14 after the single change; about 20 if the video leads with the arc.

| # | Question | Evidence | Fix | Status |
|---|---|---|---|---|
| 1 | Why does the day run backwards? | Notifications.tsx reverses the stack; clock 17:05 to 08:10; the rewrite target is played before the page scam | Messages arrive one at a time in slot order | builder, in progress |
| 2 | Does Gemini answer on the preview? | 13 coach_error on the local preview (rate limit); on the Cloud Run test link 2 of 3 chat replies were the model | Play on Cloud Run | checked on revision 9 |
| 3 | Does a call ever ring? | local 503 no_beats; on revision 9 call/start returns 200 | none | checked on revision 9 |
| 4 | Does card plus code cost money? | AU: nothing lost, no recovery | Fix the day route | builder, in progress |
| 5 | Why does the ledger contradict itself? | "400 gone" beside "Wallet 4,000 of 4,000" | One wallet source | builder, in progress |
| 6 | Is there a dominant strategy? | Call to check on every card scores perfectly | Verifying a real message scores trusted but slow | builder, in progress |
| 7 | Do real twins teach unsafe habits? | a real twin asks for a one-time code | Twins never ask for a code (Guard rule) | builder, in progress |
| 8 | Is the cache fit to deploy? | 6 packs had no pages or email | Regenerated all 8 packs on Cloud Run | done |
| 9 | Do raw tokens still ship? | "green-chat", "Notice Notices", "on .", X masks | Token survival test | builder, in progress |
| 10 | Where is AI on the default path? | trace removed from play; video and deck still promise it | Lead the video with the leak reuse | Deck lead |

OpenAI second opinion not run: the account's credit balance is exhausted.

## Round 5, 2026-10-17 about 02:45 Manila, preview revision 00013 and HEAD a36a037 (app only, per the Builder)

Score 58 of 100: Technical and Gen AI 24, Impact 14, Innovation 14, UX 6. First place 3 percent, top 3 8, shortlist 30. Down from round 4 because the public URL still serves revision 8.

Rules: pass on Google AI (Vertex), Google Cloud, English, Gemini never scores, under 18 blocked, practice label, no em dashes. At risk: realistic domains checked only at write time and four rule files still saying .example; full dialable numbers; fixed scam-side backup lines that read as ready-to-send text; "act, never label" not amended; the About counter shows test traffic; JAPAC brands missing from the denylist.

Five fixes: deploy HEAD to 100 percent; Day over consistency; one modal at a time; domains rechecked before deploy and rule files aligned; reset the counter and widen the denylist. All but the deploy are with a builder; the deploy follows the Ruler.
