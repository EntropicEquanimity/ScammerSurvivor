# Scammer Survivor: product requirements

Rewritten 2026-10-03 to match the design spec (`docs/superpowers/specs/2026-10-03-practice-phone-design.md`) for AI Builder Cup 2026, theme 1 (banking, finance and fraud). Where this file and the spec differ, the spec wins.

Tags: **[V]** read on the source page. **[NV]** not verified: seen only in a search summary, press coverage, or a page that would not load. **[catalogue]** from the team's content research in `docs/sources/` (October 2026); figures in it are confirmed at the named source before they go on a slide.

People appear by role: Builder, Deck lead, Content lead, Playtest lead.

## The problem

People do not lose money because they cannot define a scam. They lose it because, in the moment, they press send themselves, and because the scam arrives in the app they use every day.

| Number | Source |
|---|---|
| 81.8% of Singapore scam cases in 2025 were transfers the victim made; 37,308 cases; SGD 913.1M lost [V] | https://www.police.gov.sg/-/media/SPF/Media-Room/Statistics/Annual-Scams-and-Cybercrime-Brief-2025/Annual-Scam-and-Cybercrime-Brief-2025.pdf |
| People 65 and over lost the most per victim in Singapore: SGD 37,053 [V] | Same SPF brief |
| About S$170M lost to investment scams in Singapore in the first half of 2026; about 41% of digital-arrest victims were 65 or older [catalogue; confirm at the SPF mid-year brief of 26 Aug 2026] | SPF mid-year brief, 26 Aug 2026 (not fetched) |
| Australia lost AUD 2.18B to scams in 2025; older Australians are 17.1% of people and 26.5% of losses [V] | https://www.nasc.gov.au/system/files/targeting-scams-report-2025.pdf |
| 72% of Filipinos were targeted by fraud; 38% lost money; median loss USD 850 (May 2026; check whether 38% is of all respondents or of those targeted) [V] | https://newsroom.transunion.ph/filipinos-face-widespread-digital-fraud-exposure-despite-lower-financial-losses-transunion-finds/ |
| India: digital arrest, KYC, task jobs and account rental are tracked by the Indian Cyber Crime Coordination Centre [catalogue] | I4C advisories, as cited in the catalogue |
| Passive phishing training cut clicks by about 2% across 19,500 staff [V] | https://today.ucsd.edu/story/cybersecurity-training-programs-dont-prevent-employees-from-falling-for-phishing-scams |
| One trial (DeLiema 2025, n=1,191) found the effect of interactive training fades in 2 to 3 weeks [V] | https://www.emerald.com/jfc/article/32/1/77/1243133/What-does-trust-have-to-do-with-it-Training |
| Google's own trial of its scam game (3,000 people in India) found a moderate effect that held at 21 days, scored on 5 scam and 5 real items [V] | https://arxiv.org/html/2503.12341 |

What the numbers say together: reading a warning is not enough; practice has to be interactive, has to repeat, and has to include real messages, or it teaches people to fear their own bank and family.

## Who it is for

Everyone in the JAPAC region, any age. No single country, age group or relationship is the design centre.

| Role | Who | What they want |
|---|---|---|
| Player | Anyone with a phone, in any JAPAC country | To stop falling for the bad messages without becoming afraid of every message |
| Judge | A Cup judge opening the live URL | A scored card inside 60 seconds, nothing typed |
| Later buyer (not in the Cup build) | A bank, e-wallet or regulator that must run fraud education | A number that shows their customers can spot scams |

## The product in three sentences

A practice phone where you play a day: messages and calls arrive in the apps people in your country actually use, some from scammers and some from real people, and you act on each one instead of labelling it. Each scam comes from a country deck built from official advisories, carries the tells planted in it as data, and is paired with a real message of the same kind. Code keeps the score as two numbers, scams caught and real messages trusted, and a voice caller is the last card of the day.

## What it does that Be Scam Ready does not

Be Scam Ready is Google's own free scam game. Google.org funds a USD 5M ASEAN rollout. Sources: https://bescamready.withgoogle.com/ and https://aseanfoundation.org/programme/scam-ready-asean/ [V]. A first look on 2 Oct (`docs/kill-test.md`) found a story game with fixed characters, a dollar balance and collectible trick cards, served in English, with no country choice and no real-message twins.

| Our function | Why it is different | Status |
|---|---|---|
| A day dealt from a country deck | Every country gets the scams and the apps that are real there; the deck grows weekly from official advisories, with a "new this week" mark | Deck from the catalogue; Scout in a later slice |
| Real twins and the trust score | Every scam has a real message of the same kind beside it, and trusting the real ones is scored | Core engine |
| Spot the tell on the screen | The player taps the part of the message that gave it away, not a label | Core engine |
| The call as a boss fight | A live caller that pushes back, with a confidence meter moved by code | Depends on kill test A; scripted fallback first |
| Every JAPAC language | Approved English scenarios translated by Gemini, labelled, with a "this reads wrong" button | Languages slice |

Kill test B confirms this list by playing Be Scam Ready end to end. Pass: at least three rows where ours does something theirs does not, and at least one is not "Gemini wrote it". Result goes in `docs/kill-test.md`.

## Competitors

| Product | What it does | What it lacks | Our answer |
|---|---|---|---|
| Be Scam Ready (Google, Filament Games). https://www.filamentgames.com/blog/game-launch-be-scam-ready-with-google-and-filament-games | Browser story game, characters with a money balance, scams over SMS, video call, email and chat, trick cards [V] | Fixed scripts, one language seen, no country choice, no live caller | Country decks, weekly advisories, live caller, languages |
| Jigsaw Phishing Quiz. https://phishingquiz.withgoogle.com | Email and web scenarios with an explanation after each [NV, press coverage] | Email only, Western brands, no progression | Chat, text and call first; email last |
| Scam Spotter. https://scamspotter.org | Quiz plus three rules for older adults [NV, site returned 403] | Quiz format, no realistic screens | Practice inside phone-like screens |
| Hoxhunt. https://www.citybiz.co/article/911094/hoxhunt-expands-adaptive-phishing-training-to-voice-sms-teams-and-deepfake-video/ | Adaptive AI simulations over email, SMS, voice, deepfake video [V] | Sold to employers only | Free consumer play, any country |
| Baloney AI. https://devpost.com/software/baloney-ai | Gen-AI scam simulation over voice, SMS and chat on Gemini [V] | No real messages mixed in, no country decks | Real twins, trust rate, country decks |
| ScamStage. https://devpost.com/software/scamstage | Practice answering simulated scam calls [V] | Calls only | A whole day across apps |
| PhonyBusiness. https://devpost.com/software/phonybusiness | Adaptive scam calls, aimed at 60+ [V] | Calls only | Chat, text, wallet and call |
| FraudLens. https://devpost.com/software/fraudlens-vd1c4f | 7 channels, 24 fixed cases to sort [V] | Fixed set, label-based | Generated cards, act not label |
| Aegis. https://devpost.com/software/aegis-clk40a | Senior simulator mixing real and fake; 2nd at two hackathons [V] | Single market, no live caller | Region-wide decks, live caller |
| Seecoteen. https://devpost.com/software/seecoteen | Gemini-generated scenarios that get harder [V] | Teens, text only | Any age, voice, country decks |

Crowding, stated plainly: Devpost search returned 83 results for "scam simulator" and 554 for "scam gemini" (team count, 1 Oct). A scam trainer alone is not new. A day dealt from a country deck, with real twins, tell taps and a boss-fight call, is the part no verified project has shipped.

## The game loop

1. Open the link. The country is read from the phone's time zone and shown with a Change link. "Use my location" appears only when the zone is ambiguous; the coordinates are resolved to a country and discarded.
2. Age screen: 18 or older, or under 18. Under 18 plays reviewed cached cards only, with no sign-in and no call; nothing is written server-side for that age group, and progress stays on the device.
3. The pack screen names the three apps scams arrive on in that country, with "from police statistics" or "based on usage". Tap one, or play all three.
4. A day deals four cards, plus the call. The quick day deals two, no call, about 60 seconds. Day one always includes "friend or family in trouble".
5. Each card is one decisive moment inside a made-up app that follows a real app's layout. The player acts: reply, ignore, block and report, verify by calling the number already known, pay, or press a button the scam offers (open the link, send money, share the code, install, keep it secret). No "real or fake?" prompt ever appears.
6. The player taps the tells on the screen. Each tappable part carries a tell id; finding them turns the card over into the collection, by category, beside its real twin.
7. Falling for a scam drains the wallet. Blocking or ignoring a real person has a visible consequence.
8. The call: the last card of a full day, the trick handled worst, with a confidence meter moved by code. Buttons only; speech is heard, never scored.
9. End of day: money kept, people kept, tricks collected by category, the one tell most often missed, which returns harder tomorrow. Sign in with Google is offered here to 18-or-older players.

The action list and the exact checks live in `docs/build-plan.md`.

## The deck

From the team's catalogues in `docs/sources/` [catalogue]: 16 common patterns as the first cards, 67 variants in ten categories (A employment, B investment, C phishing and account takeover, D delivery and payment, E romance and exploitation, F authority impersonation, G travel and education, H charity and unexpected money, I business fraud, J data and device compromise), and nine cross-cutting mechanics as the tells: trust-building, urgency, isolation, escalation, authority, payment substitution, credential theft, platform migration, synthetic identity. Each country line in the catalogue gives the deck order, the apps, and a confidence label. Full tables are in the spec.

## Scoring design

| Rule | Detail |
|---|---|
| Tells are data | Each generated scam lists the tell ids planted in it, attached to the message parts where they sit. Real messages carry none |
| The score is code | A pure function compares the action with the card's safe and unsafe replies, and the tapped parts with the planted tells. Same input, same score |
| Two rates per day | Scams caught: the share of scams handled with a safe reply. Real messages trusted: the share of real messages handled with an acceptable action. Plus money kept and people kept |
| Calls | Scored flags are the beats the server recorded as delivered; the scored action comes only from buttons. The meter is moved only by code |
| Gemini explains, never judges | The Coach writes the lesson after the score exists |
| Answer key stays on the server | The browser never receives planted tells before the player acts |

## Countries, apps and layouts

| Country group | First chat look | Then |
|---|---|---|
| India, Indonesia, Singapore, Malaysia, Hong Kong, Australia, New Zealand, Bangladesh, Sri Lanka, Nepal, Brunei, Macau | green-chat | cloud-chat or blue-chat per pack, text messages, e-wallet or bank |
| Philippines, Myanmar, Fiji | purple-chat (Viber-style) | green-chat, e-wallet |
| Japan, South Korea, Taiwan, Thailand, Vietnam | sticker-chat | text messages, e-wallet, phone call |
| Papua New Guinea | blue-chat | green-chat |
| Cambodia, Laos | green-chat | text messages; decks lead with the overseas-job card |

Seven layouts: the chat component with five looks (green, blue, sticker, cloud, purple), text messages, email, e-wallet. Every layout has an invented name ("[chat app name]" until chosen), no logo, and none of the real brand's colours, typefaces or icons. Build order: chat looks, text messages, e-wallet, call screen, email, cloud-chat polish. Unfinished layouts show as "coming soon" tiles. Every mock sits under the practice label and the non-affiliation sentence; fake links are plain text.

## Languages

Every JAPAC language in the picker is live. Scenarios are written and approved in English once; Gemini then translates the approved scenario, its real twin and the lesson into the player's language, part by part so the tappable tells stay tagged. Each such language shows a "translated by AI" note and a one-tap "this reads wrong" button that queues the scenario for review; a language a reviewer has read is marked "reviewed". The voice call stays English for the Cup. No language gets special treatment.

## Sign-in and privacy

| Topic | Rule |
|---|---|
| Guest first | Everyone plays the first day on a random device id |
| Sign-in | Google through Firebase Authentication, offered on the end-of-day screen to 18-or-older players. Stored: Google user id and email |
| Typed input | None anywhere. No field accepts a password, PIN, one-time code, card number, account number or phone number |
| Stored | Decks and pattern notes until replaced; scenario cache and translations until replaced; days 30 days; progress and the Google id and email record until "Delete my data", which removes all three and signs out |
| Never stored | Location, call audio, contacts. Call transcript lives in server memory until the lesson is shown |
| Logs | Scenario, card and tell ids only |

## Scope for the Cup

The submittable line sits after slice 8 of the build plan: country and age, the day engine, generated and reviewed cards, five chat looks, languages, sign-in and the scripted call are all in the judged build; the live caller, the Scout page and the email layout come after it.

| In | Out |
|---|---|
| Installable web app on Cloud Run | Native iOS or Android (after the Cup) |
| A day with four cards, the quick day, the collection | Leaderboards, payments, subscriptions |
| Country decks for all JAPAC countries, from the catalogue; "deck coming" where unreviewed | Decks hand-written per country |
| Seven layouts with invented names | Any real brand name, logo or colour in a mock screen |
| Every JAPAC language by translation of approved English | Non-English voice calls |
| The call, scripted first, live if kill test A passes | Sending anything to real phones or inboxes |
| Google sign-in after day one | Accounts other than Google; typed personalisation of any kind |
| Under-18 cached-only mode | Model calls for minors |
| Scout with human approval, "new this week" | Players requesting scam content; copy or export of scam text |

## Scalability

| Lever | How it scales | Proof to show |
|---|---|---|
| A new country | A deck line in the catalogue plus the Scout's advisory sources; the apps and hotline are data | The country list with "deck coming" for unreviewed ones |
| A new language | Translation of approved scenarios; a reviewer upgrades the label | The picker and the "this reads wrong" queue |
| A new scam | The Scout matches an advisory to the catalogue; a person approves; the deck shows "new this week" | The approval page with source and date |
| A bank or e-wallet edition (after the Cup) | Decks, lesson copy and the results page are data; a sponsor's name never appears on mock scam screens | One config swap on the slide |
| The two-rate score as proof | Catch rate and trust rate before and after practice | Playtest table |

Cost per day, estimated from list prices (team stack research, 2026-09-28), to be replaced by measured usage: a four-card text day on `gemini-3.8-flash` about USD 0.02 (prices double after 2026-12-31); a 3-minute live call up to about USD 0.07; translation per language per card a few tenths of a cent; cached cards zero; Cloud Run free at demo scale. TTS price not verified.

## Success measures

| Measure | Target | Check |
|---|---|---|
| A judge plays without help | First scored card inside 60 seconds from the URL, one device | Timed run on a clean phone |
| Real people tried it | Five players, any age; both rates at day one and day three | Playtest lead's table |
| The score is trustworthy | Same answers, same score | Unit tests on `shared/score.ts` |
| The app cannot write scams | Zero typed inputs; at least 18 of 20 generated cards pass the Guard; a hostile pattern note returns a cached card | Policy check and Guard count |
| The live URL survives judging | Reviewed cards cached before the Oct 16 freeze; a forced model error still returns a playable day | Force a model error and play |

## Cup gates: actions and owners

| Gate | Action | Owner |
|---|---|---|
| G1, G2 | Register all four as one team on the Hack2skill dashboard by Oct 4 (terms; the site says Oct 11) | Builder |
| G3, G6 | Each member confirms in writing: 21 or over, working professional or founder, living in JAPAC, not a student, on this team only | Builder collects |
| G4 | Gemini on Cloud Run meets the rule as written; organizer confirmation requested | Builder |
| G5 | Fresh code and assets only | Builder |
| G7 | Live URL, public repo, video under 3 minutes, 7-section PDF deck | Builder submits; Deck lead owns deck and video |
| G8 | Stay active on the Cup Discord and dashboard through judging | Deck lead |
| G9 | Submission materials in English, English voice-over and subtitles | Deck lead |
| G10 | Deadline Oct 18; hour and timezone to confirm. Freeze Oct 16 | Builder |
| Billing | The Cup project is on Tier 1 prepay; API calls fail after Oct 12 until credits are bought. Top up before then | Builder |

## Open questions

| Question | For | Asked by | Why it matters |
|---|---|---|---|
| What hour and timezone does Oct 18 close? | Organizer (Discord) | Builder | Not on any public page |
| Is the roster cutoff Oct 4 or Oct 11? | Organizer | Builder | Terms and site disagree |
| Does the Gemini Developer API on Cloud Run count as the Google Cloud stack? | Organizer | Builder | One file changes if Agent Platform is expected |
| Does "English only" cover in-app content or only submission materials? | Organizer | Builder | Decides whether translated play is shown in the video |
| How is the Social Choice prize decided? | Organizer | Deck lead | Decides where the team posts |
| What is the final name? | Team | Deck lead runs a naming step | "Scam Master" can read as teaching scamming |

## Risks

| Risk | Mitigation |
|---|---|
| Gemini refuses the scam caller | Kill test A first; a refusal goes to the scripted call; never reworded |
| The caller is flat | Quality ladder: live improvises from beats, live reads beats closely, scripted |
| Capacity errors (503) during judging | Reviewed cards cached; one try on `gemini-3.6-flash`; Tier 1 key only; budget alert |
| Judges see a copy of Google's game | Country choice, the apps changing, and a tell tap in the first 20 seconds of the video |
| A translation reads wrong | "This reads wrong" button queues review; translations are of approved text only |
| A mock screen looks like a real brand | Invented names and colours, practice label and non-affiliation sentence on every screen, fake links as text |
| The live URL looks like a scam-writing tool | No typed input, server-only generation, Guard, no copy or export |
| One builder, short window | Slices ordered so the prototype gates pass early; everything after is additive |
| Training makes people distrust real messages | The trust rate is scored and shown; at least two real messages per four cards |

## Rubric map

| Feature | Tech (40) | Impact (25) | Innovation (25) | UX (10) |
|---|---|---|---|---|
| Six agents, one job each (Translator included) | Yes | | | |
| Tells as data, score in code | Yes | | Yes | |
| Live caller with function calls to server-written beats, meter in code | Yes | | Yes | Yes |
| Guard with cached fallback and the 503 path | Yes | | | |
| Scout on official advisories with human approval, "new this week" | Yes | Yes | Yes | |
| Country decks and country-specific apps for all of JAPAC | | Yes | Yes | |
| Real twins and the two-rate score with playtest numbers | | Yes | Yes | |
| Every JAPAC language by translation of approved scenarios | | Yes | | Yes |
| A day with stakes, spot the tell, the collection | | | Yes | Yes |
| Buttons only, judge plays in 60 seconds, any age | | | | Yes |
