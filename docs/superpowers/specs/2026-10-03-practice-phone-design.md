# Practice phone: design spec (3 Oct 2026; Languages subsection and consistency fixes added the same evening)

Working title "Scam Master", name pending. This spec records the decisions of 3 Oct 2026 and wins over any older doc in `docs/` where they disagree. Source material: the two scam catalogues in `docs/sources/` (the team's content research, October 2026), the skin-viability research, and the kill-test findings in `docs/kill-test.md`.

## 1. Purpose and audience

A practice phone for spotting scams. Anyone in the JAPAC region, any age, opens a link and plays a day on a phone that looks like theirs: the apps people in their country use, the scams that arrive there, and the real messages in between. You act, you never label. Code keeps the score; Gemini writes the day and explains the tells.

Cup entry: AI Builder Cup 2026, theme 1 (banking, finance and fraud). Deadline 18 Oct, freeze 16 Oct.

| Rubric | Weight | What earns it |
|---|---|---|
| Technical merit and Gen AI | 40 | Six agents with one job each; a live voice caller; scenarios generated from official advisories with Search grounding; scoring in code with the model only explaining; structured output with constrained fields; cached fallbacks that survive the judging window |
| Problem fit and impact | 25 | Whole-JAPAC coverage from one deck model; country packs with official statistics and hotlines; the two-sided score (scams caught, real messages trusted) as the measure |
| Innovation | 25 | A day dealt from a country deck; spot the tell on the screen itself; the call as a boss fight with a confidence meter; "new this week" from live advisories; the apps change with the country |
| UX and design | 10 | A judge reaches a scored card in under 60 seconds; nothing typed; built for any age |

## 2. The game: a day on your phone

- **A day** deals four cards from the country deck, then the call. The **quick day** (first-time players, judges) deals two cards and no call; it finishes in about 60 seconds without a microphone.
- **Day one** always includes the card "Friend or family in trouble", because it is major in six countries and both ages.
- **Stakes:** a wallet and the people who count on you. A scam you fall for drains the wallet. Blocking or ignoring a real person has a consequence shown on screen (the boss's deadline slips, your child waits at the airport).
- **Act, never label.** Each card is one decisive moment. The buttons are the real options: reply, ignore, block and report, verify by calling the number you already know, pay, and the buttons the scam itself offers (open the link, send money, share the code, install, keep it secret). No "real or fake?" prompt ever appears.
- **Spot the tell.** After acting, the player taps the parts of the message that gave it away. Each tappable part carries a tell id (section 3). Finding the tells turns the card over: it joins the collection under its category A to J, shown beside its real twin.
- **End of day:** money kept, people kept, tricks collected ("7 of 16 in Singapore"), the one tell most often missed, which returns harder tomorrow.
- **New this week:** a trick that appeared in that country's advisories since the last Scout run shows a "new this week" mark and its source link.
- **Video-call variant:** the "friend or family" card can arrive as a video call with "camera broken, voice only". Underneath it is the same voice call as section 8; the broken camera is itself a tell (synthetic identity).

## 3. The deck

### The 16 common patterns (first cards)

| # | Card | Major in |
|---|---|---|
| 1 | Friend or family in trouble | Singapore, India, Australia, Hong Kong, Indonesia, Philippines |
| 2 | Paid-task job | Singapore, Malaysia, Indonesia, Philippines, India, Hong Kong, Australia |
| 3 | Investment mentor or trading group | Singapore, Hong Kong, Malaysia, Australia, India |
| 4 | Police, court, or digital arrest | India, Singapore, Malaysia, Hong Kong |
| 5 | Code, QR, or rented account | India, Indonesia, Malaysia, Philippines, Singapore |
| 6 | Parcel fee or address problem | Indonesia, Malaysia, India, Philippines; common in Singapore, Australia |
| 7 | Bank, KYC, or wallet check | India, Indonesia, Philippines, Bangladesh, Sri Lanka, Singapore |
| 8 | Buyer or seller who leaves the listing | Philippines, Malaysia, Indonesia, India, Australia, Hong Kong |
| 9 | Fast romance, then a bill | Australia, Malaysia, Philippines, India |
| 10 | Video, then a threat | India, Philippines, Malaysia, Indonesia, Australia |
| 11 | App or document in the chat | India, Indonesia; Singapore malware cases |
| 12 | Boss or supplier changes the payment | Singapore, Hong Kong, Australia, Malaysia |
| 13 | Prize that needs a fee | India, Philippines, Bangladesh, Sri Lanka, Nepal, Indonesia |
| 14 | Loan fee or debt threat | Indonesia; present in Philippines, India, Singapore |
| 15 | Overseas job that takes the passport | Philippines, Indonesia, India, Nepal, Bangladesh, Myanmar |
| 16 | Refund that is actually a payment | India; present in Singapore, Malaysia |

### The long tail

The expanded catalogue's 67 entries, in ten categories, are the match list for the Scout. A new advisory is matched to one entry and surfaced as a variant of one of the 16. The collection screen uses the same ten categories:

A Employment, task and income · B Investment and financial growth · C Phishing, account takeover and identity theft · D Delivery, shopping and payment · E Romance, social and exploitation · F Government, institutional and authority impersonation · G Travel, education and event · H Charity, crisis and unexpected money · I Business and organisational fraud · J Data harvesting and device compromise

### The tell taxonomy (nine ids, from the cross-cutting mechanics)

| Tell id | Shows up as |
|---|---|
| `trust_building` | fake testimonials, group members, professional branding, a small first payout, affection |
| `urgency` | a deadline, "today", an expiring parcel or points, an emergency, a threat |
| `isolation` | keep it secret, don't tell family or colleagues, move to a private chat |
| `escalation` | a small payment, then a bigger one, then an unlock, tax, verification or recovery fee |
| `authority` | a bank, police, government, CEO, celebrity, school, courier or regulator as the sender |
| `payment_substitution` | crypto, gift cards, QR codes, a personal account, cash handover |
| `credential_theft` | a request for an OTP, password, PIN, card number, login, recovery code, ID copy or screen share |
| `platform_migration` | started on social media, a dating app, a job portal or SMS and moved to a private chat |
| `synthetic_identity` | stolen photos, a made-up employment history, an AI voice or face, "camera broken" |

Each generated scam carries the tell ids planted in it, attached to the message parts where they sit. Real messages carry none.

### The card model: one decisive moment

| Part | Rule |
|---|---|
| Setup | A slow scam gets a two-sentence setup; a fast one none |
| The ask | One message or one call turn that asks for the decisive action |
| Safe replies | Refuse; check through a number or app the player already trusts; report |
| Unsafe replies | Pay; send a code; open the link; hand over access; agree to keep it secret |
| Usual ending | What happens if they comply, shown in the lesson |

### Per-country lines

Each country pack carries its channel line and confidence from the catalogue (for example "Singapore, WhatsApp, high confidence: task jobs, investment groups, government impersonation, hijacked friends, phishing"). Confidence shows in the app as "from police statistics" (high) or "based on usage" (medium, low). The pack's deck order follows that line; cards not listed for a country are still dealt, less often.

## 4. Real messages

- Every scam has a real twin of the same kind, generated together: a real parcel update and a fake release fee; a real bank alert and a fake lock-out; a real "which gate?" from a courier and a fake one; a real message from someone you know and an impostor on a new number.
- Ordinary messages (a group plan, a receipt, a reminder) arrive between cards. Some real messages sound urgent, because real life does.
- A four-card day holds at least two real messages; a two-card quick day holds at least one.
- Two scores, always shown together: scams caught (of the scams shown, how many handled with a safe reply) and real messages trusted (of the real messages shown, how many handled with an acceptable action). Blocking everything fails the second; trusting everything fails the first.
- The lesson shows the real and the fake side by side with the differences marked, what that institution or person never asks for, the usual ending, and the country's hotline and reporting link.

## 5. Countries, apps and language

- Every JAPAC country is selectable. Countries without a reviewed deck show "deck coming" and still appear in the list.
- Country choice: time zone first (no prompt), then "Use my location" only when the zone is ambiguous (resolved to a country through Google Maps Geocoding, then discarded), then a manual override that always wins. No location is stored.
- The pack names the three apps scams arrive on in that country, from the catalogue's "where people meet them":

| Country group | First chat look | Then |
|---|---|---|
| India, Indonesia, Singapore, Malaysia, Hong Kong, Australia, New Zealand, Bangladesh, Sri Lanka, Nepal, Brunei, Macau | green-chat | cloud-chat or blue-chat per pack, text messages, e-wallet or bank |
| Philippines, Myanmar, Fiji | Viber-style look (purple family of the chat component) | green-chat, e-wallet |
| Japan, South Korea, Taiwan, Thailand, Vietnam | sticker-chat | text messages, e-wallet, phone call |
| Papua New Guinea | blue-chat | green-chat |
| Cambodia, Laos | green-chat | text messages; their decks lead with the overseas-job card as destination |

- Seven layouts: green-chat, blue-chat, sticker-chat, cloud-chat (and the Viber-style look as a fifth variant of the same chat component), text messages, email, e-wallet. The five chat looks are one component with five sets of header colour, bubble shape, read indicator, sticker row and call banner.
- Build order: the chat component with its five looks, text messages, e-wallet, the call screen, email, cloud-chat polish. Layouts not finished by the freeze show as "coming soon" tiles inside the packs that use them.
- Language: every JAPAC language is live (decision added later on 3 Oct, replacing the earlier "English only" line; see Languages below). No Philippine-specific treatment anywhere in the app, docs, deck or pitch.

### Languages (added 3 Oct 2026, evening)

- Cards are written and approved in English once. The Translator (the sixth agent, `gemini-3.8-flash` with structured output) translates each approved card, its real twin and its lesson part by part, keeping every part id and tell id so the tappable tells stay tagged. The Guard runs on every translation.
- A separate language picker lists every JAPAC language, all live. Every card and lesson in a translated language shows a "translated by AI" note beside a one-tap "this reads wrong" button, which increments a counter on that translation record. A language a reviewer has read shows "reviewed" instead.
- The voice call stays English for the Cup; non-English calls are untested.
- Kill test A3 checks translation of an approved English card into two JAPAC languages with every part id intact.

## 6. Skins and brand rules

From the viability research (primary sources in `docs/compliance.md`):

- Layout conventions only, each with an invented name, no logo, no real brand's colours, typeface or icons.
- Avoid: WhatsApp green and the blue double ticks; Viber purple #7360F2 and #655CAC and the phone-in-bubble icon; the Google palette, Google Sans and any Gmail-only affordance (the envelope mark, Gmail-specific controls). The email app uses what every mail client shares: list, avatar, subject and snippet, an overflow menu with "Report spam" and "Report phishing".
- The practice label "Practice. Not a real message." sits in the same viewport as every mock. Calls say "Practice call".
- Every screen also carries the non-affiliation sentence used by Google's own scam game: "To make scenarios realistic, we may mention real platforms or services. These references are for illustrative purposes only and do not imply any affiliation, endorsement, or criticism."
- Fake links are plain text spans, never anchors. Nothing navigates; nothing is sent.
- Real brands appear only in plain text in lessons ("this is how it looks on WhatsApp").

## 7. Ages, sign-in and privacy

| Topic | Rule |
|---|---|
| Age screen | First screen: "18 or older" or "under 18" |
| Under 18 | Plays reviewed cached scenarios only. No live generation, no sign-in, no call of any kind (live or scripted). Nothing is written server-side for this age group: the day is served from the cache and progress stays on the device |
| Guest | Everyone plays the first day as a guest on a random device id held in the browser |
| Sign-in | Offered on the end-of-day screen to 18-or-older players: "Sign in with Google to keep your progress across devices". Firebase Authentication, Google provider only. Stored: Google user id and email. Guest progress is linked to the account |
| Typed input | None anywhere in the app. No field accepts a password, PIN, one-time code, card number, account number or phone number |
| Decks and notes | Firestore, until replaced by a newer approved version |
| Scenario cache | Firestore, until replaced |
| Days played | Firestore, under device id or user id: actions, tells tapped, scores. 30 days |
| Progress | Firestore: tricks collected, missed tells, difficulty. Until "Delete my data" |
| Call audio | Never stored |
| Call transcript | Server memory until the lesson is shown, then deleted |
| Logs | Scenario ids, card ids, tell ids. Never message text, never who played |
| Delete my data | Removes days, progress and the Google id and email record for that device or user, and signs out |
| Privacy notice | One screen: the table above in plain words, plus: fonts load from Google Fonts, Google sign-in is handled by Firebase, location is never stored, practice content is AI-generated and reviewed by a person |

## 8. The call

- The last card of a full day: the trick the player handled worst that day. Quick days skip it. A day can always be finished without a microphone.
- **Screen:** the practice-call banner, the invented institution and masked number (`09XX-XXX-dddd` pattern or the country's equivalent), the confidence meter across the top, the practice code (a word, never digits), and six buttons: Ask for a reference number, I'll call you back, Refuse the code, Read the code, Hang up, Hang up and call the official number.
- **Meter:** moved only by code, per beat. Reference number, call back, refuse: down one step. Read the code, agree to pay: up. Silence for a few seconds: up a little. Full meter: the scam succeeds, the wallet takes the hit. Empty meter: the caller gives up, the trick is collected.
- **Caller:** `gemini-3.8-live` in the browser on a locked short-lived token, voicing beats the Director wrote from the card, calling `next_beat(player_reaction)` and `end_call(outcome)`. The player's speech is heard so the call feels real; it is never scored. Scored action and scored tells come only from buttons and taps.
- **Hard stops** in the persona instructions: never ask for a real one-time code, PIN or account detail; refer only to "the practice code on screen"; end the call when the player says they will call the official number; stay inside the exercise if asked for anything else; stop at three minutes.
- **Limits:** three minutes per call; tokens limited per device and per IP.
- **Fallback:** the same beats through `gemini-3.8-flash-tts` with the same buttons and meter. Same scoring. A refusal, a bland caller, a 503 or a token failure all land here.
- **Gate:** kill test A (a person on a microphone, in English) decides whether the live caller ships. The scripted call is built first, so the boss fight exists by the submittable line either way.

## 9. Architecture

One Cloud Run service in asia-southeast1 (Node, Express, serving the Vite React app and `/api`). Secret Manager holds the Gemini key and the Maps key. Models through the Gemini Developer API on the Tier 1 key of the Cup project.

| Agent | Model | One job |
|---|---|---|
| Scout | `gemini-3.8-flash` + Google Search grounding, URL context | Reads each country's official advisories, matches each to a catalogue entry, writes a pattern note in English (the shape in `shared/types.ts`: setup, ask, tells, replies, usual ending, real twin, confidence, source). Runs weekly on Cloud Scheduler and on demand. Never writes message text |
| Approval page | a person | Approves or rejects each note. Only approved notes reach the deck |
| Director | `gemini-3.8-flash`, structured output | Turns an approved note into a card: the scam message with its tells attached to parts, its real twin, the call beats. Names, numbers and institutions are constrained fields from the brand registry, never free text |
| Guard | code | Rejects real brand names (whole-word match; "grabbed" contains "Grab" and must pass), unmasked numbers, live links, unknown tell ids, real messages with tells. One regeneration, then a cached card |
| Translator | `gemini-3.8-flash`, structured output | Translates an approved English card part by part into a target language, keeping every part id and tell id; the Guard runs on the result. Never translates an unapproved card |
| Caller | `gemini-3.8-live` | Voices the call from the Director's beats (section 8) |
| Coach | `gemini-3.8-flash` | Writes the side-by-side lesson after code has scored. Never scores |

Other services: Firestore (decks, pattern notes, cache, translations, days, progress), Firebase Authentication (Google sign-in), Google Maps Geocoding (optional location), `gemini-3.8-flash-tts` (scripted call), Cloud Scheduler (weekly Scout).

**Flow of a day:** app asks for a day with country and age group → server deals from the cached, approved cards for that country (generation and review happen ahead of time, never while a player waits) → player acts and taps tells → each action and tap is scored in code on the server → Coach writes the lesson → end-of-day screen → sign-in offer.

**Failure paths:** model error, refusal or empty output → cached card; a 503 → one try on `gemini-3.6-flash` through the same Guard, then cache; live caller unavailable → scripted call; quota → budget alert, cache keeps serving. The judging window runs entirely on reviewed cached content.

**Keys and capacity:** a free-tier key hit "limit: 20" requests a day on `gemini-3.8-flash` and returned "503 high demand" on most calls during kill test A2 on 2 Oct. The app uses the Tier 1 key only; the 503 fallbacks are required, not optional. Free-tier content may be used to improve Google products, which also rules it out.

## 10. Scoring

- `shared/score.ts`: a pure function scores each action against the card's safe and unsafe replies, and each tell tap against the planted tells (caught, missed, false). No model is involved.
- Per day: scams caught rate, real messages trusted rate, money kept, people kept.
- Difficulty: the tells a player misses most come back more subtly (fewer, better hidden) the next day; the level moves up when both rates are high and down when the catch rate is low. Starting thresholds are tuned in playtests.

## 11. Policy guards in code

| Rule | Where enforced |
|---|---|
| Practice label and non-affiliation sentence on every screen | `PhoneShell` wraps every route and renders both |
| No typed input anywhere | `scripts/check-policy.sh` fails the build on any `<input>` or `<textarea>` |
| No real brand names, colours or icons | brand registry in `shared/brands.ts`; the Guard's whole-word denylist; the policy check on source |
| Fake links are text, never anchors | message renderer emits spans; policy check greps for `href` in scenario components |
| Scam text never in the repo | the repo holds pattern notes, never messages; generated cards live only in Firestore; fixtures are real messages or bracketed placeholders |
| Generation on the server only; no player can request scam text | no client route reaches a model; the browser holds only the live-call token |
| Model never scores | `shared/score.ts` with tests; the Coach runs after scoring |
| Refusals never reworded | a refusal returns a cached card or the scripted call; no retry-with-rephrase path exists |
| Under 18 never reaches a model | the day endpoint serves cache only for that age group; sign-in and call routes reject it |
| No non-Google AI SDK | policy check on `package.json` |
| No export, copy or screenshot-friendly receipt | no copy, share or download controls; the policy check greps for them |

## 12. Out of scope for the Cup, and after

Out of scope: non-English play, decks for countries without a reviewer, a native app, bank or sponsor editions, analytics beyond the two rates, leaderboards, any typed personalisation.

After the Cup: the web app is installable from Safari ("Add to Home Screen") for the Cup; later it is wrapped with Capacitor, built on a cloud Mac, signed under an Apple Developer membership and shipped through TestFlight to the App Store. The invented skins already avoid App Store rules 4.1 and 5.2.5. Capacitor, cloud-build and Apple steps are not verified today.

## 13. Open questions and not-verified items

Organizer questions (asked by the Builder on the Cup Discord): the submission hour and timezone on 18 Oct; whether the Gemini Developer API on Cloud Run counts as the Google Cloud stack; whether "English only" covers in-app content; whether the roster cutoff is 4 or 11 Oct.

Not verified:
- The Singapore figures in the catalogue (about S$170 million lost to investment scams in the first half of 2026; about 41% of digital-arrest victims aged 65 or older): confirm at the Singapore Police mid-year brief of 26 Aug 2026 before any slide.
- Firebase Google sign-in popup versus redirect inside an installed iPhone web app.
- Whether the live caller waits for `next_beat` (live function calls are non-blocking by default).
- Whether Cloud Run's source build picks Node 24 without the Dockerfile; the Dockerfile has not been built yet.
- The trade-dress legal question for layout-only skins (needs counsel before any store launch).
- Taglish-free status of every existing doc and the slice 1 strings: to be swept in the rework pass.
