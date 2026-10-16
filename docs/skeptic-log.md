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
