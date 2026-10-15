# Team questions answered

Questions raised by the team, with the current answer. Mirrors chapter 9 of the team wiki. When an answer changes, the decisions log says why. Updated 3 October 2026.

## What platform or site do we host on?

Google Cloud Run, Singapore region, one service for the app and its API. The Cup requires Cloud Run or Firebase. Cloud Run was chosen because the practice call needs a server that mints short-lived tokens.

## What back end, and how does it talk to Gemini?

A Node server on Cloud Run calls Gemini through Google's official `@google/genai` library. The API key lives in Secret Manager and never reaches the browser; for the live call the browser receives a short-lived token instead. Firestore stores decks, scenarios, days and progress. Firebase Authentication handles Google sign-in. Google Maps Geocoding resolves the optional "use my location".

## What theme or style?

Two layers. The game frame follows iPhone layout conventions with the glass look (decided 9 October 2026): the device's own system font, translucent surfaces over a generated wallpaper, a lock-screen style notification stack, a home grid with generated app icons and a dock. Body text 18px and up, no red in the frame. Layout only: no Apple assets, no Messages-style look. The made-up apps inside follow the real apps' layouts with our own names and colours. A different visual direction for the frame is possible if the team sends a reference before the chat looks are built.

## How many scams and platforms do we simulate?

Sixteen common cards first, with 67 variants in ten categories behind them, from the team's scam catalogues in `docs/sources/`. Seven layouts: five chat looks (green, blue, sticker, cloud, purple), text messages, email, e-wallet, plus the phone call with a video-call variant. Each country deals the apps most scams arrive on there.

## How do we collect data?

Only what the game needs to score: actions taken, tells tapped, and scores per day, under an anonymous device id or the Google id after sign-in. Nothing is typed anywhere. No location, no call audio, no contacts. Playtests record the two rates (scams caught, real messages trusted) at day one and day three. No advertising or tracking kits.

## What is the MVP before we can start testing?

The day engine with four reviewed cards, spot the tell, and the end-of-day screen, reachable on a Cloud Run link from a phone. The walking skeleton (phone frame, practice label, one real message, scoring in code) already runs locally; the day engine is the next slice.

## Which legal documents and agreements?

- In the app for the Cup: a privacy notice, the practice disclaimer and the non-affiliation sentence on every screen, the 18-or-older screen. A terms-of-use page is added for the store release.
- For the Cup: the organizer's terms, including a six-month right of first refusal on an exclusive licence of the entry.
- Before any app store: a trademark check on the invented app names and a lawyer's read of data-protection rules in the launch markets.
- All rules with their source links: `docs/compliance.md`.

## Accessibility options

Text 18px and up, tap targets 48px, contrast at least 4.5 to 1, no countdown timers, captions on calls, screen-reader labels, reduced motion respected, the phone's own text-size setting respected. These apply to the Cup build.

## Language options

Every JAPAC language in the picker is live. Scenarios are written and approved in English once, then Gemini translates the approved scenario, its real twin and the lesson into the player's language, with a "translated by AI" note and a one-tap "this reads wrong" button. A language a reviewer has read is marked "reviewed" instead. The voice call stays English for the Cup until tested in other languages. No single language gets special treatment.
