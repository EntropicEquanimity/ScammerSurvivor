# Tools: what to use, where, and how they connect

Checked 2026-10-02 against Google's docs and each tool's own docs. Anything marked "not verified" was not confirmed on a primary page today. The full list is at the bottom.

## What the Cup requires

AI Studio is optional. The rule has two parts: use Google AI, and deploy on Google Cloud.

- Themes page: submissions "must leverage Google AI models (like Gemini or Gemma) or be built using agentic platforms (such as Agent Platform, Antigravity, or AI Studio)" and "must be deployed on Google Cloud via Cloud Run or Firebase." <!-- ai-ok: direct quote of the Cup rule --> Source: https://aibuildercup.com/themes.html
- Terms: "All submitted prototypes must be built primarily using the Google Cloud tech stack (e.g., Cloud Run, GCP, Firebase). Solutions built primarily on competing cloud infrastructure will be deemed ineligible." Source: the terms linked from https://aibuildercup.com (read through a fetch summary; recheck the wording on the page before quoting it).
- The terms say nothing about AI coding assistants or non-Google models used while building. Not verified either way.

What this means for us: the app calls Gemini and runs on Cloud Run. Gemini on Cloud Run meets the rule as written; organizer confirmation is requested (one of the organizer questions in `docs/prd.md`). We still use AI Studio for the kill tests and for prompt and voice tuning, and we say so on the architecture slide. Using it is our choice. No rule asks for it and we do not claim it earns a prize.

## Which tool does which job

| Tool | Job on this project | Who uses it |
|---|---|---|
| Google AI Studio | Kill tests A, A2 and A3, prompt tuning, voice tuning, the API key, the rate-limit page | Builder |
| Claude Code | All app code, parallel agents, reviews. The only tool that writes to the repo | Builder |
| GitHub | The hub. Public repo required by the Cup | Builder |
| Google Cloud (Cloud Run, Firestore, Secret Manager) | Where the app runs | Builder |
| ChatGPT (OpenAI API) | Images for the team's walkthrough slide deck only | Builder |
| Codex or Cursor | Optional second reviewer on a branch | Optional |
| Antigravity | Optional Google-side editor and CLI (`agy`, a command name from a secondary source, not verified) | Optional |
| Perplexity | Research with sources, for the deck numbers | Deck lead, Content lead |
| Manus | Optional. Nothing here depends on it | Optional |
| Google Cloud console and Firebase console | Firebase Authentication (Google sign-in), the Geocoding API key, budget alerts | Builder |
| Shared doc (Google Docs or Sheets) | Pattern notes, approval decisions and playtest notes from teammates; the team wiki | Content lead, Playtest lead, Deck lead |

People are named by role in this repo: Builder, Deck lead, Content lead, Playtest lead.

## AI Studio: get an API key

Steps 1 and 2 were seen on screen on 2 Oct 2026. Step 3 is from general knowledge, not verified.

1. Open https://aistudio.google.com/apikey and sign in with the build account. It opens a page titled "API Keys" (also reachable from "Dashboard" in the left menu).
2. The Cup project already has a key (seen 2 Oct). Use that one. For a new key, click "Create API key" at the top right.
3. Pick (or create) a Google Cloud project when asked. Not verified.
4. Copy the key once. Paste it into `.env` on your machine as `GEMINI_API_KEY=...`. Never paste it into a file that git tracks.
5. For the deployed app, the key goes into Secret Manager, not into the code.
6. Open https://aistudio.google.com/rate-limit ("Rate Limit" in the same left menu) to see your project's limits. Limits are "per project, not per API key." Source: https://ai.google.dev/gemini-api/docs/rate-limits

Billing, as seen in AI Studio on 2 Oct: the Cup project is on Tier 1 prepay, and a banner says API requests will fail after 12 Oct until credits are bought. Buy credits before then, or the kill tests and the live app stop working.

Free tier note: Gemini 3.8 Flash, Live and TTS have a free tier, but free-tier content is "used to improve our products" and a free-tier key hit "limit: 20" requests a day on `gemini-3.8-flash` during kill test A2 on 2 and 3 Oct. Source: https://ai.google.dev/gemini-api/docs/pricing. The app uses the Tier 1 key only.

## AI Studio: run the voice kill test

This is kill test A. The system prompt, the script to read aloud, the pass rules and what to do on a fail are all in `docs/kill-test.md` and are not repeated here. The screen labels below were seen on 2 Oct 2026, except the model picker, which was not opened.

1. Open https://aistudio.google.com/live. The page says "Try the Live API".
2. In "Run settings" on the right, click the model box at the top and choose `gemini-3.8-live`. On 2 Oct the box showed a translate model, so this step matters. The entry's exact name in the picker is not verified.
3. Paste the system prompt from `docs/kill-test.md` into "System instructions", just under the model box.
4. Click "Talk" in the middle of the page and allow the microphone when the browser asks.
5. Follow the script in `docs/kill-test.md`. One person reads the six lines, one person fills in the score sheet.
6. Write the result into `docs/kill-test.md`: ticks, any refusal text, the date. Never the transcript.

A refusal goes straight to the scripted voice path. Do not reword the prompt to get around a refusal. The Gemini API terms forbid bypassing safeguards.

## AI Studio: tune a prompt in the playground

Used for kill tests A2 and A3 and for every agent prompt later (Director, Translator, Coach, Scout).

1. Open https://aistudio.google.com and click "Playground" in the left menu (seen 2 Oct).
2. In "Run settings" on the right, click the model box and pick `gemini-3.8-flash`. The picker entries were not checked on screen: not verified.
3. Run settings is where the next two steps happen. Source: https://ai.google.dev/gemini-api/docs/ai-studio-quickstart
4. Paste the agent's instructions into "System instructions".
5. Turn on structured output and paste the JSON schema for a card. The switch's exact label is not verified. For kill tests A2 and A3 it is optional; `docs/kill-test.md` says when to use it.
6. Paste a sample input (a pattern note, a layout and a level for A2; an approved card and a target language for A3) as the user message and run it.
7. Read the output. Check that every ask part carries its tell ids, that the real twin carries none, and for A3 that every part id survived.
8. Change one thing at a time in the system instructions and run again.
9. When it is good, copy the final instructions into `docs/kill-test.md` with the date. The same text then goes into the agent file in `server/agents/`.

The same Run settings panel has switches for function calling, code execution and grounding with Google Search, per the quickstart doc above. Their labels were not checked on screen today: not verified.

## AI Studio: Build mode (optional path)

The plan does not depend on this. It is here because it is a fast way to publish, and because Build mode can import our GitHub repo. Source: https://ai.google.dev/gemini-api/docs/aistudio-build-mode

Step 1 was seen on screen on 2 Oct. Steps 2 to 8 follow Google's Build mode and deploying docs; their labels were not checked on screen today, so treat each label as not verified.

1. Open https://aistudio.google.com. Under "Build" in the left menu, click "New app".
2. Describe the app in the input box, or choose "Import from GitHub".
3. Watch the preview appear on the right.
4. Iterate three ways: the chat panel, the Code tab, or annotation mode (highlight part of the screen and describe the change).
5. Add secrets (such as the API key) in the Secrets panel. Keys are "injected into the server-side runtime and are never included in client-side code."
6. Sync to GitHub. It is two-way: you can push, and you can "pull changes made locally" back in.
7. Click "Publish" (top right), then "Get Started", then "Publish App". Labels as given in https://ai.google.dev/gemini-api/docs/aistudio-deploying <!-- ai-ok: button labels quoted from Google's doc -->
8. Copy the Cloud Run URL it gives back. You can also choose a `your-app-name.ai.studio` subdomain.

What Build mode makes: a React front end plus a Node.js server. It can also make native Android apps in Kotlin.

Starter Tier limits (source: https://ai.google.dev/gemini-api/docs/aistudio-deploying):

| Limit | Detail |
|---|---|
| Services | "You can deploy up to two services" in one Cloud Run region |
| Billing | No billing account needed |
| Who cannot use it | Google Workspace accounts, accounts that have or had a Cloud billing account, accounts without enough activity |
| Appeals | Support "can't override Starter Tier eligibility" |

Why we do not build here: the build account already has billing (seen 2 Oct), so the Starter Tier is closed to it. We also plan on linked billing for the live advisory lookup (Search grounding), because its free-tier status is unclear in the docs. Whether Build mode reads `AGENTS.md` is not verified. Two tools writing one repo in a short window is a risk we do not need.

## Firebase Authentication: Google sign-in

Used from slice 7 on. Console labels below are from general knowledge, not verified on screen today.

1. Open the Firebase console, add the Cup's Google Cloud project as a Firebase project (or open it if it already is one).
2. Under Authentication, Sign-in method, enable the Google provider and set the support email.
3. Under Authentication, Settings, Authorised domains, add `localhost` and the Cloud Run service domain. Sign-in from an unlisted domain fails.
4. Add a web app to the project and copy its config (API key, auth domain, project id) into the client. These values are not secrets, but the Cloud Run origin is still the only authorised domain.
5. Offer sign-in only on the end-of-day screen for players 18 or older. Store the Google user id and email, nothing else.
6. Spike before relying on it: popup sign-in inside an installed iPhone web app. If it fails, use redirect sign-in. Not verified.

## Google Maps Geocoding: the optional location

Used only when the phone's time zone maps to more than one country.

1. In the Google Cloud console, enable the Geocoding API on the Cup project.
2. Create a key restricted to the Geocoding API and to the Cloud Run origin, and store it in Secret Manager; the browser never calls Maps directly.
3. The server sends the coordinates once, keeps the country code, and discards the coordinates. Nothing is written to Firestore.
4. Pricing has a free monthly allowance; the exact figure is not verified today.

## How the tools connect

GitHub is the hub. Any tool that can work on a GitHub repo can work on this app.

```
 Teammates' shared doc            Google AI Studio
 (pattern notes, playtest notes)  (kill tests, prompt tuning)
          |                                |
          | Builder copies in              | final prompts copied in
          v                                v
      +----------------------------------------+
      |   Claude Code on the Builder's machine |   <- the only writer
      |   (local clone of the repo)            |
      +----------------------------------------+
                         | git push
                         v
      +----------------------------------------+
      |   GitHub (public repo, branch: main)   |
      +----------------------------------------+
          |                  |                |
          v                  v                v
     Cloud Run          Codex / Cursor     AI Studio Build mode
     (live URL)         (optional review   (optional import; sync
                         on a branch)       can go both ways, we
                                            only pull from main)
```

## The shared contract

| File | Read by | Holds |
|---|---|---|
| `AGENTS.md` | Codex, Cursor, Antigravity | The Cup gates in short form, the policy rules, the Google-only app stack rule, the fresh-code rule, commit format |
| `CLAUDE.md` | Claude Code | One line that imports `AGENTS.md`, plus which agents to use |

One file of rules, every tool follows it. Whether AI Studio Build mode reads `AGENTS.md` is not verified.

## Where each tool keeps skills

A skill is a folder with a `SKILL.md` file inside. On Windows, `~` means your home folder.

| Tool | Project folder | Personal folder | Other ways in | Source |
|---|---|---|---|---|
| Claude Code | `.claude/skills/<name>/SKILL.md` | `~/.claude/skills/<name>/SKILL.md` | Plugins, with `/plugin install` | https://code.claude.com/docs/en/skills |
| Codex (OpenAI) | `.agents/skills` | `$HOME/.agents/skills` | Curated ones with `$skill-installer` | https://learn.chatgpt.com/docs/build-skills |
| Cursor | `.agents/skills/` or `.cursor/skills/` | `~/.agents/skills/` or `~/.cursor/skills/` | Plugins | https://cursor.com/docs/context/skills |
| Antigravity | `.agents/skills/` | `~/.gemini/config/skills/` (IDE), `~/.gemini/antigravity-cli/skills/` (CLI) | `agy plugin install` (the `agy` command name is from a secondary source, not verified) | https://antigravity.google/docs/skills |
| Manus | None (cloud tool) | Uploaded to your account | Build one in chat, upload a .zip, .skill file or folder, the official library, or a GitHub repo link | https://manus.im/docs/features/skills |
| Perplexity | None (cloud tool) | Uploaded | Agent API takes built-in, inline and custom uploaded skills, up to 16 per request | https://docs.perplexity.ai/docs/agent-api/skills |

Useful overlap: one `.agents/skills/` folder in the repo is read by Codex, Cursor and Antigravity. Claude Code uses `.claude/skills/`. Whether Claude Code also reads `.agents/skills/` is not verified.

We are not creating project skills yet. The rules live in `AGENTS.md`. A skill gets written the second time the same task repeats.

## Install one skill in each tool

Claude Code:
1. Make the folder `.claude/skills/<skill-name>/` in the project.
2. Put the `SKILL.md` file inside it.
3. Start a new Claude Code session. Type `/` and the skill name to check it shows up (from general knowledge, not verified today).

Codex, Cursor or Antigravity (same folder works for all three):
1. Make the folder `.agents/skills/<skill-name>/` in the project.
2. Put the `SKILL.md` file inside it.
3. Restart the tool and type in its chat: "Which skills do you have?" No menu path for listing skills was verified.

Manus:
1. Zip the skill folder.
2. In Manus, upload the zip as a skill, or paste the GitHub link of a repo that holds the skill. The menu name is not verified.
3. Type `/` in a chat to call it. Source: https://manus.im/docs/features/skills

Perplexity:
1. Zip the skill folder.
2. Upload it as a custom skill. Perplexity Computer importing a `SKILL.md` zip comes from a news report, not Perplexity's docs, so treat the click path as not verified. Source: https://www.testingcatalog.com/perplexity-rolling-out-skills-support-for-perplexity-computer/

## ChatGPT: slide images only

- The OpenAI key is used only to make pictures for the team's walkthrough slide deck. That is its only job.
- The key stays in a private file outside this repo. It is never copied into this repo.
- OpenAI never enters the app repo. The Cup says Google Cloud must be the primary stack, and a second AI vendor in the code invites a disqualification argument.
- `scripts/check-policy.sh` fails the build if a non-Google AI SDK shows up in the app's dependencies.

## Perplexity: research with sources

- Use it to find sources for deck numbers and for current scam advisories.
- Perplexity finds the source. The source itself is what gets cited. Open the page and check the number before it goes on a slide.
- The Perplexity connector was not available in the planning session, so the research so far used direct page fetches.

## Manus: optional

- What it could do: run a long research task, draft a first pass of the submission deck, or run a skill imported from GitHub.
- Why it is optional: every job above already has an owner. Adding a tool adds a place for things to drift.

## Gemini CLI was replaced

- "Gemini CLI was replaced by Antigravity CLI on June 18th, 2026" for unpaid-tier and Google One users. Source: https://geminicli.com/docs/
- The new command is `agy`, per a secondary source: https://inventivehq.com/blog/gemini-cli-deprecated-antigravity-cli-migration
- Old tutorials that say `npm install -g @google/gemini-cli` are out of date for most users.
- AI Studio can also export a whole project to Antigravity. Source: https://developers.googleblog.com/all-the-news-from-the-google-io-2026-developer-keynote/

## Note: Gemini speaks the OpenAI format

The Gemini API has an OpenAI-compatible endpoint at `https://generativelanguage.googleapis.com/v1beta/openai/`. Any tool that talks the OpenAI format can call Gemini through it. It is "still in beta". Source: https://ai.google.dev/gemini-api/docs/openai

We do not need it. The app uses Google's own `@google/genai` library.

## The working rule

Claude Code is the single writer of the repo.

1. The Builder, through Claude Code, is the only one who commits to `main`.
2. Codex or Cursor may review on a branch. Their changes come in through a pull request.
3. AI Studio Build mode can sync both ways. If we use it at all, we only pull `main` into it and never push from it.
4. Teammates send pattern notes and playtest notes through the shared doc. The Builder brings approved notes into `content/notes/` and the country packs into `content/packs/`.
5. Final prompts tuned in AI Studio are copied into the repo by hand, with the date, in `docs/kill-test.md`.

## Not verified

- AI Studio labels not seen on screen on 2 Oct: the model picker entries, the project step when creating a key, the structured output and tool switches, and every Build mode step after "New app".
- The wording of the Cup terms quote (read through a fetch summary).
- Whether AI Studio Build mode reads `AGENTS.md`, skills files or MCP servers. Confirmed only for the Antigravity managed agent.
- Free-tier request and token numbers. They are only visible at aistudio.google.com/rate-limit.
- Any Cup rule on non-Google AI tools used during the build. None is written down.
- Whether Claude Code reads `.agents/skills/`.
- Perplexity Computer's skill upload click path (secondary source).
- The `agy` command name (secondary source), wherever it appears above.
- The slash-command check in Claude Code, the Manus menu name, and how Codex, Cursor or Antigravity list their skills.
- Per-tool GitHub workflows for Codex, Cursor, Manus and Perplexity. Inferred from the fact that each works on a GitHub repo.
- Firebase and Google Cloud console labels for Authentication, authorised domains, the Geocoding API and its key restrictions; popup versus redirect sign-in in an installed iPhone web app; the Geocoding free allowance.
