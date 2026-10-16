# Submission deck outline and video beat sheet

Product name: Scammer Survivor. This is the outline for the Cup's PDF deck, not the deck itself. The deck skeleton starts once the day engine is playable; the final deck and video are finished between the Oct 16 code freeze and Oct 18, once the prototype and playtest numbers exist. Rewritten 2026-10-03 to match the design spec.

Rules it must meet (gate G7): PDF, English, all seven sections below. A deck missing a section can fail the first screen before anyone scores it.

Owners are roles: Builder, Deck lead, Content lead, Playtest lead.

Slice tags follow `docs/build-plan.md`. Every item that needs a later slice says which one and what to show instead if it is cut. Never show a screen or claim a feature that is not in the live build.

## How to use this outline

- One message per slide. Two messages means two slides.
- Every number on a slide has its source in `docs/prd.md`. No source, no number. Nothing tagged "not verified" or "confirm at source" goes on a slide until it is confirmed.
- Screenshots come from the live app.
- Lay each slide out for its job. Do not repeat one template seven times.

## Section 1: Problem

| Item | Content |
|---|---|
| The one message | People lose money by pressing send themselves, in the apps they use every day, and reading warnings does not stop it |
| Proof on the slide | 81.8% of scam cases in Singapore involved transfers the victim made (SPF 2025). AUD 2.18B lost in Australia in 2025 (NASC). Passive training cut clicks about 2% (UCSD) |
| Hold until checked | The catalogue's 2026 Singapore figures (S$170M investment losses, 41% of digital-arrest victims 65+) until confirmed at the SPF mid-year brief |
| Picture | The country screen and the first card of a day from the live app (slices 2 and 3): "friend or family in trouble" on a new number, practice label visible |
| Owner | Deck lead |

## Section 2: Solution vision

| Item | Content |
|---|---|
| The one message | Play a day on your phone, in the apps scams really use in your country. Keep your money, keep your people, beat the caller |
| Proof on the slide | Three screenshots from the live URL: a card inside a chat look with a tell tapped (slices 3 and 5), the end-of-day screen with both rates (slice 3), the call screen with the meter (slice 8, which is inside the submittable build; slice 9 if the live caller shipped, otherwise the scripted call) |
| What to say out loud | What it does that Google's Be Scam Ready does not, taken from the kill test B result in `docs/kill-test.md`: country decks with the apps that are real there, real twins and the trust score, spot the tell, the boss-fight call, every JAPAC language |
| Owner | Builder (screens), Deck lead (wording) |

## Section 3: Community benefit

| Item | Content |
|---|---|
| The one message | It teaches people across the region to catch scams without teaching them to fear every message |
| Proof on the slide | Playtest table: five players, scam catch rate and real-message trust rate at day one and day three. Older people lose the most per victim (SPF 2025: SGD 37,053 for 65 and over) |
| Honest line | One trial (DeLiema 2025, n=1,191) found the effect fades in 2 to 3 weeks; Google's own trial held at 21 days. That is why the day repeats and gets harder |
| Also show | The country list with decks for all of JAPAC, and the language picker (slice 6; if cut, the country list alone) |
| Owner | Playtest lead (numbers), Content lead (the deck and categories) |

## Section 4: Feasibility

| Item | Content |
|---|---|
| The one message | It already works on a public URL, and it cannot be used to write scams |
| Proof on the slide | Live URL and repo link. The policy guards as a short table: practice label and non-affiliation sentence on every screen, no typed input, fake links as text, generation on the server from approved cards, Guard on every card, cached cards or the scripted call on any refusal or outage |
| Also show | Kill test results from `docs/kill-test.md` as they came out. If test A passed: the model played the caller. If it failed: the scripted call. Do not assume a pass |
| Owner | Builder |

## Section 5: Scalability

| Item | Content |
|---|---|
| The one message | A new country, a new language or a new scam is a data change, not a rebuild |
| Proof on the slide | The country table (one line per country: apps, confidence, deck order). Cost per day from `docs/prd.md` (estimates until measured). The translation path: approved English once, every JAPAC language from it (slice 6; if cut, show the picker design) |
| Also show | The Scout and approval page (slice 10): an advisory becomes a pattern note, a person approves, the deck shows "new this week". If cut: the catalogue files as the data a person edits |
| Owner | Builder (mechanism), Deck lead (wording) |

## Section 6: Architecture

| Item | Content |
|---|---|
| The one message | Six agents, one job each, and code keeps the score. Say "six agents" only if all six are live: Caller needs slice 9 and Scout needs slice 10. Otherwise give the live count and mark the rest "designed, not in this build" |
| Proof on the slide | The agent graph with every Google service labelled: Scout (`gemini-3.8-flash`, Search grounding, Cloud Scheduler), Director (`gemini-3.8-flash`, structured output), Guard (code), Translator (`gemini-3.8-flash`, structured output), Caller (`gemini-3.8-live`), Coach (`gemini-3.8-flash`); `gemini-3.8-flash-tts` for the scripted call; Cloud Run, Firestore, Secret Manager, Firebase Authentication, Google Maps Geocoding; AI Studio for the kill tests and prompt tuning |
| Must be visible | The human approval step. The line where the answer key stays on the server. The fallback path that runs the same checks. The 503 path to `gemini-3.6-flash` then cache |
| Owner | Builder |

## Section 7: Business case

| Item | Content |
|---|---|
| The one message | Banks, e-wallets and regulators across JAPAC are expected to run fraud education; this gives them a number to show for it |
| Proof on the slide | Who pays later: a bank or e-wallet edition where decks, lesson copy and the results page carry the sponsor's name, never the mock scam screens. What they get: catch rate and trust rate across their customers. Any regulator duty quoted only after a direct read of the source |
| Unit view | Cost per day against the median loss figures in `docs/prd.md`. Do not claim losses prevented; no data supports a number yet |
| If available | One quote from a fraud or education person at a bank or e-wallet. Not verified that one is reachable in time |
| Owner | Deck lead |

## Closing slide

| Item | Content |
|---|---|
| The one message | The two rates, big, from real players |
| Also on it | Team names, live URL, repo, the Google services in one line |
| Owner | Deck lead |

## Checklist before export

- [ ] All seven sections present, in order
- [ ] Every number traced to `docs/prd.md` with its source; nothing unconfirmed on a slide
- [ ] No real brand logo or look-alike colour on any slide; real brands named in text only
- [ ] Every app screenshot shows the practice label
- [ ] Architecture slide names every Google service in the live build and shows the approval step
- [ ] Every item from a cut slice replaced by its stated substitute
- [ ] English only
- [ ] Exported to PDF and opened once on a phone

## Video beat sheet (under 3 minutes; aim for 2:50)

Real product on screen from the 10 second mark. Say which Google tool does what.

| Time | On screen | Voice-over |
|---|---|---|
| 0:00 to 0:10 | The link opens; the country is picked from the time zone; the three apps for that country appear (slice 2) | "Open it anywhere in JAPAC. It knows which apps scams use where you live" |
| 0:10 to 0:40 | Day one, first card: "friend or family in trouble" on a new number inside a chat look. The player verifies by calling the known number. Then the tell tap: new number, urgency, money ask light up (slice 3) | "You never label. You act, then you tap what gave it away" |
| 0:40 to 1:05 | The real twin arrives: an ordinary message from the same person. The player replies. Wallet and people shown intact | "Every scam has a real twin. Trusting the real ones is scored too" |
| 1:05 to 1:45 | The call, last card of the day: the caller pushes, the meter moves, the player taps "Hang up and call the official number" (slice 8, inside the submittable build; slice 9 if the live caller shipped, otherwise the scripted call) | If live: "The caller is `gemini-3.8-live`, reading beats written before the call. Code moves the meter." If scripted: say it is `gemini-3.8-flash-tts` |
| 1:45 to 2:10 | End of day: money kept, people kept, the collection by category, the tell to work on. Then the lesson, side by side (slice 3) | "Gemini explains. Code keeps the score. Same answers, same score" |
| 2:10 to 2:30 | The country switch to a second country with different apps; the language picker (slice 6; if cut, country switch only) | "Twenty-plus countries, every JAPAC language, one deck model" |
| 2:30 to 2:50 | The agent graph, then the approval page with a "new this week" trick (slice 10; if cut, the catalogue file and the Guard output) | Name the live agents and Google services in one breath. A person approves every pattern |

Recording notes:
- English voice-over throughout, with English subtitles. Translated play on screen only if the organizer has confirmed in-app languages are fine; otherwise record with the app in English.
- Record on a real phone, not a desktop browser.
- Record a full backup take of the scripted call in case the live call misbehaves.
- No real names, numbers or faces of people who have not agreed to appear.
- Keep it under 3:00 with margin.
- Public link on YouTube, Vimeo or Google Drive. Open it in a private window to confirm it is public.
