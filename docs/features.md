# Scammer Survivor: features

A practice phone for spotting scams, for everyone in the JAPAC region, any age. You play a day on your phone: keep your money, keep your people, beat the caller. Code keeps the score; Gemini writes the scenarios and explains the tells. Last updated 3 October 2026.

## The game: a day on your phone

- Every country has a deck of scam tricks. The deck is organised in ten categories: employment and task scams; investment; phishing and account takeover; delivery, shopping and payment; romance and social exploitation; government and authority impersonation; travel, education and events; charity, crisis and unexpected money; business fraud; data harvesting and device compromise.
- The 16 most common patterns across JAPAC are the first cards a player meets, weighted by country: friend or family in trouble, paid-task job, investment group, police or digital arrest, code or QR or rented account, parcel fee, bank or wallet check, buyer or seller off the listing, fast romance, video then a threat, app in the chat, boss changes the payment, prize with a fee, loan fee or debt threat, overseas job, refund that is a payment. Sixty-seven documented variants form the long tail.
- Each trick knows which app it arrives on in that country and which real message it hides behind. Every card is one decisive moment: a short setup, the ask, and the usual ending if you comply.
- A day deals four cards from the deck, plus the call. The quick day deals two. Everyone meets "friend or family in trouble" on their first day. The phone clock runs from morning to night. The apps people in that country actually use light up in turn. The wallet and your people are the stakes.
- You act, you never label. Reply, ignore, block and report, verify by calling the number you already know, pay, or tap one of the buttons a scam offers (the link, send money, share the code). Falling for a scam drains the wallet. Blocking or ignoring a real person has consequences: the boss's deadline slips, your child waits at the airport.
- Spot the tell: tap the exact thing on screen that gives a scam away. The nine tells are the mechanics every scam runs on: trust-building, urgency, isolation, escalation, authority, payment substitution, credential theft, platform migration, synthetic identity. Finding one turns the card over and adds that trick to your collection, shown beside its real twin.
- The call is the last card of the day: a voice caller (live on Gemini if kill test A passes; otherwise the scripted caller with the same buttons and meter) plays the trick you were weakest at, with a confidence meter that falls when you make a good move and rises when you hesitate. One variant arrives as a video call from a "relative" whose camera is broken, which is itself a tell.
- End of day: money kept, people kept, tricks collected by category ("Investment: 2 of 4"), and the one tell you keep missing, which comes back harder tomorrow.
- This week's tricks: a trick that appeared in the advisories this week shows up in the deck with a "new this week" mark and its source.
- Quick day for first-time players and judges: two cards, no call, about 60 seconds, no microphone needed.

## Real messages matter

- Every scam has a real twin of the same kind, and they arrive in random order with ordinary messages between them. A real parcel update next to a fake release fee; a real bank alert next to a fake lock-out; a real "which gate?" from a courier next to a fake one; a real message from someone you know next to an impostor on a new number.
- Real messages are ordinary on purpose, and some sound urgent, because real life does.
- Two scores shown together: scams caught, and real messages trusted. Blocking everything fails the second; trusting everything fails the first.
- Tells are data, not opinion: each generated scam carries the tells planted in it, and code compares them with what the player tapped. Gemini never decides a score.
- The lesson shows the real and the fake side by side with the differences marked, what that institution or person never asks for, and the country's hotline and reporting link.

## Countries, apps and languages

- Every JAPAC country is selectable. The country is read from the phone's time zone and shown with a Change link. "Use my location" is offered only when the zone is ambiguous; it resolves to a country through Google Maps and is thrown away. No location is stored.
- Each country pack names the apps most scams arrive on there, from the team's content research and official statistics, with a confidence label shown in the app: "from police statistics" or "based on usage". WhatsApp countries (India, Indonesia, Singapore, Malaysia, Hong Kong, Australia, New Zealand and others) start on the green-chat layout; the Philippines, Myanmar and Fiji lead with the Viber-style look; Japan, Korea, Taiwan, Thailand and Vietnam play on the sticker-chat layout where LINE, KakaoTalk and Zalo live.
- Seven app layouts exist, each with an invented name and its own colours: one chat component with five looks (green, blue, sticker, cloud, purple), plus text messages, email and e-wallet.
- Decks are built by an agent that reads the advisories and writes pattern notes; a person approves every note before any scenario built from it can be shown. Countries without a reviewed deck are listed with "deck coming".
- Every JAPAC language in the picker is live. Scenarios are written and approved in English once, then Gemini translates the approved scenario, its real twin and the lesson into the player's language, part by part so the tappable tells stay tagged. Each such language shows a "translated by AI" note and a one-tap "this reads wrong" button; a language a reviewer has read is marked "reviewed". The voice call stays English for the Cup.

## Ages, sign-in and privacy

- Anyone can play. The first screen asks "18 or older" or "under 18". Under 18 plays reviewed cached scenarios only: no live generation, no sign-in, no call of any kind.
- The first day plays as a guest. Sign in with Google (Firebase Authentication) to keep progress across devices. For the account the app keeps the Google user id and email, nothing else from the profile; days played and progress are stored as described under privacy.
- "Delete my data" removes the player's days, progress and the Google id and email record, and signs out.
- Nothing is typed anywhere in the app. No field ever accepts a password, PIN, one-time code, card number, account number or phone number. There is no family or contact setup.
- Every screen carries the label "Practice. Not a real message." and the sentence "To make scenarios realistic, we may mention real platforms or services. These references are for illustrative purposes only and do not imply any affiliation, endorsement, or criticism." Calls say "Practice call".
- Scenario generation runs on the server only. Players cannot request scam text, and nothing can be copied, shared or exported. Fake links are plain text, never real links.
- Call audio is never stored. A call transcript lives only until the lesson is shown.

## The made-up apps

- Each layout follows the conventions people know from the real app, with an invented name, no logos, none of the real brand's colours, typefaces or icons.
- Real brands appear only in plain text: "this is how it looks on WhatsApp", and the non-affiliation sentence above.

## The practice call

- The caller plays a trick from the country's deck as that country's institution type (a bank officer, a parcel depot, a government office), with an invented name, in English for the Cup.
- The confidence meter falls when the player asks for a reference number, says they will call back, or refuses the code; it rises when they hesitate. The scam succeeds if the meter fills.
- The screen shows a practice code that is a word, never digits, and a "Read the code" button; pressing it is the wrong move. Speech never changes the score.
- Hard stops: the caller never asks for a real one-time code or PIN, and ends the call when the player says they will call the official number.
- Hang up, or hang up and call the official number, ends the call. A scripted version with reply buttons plays when the live caller is unavailable.
- Calls are capped at three minutes and limited per device.

## Scoring and difficulty

- A plain function scores every action and every tell tap against the data planted in the scenario.
- Two rates per day: scams caught and real messages trusted, plus money kept and people kept.
- The tells a player keeps missing come back more subtly the next day.

## What runs where

- One service on Google Cloud Run (Singapore region) serves the app and its API. Secret Manager holds the API key.
- Gemini 3.8 Flash writes scenarios and lessons, and reads advisories with Google Search grounding. Gemini 3.8 Live voices the call. Gemini 3.8 Flash TTS reads the scripted fallback.
- Firestore stores decks, days, progress and the scenario cache. Firebase Authentication handles Google sign-in. Google Maps Geocoding resolves the optional location. Cloud Scheduler runs the weekly advisory check.
- If a model is unavailable, the app serves a reviewed cached scenario instead of a blank screen.

## After the Cup

- Installable on an iPhone home screen from Safari for the Cup. Then wrapped as a native iOS app for the App Store.

## Sources

- The team's content research, October 2026: a ranked catalogue of the 16 most common WhatsApp and Viber scam patterns across JAPAC with per-country channels and confidence, and an expanded 67-entry catalogue in ten categories with nine cross-cutting mechanics. Built from Singapore Police Force briefs, Scamwatch Australia, India's cybercrime coordination centre and Philippine agency advisories.

## Change log

- 3 Oct 2026 (night): all JAPAC languages live through AI translation of approved English scenarios, with a "translated by AI" note, a "this reads wrong" button, and a "reviewed" mark where a reviewer exists. Voice call stays English for the Cup.

- 3 Oct 2026 (evening): the deck is now built from the team's scam catalogues: ten categories, 16 first cards, 67 variants, nine tells. Four cards a day plus the call; "friend or family in trouble" seeded on day one; video-call variant with a broken camera. Confidence labels per country.

- 3 Oct 2026 (later): the game is now a day on your phone dealt from a country deck of tricks, with spot-the-tell on each message and the call as the last card. Family mode removed; nothing is typed in the app. Seven app layouts, chosen per country by where scams arrive there. Under-18 mode on cached content. Non-affiliation sentence added to every screen. Fake links are plain text.
- 3 Oct 2026: scope changed to the whole JAPAC region, English-only for the Cup. Google sign-in after the first round. Country from time zone with location as fallback. Real-and-scam pairs.
- 2 Oct 2026: first version of the features, from the product and UX plans.
