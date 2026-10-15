# App readiness: what a real app needs beyond the Cup prototype

The Cup prototype has to work, be honest, and be safe. A real app in a store needs more. This is the checklist. "When" says whether an item is needed for the Cup (Oct 18) or only before a store launch. Rewritten 2026-10-03 to match the design spec.

Nothing here is legal advice. Items marked "lawyer" go to an IP or privacy lawyer in the launch markets before any store launch.

## Legal pages

| Done | Item | When | Notes |
|---|---|---|---|
| [ ] | The practice label on every screen ("Practice. Not a real message."; "Practice call" on calls) | Cup | A product rule: the banner sits in the one `PhoneShell` that wraps every route |
| [ ] | The non-affiliation sentence on every screen | Cup | "To make scenarios realistic, we may mention real platforms or services. These references are for illustrative purposes only and do not imply any affiliation, endorsement, or criticism." |
| [ ] | Age screen before first play: 18 or older, or under 18 | Cup | Gemini API terms: "You must be 18 years of age or older to use the APIs." Source: https://ai.google.dev/gemini-api/terms. Under 18 never reaches a model |
| [ ] | Short privacy notice in plain words | Cup | What is stored, for how long, how to delete. One screen, linked from the home screen |
| [ ] | AI-generated content notice | Cup | "Practice content is written by AI from approved patterns and reviewed by a person." Translated languages add "translated by AI" |
| [ ] | Full privacy policy page with a public URL | Store | App stores ask for the URL (general knowledge, not verified) |
| [ ] | Terms of use page | Store | Lawyer |
| [ ] | Trademark check on the final name and on the invented app names | Store | Lawyer, after the naming step |
| [ ] | Trade-dress opinion on layout-only skins | Store | Lawyer. The viability research found no published rule against layouts; the legal question itself is not verified |

## Data

What the prototype stores, per the spec:

| Data | Where | Kept how long | Personal? |
|---|---|---|---|
| Decks and approved pattern notes | Firestore | Until replaced by a newer approved version | No |
| Scenario cache (cards, real twins, call beats, translations) | Firestore | Until replaced | No |
| Days played: actions, tells tapped, scores | Firestore, under device id or user id | 30 days | Anonymous id, or the Google id after sign-in |
| Progress: tricks collected, missed tells, difficulty | Firestore | Until "Delete my data" | Same |
| Google user id and email | Firestore, after sign-in | Until "Delete my data" | Yes |
| "This reads wrong" taps | A counter on the translation record in Firestore | Until the translation is replaced | Card and language ids only |
| Location | Nowhere | Never stored | Not kept |
| Call audio | Nowhere | Never stored | Not kept |
| Call transcript | Server memory | Deleted once the lesson is shown | Could hold anything said, which is why it goes |
| Logs | Cloud Run logs | Per Cloud Run defaults (not verified) | Scenario, card and tell ids only |

Checklist:

- [ ] Cup: no typed input anywhere. No field accepts a password, PIN, one-time code, card number, account number or phone number.
- [ ] Cup: "Delete my data" removes days, progress and the Google id and email record for that device or user, and signs out.
- [ ] Cup: the Tier 1 key only. On the free tier, content is "used to improve our products". Source: https://ai.google.dev/gemini-api/docs/pricing
- [ ] Cup: call audio never stored; transcript deleted once the lesson is shown.
- [ ] Cup: under-18 players are served cache only; sign-in and call routes reject that age group.
- [ ] Store: written retention periods for each row above, in the privacy policy.
- [ ] Store, lawyer: data-protection registration or consent rules in each launch market. Not verified.

## Content operations

| Done | Item | When | Owner |
|---|---|---|---|
| [ ] | The deck from the catalogue in `docs/sources/`: 16 common cards, 67 variants, nine tells | Cup | Content lead |
| [ ] | Every Scout pattern note approved by a person before the Director uses it | Cup | Content lead |
| [ ] | Every generated card reviewed before it enters the cache a judge can reach | Cup | Content lead, with a second look by the Playtest lead |
| [ ] | Full demo set pre-generated, reviewed and cached before the Oct 16 freeze, for every country shown as ready | Cup | Content lead, Builder |
| [ ] | A way to pull a bad card: disable its note and delete its cached cards and translations | Cup | Builder |
| [ ] | "This reads wrong" queue checked; a reviewed language is marked "reviewed" | Cup (queue), Store (regular review) | Content lead |
| [ ] | "Report this scenario" in the lesson | Store | Builder |
| [ ] | Advisory source list per country, refreshed weekly by the Scout on Cloud Scheduler | Cup | Content lead |
| [ ] | Log of who approved what, with dates | Store | Content lead |

## Quality

Playtest protocol (Playtest lead):

1. Find five players of mixed ages, in more than one country if possible.
2. Each plays three days with no coaching.
3. Record the two rates per player at day one and day three: scams caught and real messages trusted.
4. Write down where they got stuck, in their own words.
5. Repeat after each big change. Before and after numbers go in the deck.

Checklist:

- [ ] Cup: every slice checked on a real phone through the live URL.
- [ ] Cup: the call tested on Android Chrome and on one iPhone.
- [ ] Cup: `npm test` and `npm run check` pass before each deploy.
- [ ] Cup: errors visible in Cloud Run logs. Any model error returns a cached card.
- [ ] Cup: a judge reaches a scored card inside 60 seconds on one device, nothing typed.
- [ ] Cup: Google Cloud budget alert on (Billing, then "Budgets & alerts"; menu name not verified).
- [ ] Store: analytics that count events only (days played, the two rates). No ad SDKs, no advertising ids.
- [ ] Store: an error reporting tool with alerts.

## Accessibility

All of these apply to the Cup build. The rules are in `docs/ux-plan.md`.

- [ ] Body text 18px and up. The phone's own text-size setting is respected; no in-app size control.
- [ ] Contrast 4.5 to 1 or better.
- [ ] Tap targets 48px, well spaced.
- [ ] No countdown timers. Pressure comes from the scammer's words, not a clock.
- [ ] Live captions of the caller during the call.
- [ ] A day can always be finished without a microphone.
- [ ] Screen-reader labels on every control; the phone's reduce-motion setting respected.
- [ ] Store: a full pass with VoiceOver and TalkBack.

## Localisation

- [ ] Cup: English is the base. Scenarios are written and approved in English once.
- [ ] Cup: every JAPAC language in the picker is live through Gemini translation of approved scenarios, part by part so tells stay tagged, with a "translated by AI" note and a "this reads wrong" button.
- [ ] Cup: a language a reviewer has read is marked "reviewed".
- [ ] Cup: the voice call stays English.
- [ ] Cup: deck, video and README in English, with English voice-over and subtitles. The Cup says submissions must be "in English". Source: https://aibuildercup.com/themes.html
- [ ] Store: translated calls, once tested per language.

## Support and reporting

- [ ] Cup: every lesson shows that country's hotline and reporting link from the pack. Each number is confirmed on an official page before it is shown.
- [ ] Cup: a contact email in the README and on the home screen.
- [ ] Store: an in-app "I think I was really scammed" page with official reporting steps per country.
- [ ] Store: a support inbox that someone checks.

## Cost and quotas

Prices from the team's stack research, checked 2026-09-28.

| Item | Price | Note |
|---|---|---|
| `gemini-3.8-flash` text | 0.75 USD in, 3.75 USD out per 1M tokens | Until 2026-12-31, then doubles. Also used for translation |
| `gemini-3.8-live` audio | 0.005 USD per minute in, 0.018 USD per minute out | A 3-minute call about 7 US cents at most |
| `gemini-3.8-flash-tts` | Not verified | Scripted call |
| Search grounding | 5,000 free requests a month, then 14 USD per 1,000 | Plan on linked billing |
| Google Maps Geocoding | Free monthly allowance, then paid (not verified) | Only when the time zone is ambiguous |
| Cloud Run | 2M requests a month free | |

Checklist:

- [ ] Cup: buy API credits before 12 Oct. The Cup project is on Tier 1 prepay; the AI Studio banner says calls fail after 12 Oct until credits are bought.
- [ ] Cup: budget alert set.
- [ ] Cup: calls capped at 3 minutes; tokens limited per device and per IP.
- [ ] Cup: the app stays up from Oct 19 to Nov 6 with nobody watching. Cached cards cover a quota hit; a 503 tries `gemini-3.6-flash` once, then cache.

## iOS path: stage 1, for the Cup

An installable web app. No Mac, no Apple account, no store review. From general knowledge of iPhone Safari, not verified; try it on a real iPhone.

What the build needs: a web manifest, an app icon, a service worker (already in the walking skeleton).

Steps a tester follows on an iPhone:

1. Open the live URL in Safari.
2. Tap the Share button.
3. Tap "Add to Home Screen".
4. Tap "Add".
5. Open the app from its icon. It runs full screen.

Not verified: microphone behaviour inside a home-screen web app, and whether Google sign-in opens as a popup or needs a redirect there. The scripted call needs no microphone.

## iOS path: stage 2, after the Cup

From general knowledge, not verified. Check each line on Apple's and Capacitor's docs before starting.

1. Join the Apple Developer Program: 99 USD a year.
2. Wrap the same web app with Capacitor; one codebase.
3. Build on a cloud Mac service, since the team is on Windows.
4. Set up signing: app id, certificate, provisioning profile.
5. Upload to App Store Connect.
6. TestFlight: internal testers, then outside testers (short beta review).
7. Store listing: privacy policy URL, privacy data form, age rating, screenshots, a review note explaining it is a training simulation.
8. Submit for review.

Review risks, and how the design already avoids them:

| Guideline | Risk | Handled by |
|---|---|---|
| 4.1 Copycats (verified) | Looks like it copies another app | Invented names, logos and colours; layouts only |
| 5.2.5 Apple look-alikes (verified) | A screen like Messages; Apple emoji | No iMessage-style skin; a licensed emoji set |
| 5.2.1 Third-party trademarks (verified) | Real marks without permission | Real brands in plain text only, plus the non-affiliation sentence |
| 2.3.7 Metadata (verified) | Brand names in the listing | "Training simulation, not affiliated with any brand" |
| Minimum functionality (not verified) | A website in a shell | Offline cached days, haptics, a daily practice reminder |
| Microphone permission (not verified) | Vague reason text | "Used only for practice calls. Audio is not stored." |
| Third-party AI disclosure (not verified) | Must say data goes to an AI service | Say practice content is generated and translated with Google Gemini |

Source for the verified rows: https://developer.apple.com/app-store/review/guidelines/

Verify before starting: Capacitor's iOS requirements; the Apple Developer price and enrolment; TestFlight limits; the minimum-functionality wording; the required Xcode version; microphone capture in the Capacitor web view; cloud Mac prices.

## iOS path: stage 3, when to go fully native

Stay on the wrapped web app unless: a bank or e-wallet partner wants the trainer inside its own native app; push-notification drills become the core habit and the wrapper cannot deliver them; practice must work offline with an on-device model; or the call needs lower audio delay than the web view gives.

Caution (our inference): an incoming-call screen that copies the phone's own call screen could run into 5.2.5 and Google Play's rule against mimicking the operating system. Keep the game's own frame.

## Android note

- A web app can ship as an Android app through a Trusted Web Activity (Bubblewrap or android-browser-helper), with Digital Asset Links. Source: https://developer.chrome.com/docs/android/trusted-web-activity
- Google Play rules that apply: Impersonation, Deceptive Behavior, Intellectual Property. Sources in `docs/compliance.md`.

## Not verified

- Everything in iOS stages 1 and 2, and the inference in stage 3.
- Whether app stores require a privacy policy URL; the budget-alert menu name; Cloud Run's log retention; Maps Geocoding pricing; the TTS price.
- The catalogue's 2026 Singapore figures until confirmed at the SPF mid-year brief.
- Data-protection registration and consent rules per market (lawyer); the trade-dress question (lawyer).
- Whether the Cup's "in English" rule covers in-app translated play. An organizer question in `docs/prd.md`.
