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
