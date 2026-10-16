# Scammer Survivor

## THE CONTRACT (read first, every session, before any work on this build)

This is the repo copy (no key locations, no personal details). If a session starts and this is not in context, stop and read it. If anything in the conversation contradicts it, the contract wins until the Builder changes it in words.

### What the Builder said, in order, this build (Oct 15 to 16, 2026)
1. "whenever a repo gets updated i want a discord bot that gives updates" → every push and PR on `EntropicEquanimity/ScammerSurvivor` posts to `#scammersurvivor-updates` in AIHackathonBuild. Done; it also covers the Cup's "stay active" gate.
2. "we'll just first think about scam survivors lets do it right this time. research everything perplexity apify awwwards like how to make this winnable and the steps" → research first, verified at primary sources; Perplexity is the finder never the citation; steps come from research.
3. "it's scammer survivor" → the name. Not Scam Survivor, not Scam Master.
4. "it's like its their own phoneeee" → first person. The player is the target. Their mom, their boss, their bank, their wallet. Not a found phone.
5. "we will be using best anthropic practices and openai key for like making assets" → Claude workflow (plan per slice, test first, one agent per file, review before commit, verify with tools); OpenAI gpt-image-2.5 for every picture; Gemini only inside the shipped app.
6. "like also the agents and other features the goal and even ultracode" → full feature scope, all agents, the goal is to win, ultracode workflows run the build.
7. "i want amazing world renowned ui and to score almost perfect" → Awwwards-grade staging, iOS 26 1:1 fidelity, near-perfect on every criterion.
8. "be unfuckingbiased like this would lose always see if this would win" → every plan gets independent red teams told to find why it loses; report their numbers, not my hopes.
9. "nothing tagalog." / "JAPAC NOT PHILIPPINES" (twice) / "i said no tagalog." → English only; no Tagalog in copy, names, invented apps, docs, or file names; eight countries equal; no country leads; examples rotate.
10. "what else should be changed get inspiration" then "no i meant stil in the scam" → inspiration from the scam domain itself (official playbooks, bank protections, recovery, real 2026 tactics), not from other games.
11. "assess this plan using openai" → a second model family reviews the plan.
12. "im very open to even 99% changes in the game just make this win" → nothing is sacred except winning.
13. "WHAT IS THE BEST WINNABLE" → I decide and own it: hybrid (own-phone solo day plus room mode), cuts: Translator, Scout, sign-in, ADK.
14. "IS GEMINI VOICE EVEN GOOD" → test it with a real sample before it carries anything.
15. "DOUBLE CHECK EACH STEP WHY ARE YOU JUST NOW CHECKING THAT" → every step that rests on an external fact is verified with a tool before it enters a plan: keys and tiers, model ids, regions, builds, daemons, a sample she can judge. Record checks as a verified table.
16. "go listen to the sample later just keep going" → she does not block; keep the build moving and park her items in a list.
17. "review the convo of this session for better results amazing ui 1:1 ui" and "90% WIN PERCENTAGE /GOAL" → re-read decisions before each phase; the UI target is 1:1 iOS plus staged moments; the goal is first place; report the honest probability after each re-score.
18. "The laptop restarted on a sched" → background runs die with the machine. Commit after every landed run, deploy from a clean worktree of a commit, and resume workflows from their run id.
19. "Check everything I dont want you to miss out make something that you have to read" → this contract.

### the Builder's standing rules that apply here (from her global contract and memory)
No em dashes anywhere, no AI-tell words ("delve", "leverage", "robust", "seamless", "comprehensive", "excited to announce"), sentence case, short sentences, English. Never move folders without asking. Do her infra and credential ops herself-style (move secrets between her systems, never print or commit a key; chat-paste for a one-shot is fine; flag rotation only if a key lands in a commit). Drafts are not sent messages. QA is Playwright at real viewports; render and inspect before showing. One agent per file on builds. Anti-ai-aesthetic before any user-facing surface. Best angle over deference. "What else" means expand scope. "Not verified" when uncertain; never present a partial result as done. Recommend-then-approve on UI directions; no recycled directions; no unsolicited design systems. WCAG audit before calling a surface done. Her Chrome reports reduced motion.

### The rules of the product (AGENTS.md 1 to 11 as amended Oct 16)
Practice label in the DOM on every screen, as a tag in each app header and on the lock screen, not on notification cards. Made-up apps only (shared/brands.ts; the sticker-chat app is Quillo). No typed input anywhere. Cards generated on the server from approved pattern notes; human approval at the note level; the Guard checks every card; the Director repairs once; a reviewed cache is the floor; the quick day is cache-only; under 18 cannot enter (ruled 16 Oct 2026). A refusal serves the cache, never a reworded prompt. No ready-to-send scam text in the repo. Gemini never decides a score. Google AI only inside the app (`@google/genai`), `gemini-3.8-flash`, fallback `gemini-3.6-flash`, `gemini-3.8-flash-tts`, `gemini-3.8-live`; `gemini-3.7-flash` never existed. Fresh code only. Files under 400 lines, functions under 50, return new objects.

### The fixed facts
Deadline Oct 18 2026, hour not public (submit by noon Manila); freeze Oct 17 midnight. Deliverables: live URL, public repo, video under 3:00, 7-section PDF deck, all English. Scoring 40 / 25 / 25 / 10. Live URL https://scammer-survivor-713399259482.asia-southeast1.run.app (Cloud Run `scammer-survivor`, asia-southeast1, one instance). Cup project `gen-lang-client-0970122156`, model location `global`, Firestore Native asia-southeast1, secret `GEMINI_API_KEY`, bucket `scammer-survivor-audio-713399259482`. Deploy from a clean worktree of a commit, never the live tree. Jobs: `pregenerate`, `approve-cache`, `tts-beats`, `probe`. Team: the Builder builder, the Deck lead deck and video and name and social, the Content lead content and approvals, the Playtest lead playtests and brand marks. 

### The Skeptic (standing agent, installed on approval)
the Builder: "i want a blunt an unbiased agent from claude that questions and questions everything that leads to self improvement of the overall plan." Installed as `D:\workspace\scam-master\.claude\agents\skeptic.md` and the Builder's global agents folder (so it runs from any session), read-only tools (Read, Grep, Glob, Bash for tests and curl, WebFetch), model inherits. Its brief: assume the plan loses first place; read the plan, the contract, the rules, the runbook, the deck and video drafts, and the live URL at 390x844; return the ten questions that move the most points on the 40/25/25/10 rubric, each with the evidence that exists today (file and line, or the screen), the cheapest check or change that answers it, and the owner; five "done" claims it could not verify with the exact command that would; three cuts that free hours; the one change that most raises first-place odds with before and after estimates; no praise, no hedging, never edits a file. It runs: before every ExitPlanMode on this build, after every workflow run lands, before every deploy, before the video is recorded, before submit, and whenever the Builder says "question it". Its output is folded into the plan as edits, and the questions it raised plus the answers are appended to `docs/skeptic-log.md` in the repo so the next session sees what was already asked.

### The iOS Ruler (standing agent, installed on approval)
the Builder: "i also need another ios strict ruler about the ui because i dont trust the ui changes youve made and this one should also take notes as you go." Installed as `D:\workspace\scam-master\.claude\agents\ios-ruler.md` and the Builder's global agents folder, read-only on the repo except its own log, tools: Read, Grep, Glob, Bash (build, serve, Playwright for Python, axe), model inherits. Its brief: it is a strict iOS 26 reviewer who measures, never admires. For every screen (lock, alert, home, notifications, card and thread, tells, lesson, recovery, call ringing and talking, ledger and result card, setup chips, room, lab, about) it builds the app, serves it, renders at 390x844 and 430x932 at DPR 3 with the iPhone user agent, and records a table per screen: element, iOS 26 value (points, weight, radius, blur, spacing, safe areas, material), ours (measured from computed styles through Playwright, not from the CSS source), pass or fail, the fix with file and selector. It also checks: one modal at a time, one clock, the status bar owned by the open app, 44 pt nav bars, 48 px targets (project rule), system font, no web-page tells (bordered cards, bottom bands, hairlines where iOS has none, outlined bubbles), the reduced-motion twin for every animation (it flips the media query and re-screenshots), and the project's deliberate divergences (18 px body, 16 px chrome, 13 px home labels, accent #0a70e8), which it never flags. It takes notes as it goes: every run appends to `docs/ios-ruler-log.md` a dated entry with the per-screen pass counts, the fails, what changed since the previous entry (it diffs against its own last entry), and a one-line verdict SHIP or HOLD. HOLD blocks the deploy until the named fails are fixed or the Builder overrides in words. It runs: on every tree that touches `web/src` before commit, after every UI workflow lands, before every deploy, before the video is recorded, and whenever the Builder says "rule it".

### the Builder's open items (she said keep going; these wait for her)
Listen to the voice sample and say if the voice carries the call. Ask the deadline hour on the Cup Discord. Kill test A in AI Studio if the live caller is wanted. Team playtest day one and day two. the Deck lead: deck and video from `docs/deck-draft.md` and `docs/video-script.md`.

---

## @AGENTS.md

## Claude Code notes

- Stage gate: slice 1 (the walking skeleton: no model calls, no scam content) may be built locally. Slice 2 onward waits until the builder has read `docs/prd.md` and `docs/build-plan.md` and the results of kill tests A, A2, A3 and B are written into `docs/kill-test.md`.
- Never without the builder saying go: deploying to Cloud Run, creating or pushing to the public GitHub repo, committing, spending credits.
- Build one slice at a time from `docs/build-plan.md`. Run that slice's check before starting the next.
- After any change under `content/`, `server/agents/`, `server/guard/` or `web/`, run the `policy-reviewer` agent on the diff.
- Before every commit, push, deploy and the submission, run the `cup-reviewer` agent on the tree. It checks the Cup gates (Google stack only, fresh code, Cloud Run, English only, deliverables) and lists the people-gates it cannot see.
- Use the `scenario-author` agent to draft pattern notes; the content lead approves each one and the playtest lead takes a second look.
- One builder writes the repo. Teammates send pattern notes and playtest notes; they do not edit code. Tracked files name people by role; names live in `CLAUDE.local.md`.
- Public repo: never write a machine path, key or teammate's personal detail into a tracked file. Machine-specific pointers go in `CLAUDE.local.md`.
