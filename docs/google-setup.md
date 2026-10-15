# Google products for the Cup entry: step by step

Written 11 Oct 2026 for the Builder. Each step says who does it: "you" means the account owner, "Claude" means the coding agent once you hand over the key and the CLI login. Console labels marked "not verified" are from memory; look for the nearest match. Prices and tiers: build-plan section 13 and app-readiness.

## What each Google product does here

| Product | Role in the entry | Cup gate it serves |
|---|---|---|
| Google AI Studio | Home of the Gemini API key, the playground for kill tests and prompt tuning, the place to buy credits | G4 (Gemini integrated) |
| Gemini API (`gemini-3.8-flash`, `gemini-3.8-flash-tts`) | Director writes cards, Coach writes lessons, Translator translates, TTS voices the scripted call | G4, the 40% technical criterion |
| Google Cloud project | The container for everything below, with billing | G4 |
| Cloud Run | Hosts the one Node service: the app and its API, the live URL judges open | G4, G7 live URL |
| Secret Manager | Holds the Gemini key so it never sits in the repo or the image | security, G5 public repo |
| Firestore | Decks, cached cards, days, progress | slices 4 and 7 |
| Cloud Build and Artifact Registry | Build the container when `gcloud run deploy --source` runs | deploy |
| Firebase Authentication | Google sign-in after day one (slice 7, only if time allows) | optional |
| Cloud Scheduler, Maps Geocoding | Cut with slices 10 and 2b; not needed for the Cup | none |
| Google Slides, Drive, YouTube | The seven-section PDF deck exported from Slides; the video under 3 minutes on YouTube or Drive | G7 deliverables |

## Part 1: the project and the money (you, today)

1. Go to aistudio.google.com and sign in with the Google account that owns the Cup project. It was visible there on 2 Oct.
2. Check the project selector at the top shows the Cup project, not a personal one.
3. Open console.cloud.google.com with the same account and project. Billing, then "Budgets and alerts" (not verified). Create a budget of 50 USD with alerts at 50 and 90 percent.
4. Back in AI Studio, open the API keys page (left sidebar, "Get API key" or "API keys", not verified). Buy prepaid credits when it offers, so the project sits on Tier 1. The AI Studio banner on 2 Oct said calls fail after 12 Oct without credits. Free tier is out for two reasons: 20 requests a day, and free-tier content may be used to improve Google products.
5. Create one API key tied to the Cup project. Put it in the long-term `.env` as `GEMINI_API_KEY` or paste it to Claude in chat. It never goes into the repo; the policy check greps for keys.

## Part 2: turn on the services (you, 10 minutes)

6. Cloud console, "APIs and Services", "Enable APIs and services" (not verified). Enable: Generative Language API (the Gemini API), Cloud Run Admin API, Cloud Build API, Artifact Registry API, Cloud Firestore API, Secret Manager API.
7. Firestore: create a database in Native mode, region `asia-southeast1` (Singapore). Production rules are fine; the server is the only client.
8. Secret Manager: create a secret named `GEMINI_API_KEY` with the key from step 5. Grant the Cloud Run service account the "Secret Manager Secret Accessor" role when the deploy asks for it (not verified wording).

## Part 3: the command line (you, once)

9. Install the Google Cloud CLI from cloud.google.com/sdk. Then, in a terminal:

```bash
gcloud auth login
```

```bash
gcloud config set project YOUR_PROJECT_ID
```

10. Tell Claude the project id. From here Claude can run every gcloud command on your machine; you watch and say go.

## Part 4: kill tests and prompts (Claude, after Part 1)

11. Rerun kill test A2 (Director writes a card) three times on the Tier 1 key through the API, then A3 (translation keeps the tells). Ticks only go into `docs/kill-test.md`, never generated text.
12. If A2 passes, the Director prompt ships as is. If it fails twice, the Content lead writes the 16 cards by hand from pattern notes and the Director is dropped for the Cup.
13. Prompt wording changes are tried in the AI Studio playground first, then pasted into `server/agents/` unchanged, with the date.

## Part 5: build slice 4 (Claude)

14. `@google/genai` goes into `package.json` (the one AI SDK allowed). `server/gemini.ts` holds the model names and the 503 fallback to `gemini-3.6-flash`.
15. `scripts/pregenerate.ts` runs the Director over the approved pattern notes, the Guard checks every card, the cache fills in Firestore. Nothing is generated while a player waits.
16. The under-18 path and the quick day never call a model; they read the cache.

## Part 6: deploy (Claude runs it, you say go)

17. Build the image locally once (`docker build .`), because the Dockerfile has never been built.
18. Deploy from the repo root:

```bash
gcloud run deploy practice-phone --source . --region asia-southeast1 --allow-unauthenticated --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest --set-env-vars GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID
```

19. The command prints the public URL. Open it on a phone, play a quick day, check the Cloud Run logs show card and tell ids only, never message text.
20. That URL goes into the README, the deck and the submission form.

## Part 7: sign-in, only if slice 7 ships (you, 15 minutes)

21. console.firebase.google.com, "Add project", pick the existing Cup project.
22. Authentication, "Get started", enable the Google provider.
23. Authentication, Settings, "Authorized domains": add the Cloud Run hostname.
24. Give Claude the Firebase web config (not a secret, but it still stays out of chat logs if possible; it can live in `.env`).

## Part 8: the deliverables on Google (Deck lead, Playtest lead)

25. Deck: Google Slides, seven sections in order: problem, solution vision, community benefit, feasibility, scalability, architecture, business case. File, Download, PDF. English only.
26. Video: under 3 minutes, English voice-over and subtitles. Upload to YouTube as unlisted or public, or to Drive with "anyone with the link". Public link in the README.
27. Architecture slide: one Cloud Run service in asia-southeast1, Secret Manager, Firestore, the Gemini models by name, the Guard in code, cached fallbacks. The honest line about tooling: "prompts kill-tested and tuned in AI Studio, served through the Gemini API on Cloud Run."

## Judging window (19 Oct to 6 Nov)

28. Budget alert on. Call tokens capped per device and per IP. Every card a judge can reach is pregenerated and reviewed before 16 Oct. A 503 tries `gemini-3.6-flash` once, then serves the cache. Nobody has to watch it.

## Not verified

Console menu names in steps 3, 6 and 8; the exact role name in step 8; whether `gcloud run deploy --source` picks Node 24 without the Dockerfile (it uses the Dockerfile when present, which is why step 17 exists); Firebase popup versus redirect sign-in inside an installed iPhone web app; the TTS price.
