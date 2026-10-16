# Agent lessons

Every row is something the Builder caught that an agent should have caught first. Each one is now a mandatory check for the named agents. The Skeptic and the iOS Ruler read this file before every run and run every check that names them. A run that skips a check is a failed run.

How the file grows (the loop):
1. The Builder flags something by hand (a screenshot, a correction, "why didn't you catch this").
2. In the same turn, the orchestrator adds a row here: what was missed, the check that would have caught it, which agents own it.
3. The orchestrator re-runs the owning agent on the same tree and confirms it now reports the miss. If it does not, the check is rewritten until it does.
4. At the end of every run, each agent lists anything it found that no row covers, as a proposed row. The orchestrator adds the good ones.

| # | Date | What the Builder caught | The check that catches it | Owners |
|---|---|---|---|---|
| 1 | Oct 16 | Tagalog names and an app named with a Tagalog word | Grep code, content, docs, asset filenames and `shared/brands.ts` for Tagalog words and Philippine-only terms; zero allowed | skeptic, ios-ruler |
| 2 | Oct 16 | The Philippines led the docs and examples | Count country mentions in the deck, video script, README and docs; no pack more than one above the median | skeptic |
| 3 | Oct 16 | A "Practice" chip sat on every header like an eyebrow | No chip, pill or eyebrow label above or beside a title on any screen; grep for `practice-tag` and measure for small uppercase or tinted labels near headings | ios-ruler |
| 4 | Oct 16 | App colours did not match the icons | Sample each icon in `web/public/art` (dominant hue) and compare with the header tint and chat look of that app on screen; delta E above 10 fails | ios-ruler |
| 5 | Oct 16 | The tells nav glass showed the wallpaper's wave as a hard diagonal edge | For every bar or sheet over the wallpaper, sample the luminance spread inside its box on the screenshot; a 5th to 95th percentile spread above 0.15 means the material shows shapes; fail | ios-ruler |
| 6 | Oct 16 | The voice was never listened to before the call was built on it | Any model output a feature depends on (voice, card, lesson) has a real sample generated and handed to the Builder before the feature ships | skeptic |
| 7 | Oct 16 | Every failed kill test ran on the wrong (free-tier) key | Before any model claim, confirm which key and project a run used and its tier | skeptic |
| 8 | Oct 16 | A model id in the docs did not exist | Every model id in code and docs is checked against the provider's models page | skeptic |
| 9 | Oct 16 | The practice call was promised but unreachable | Every feature named in the deck, README, video script or posts is reached through the app's own taps on the live URL | skeptic |
| 10 | Oct 16 | A restart killed uncommitted runs | After every run that changes files, the tree is committed before anything else starts | skeptic |
