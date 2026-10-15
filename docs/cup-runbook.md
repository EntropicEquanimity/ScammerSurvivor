# Cup runbook: 8 Oct to 18 Oct 2026

The one list to work from until submission. Dates here are the Cup's own. Slice checks are copied from `docs/build-plan.md` section 12; that file stays the source for what each slice contains. People by role: Builder, Deck lead, Content lead, Playtest lead.

Cut now, before anything else: slices 9 (live call), 10 (Scout and approval page) and 11 (email layout, cloud-chat polish, video-call variant). They show as "coming soon". The scripted call (slice 8) is the call that ships.

## A. Disqualifiers (Builder only, this week)

| Done | Item | By |
|---|---|---|
| [ ] | Every teammate has their own Cup account and has joined the team on the organizer dashboard. Solo entries are prohibited; one account cannot register the others. The FAQ closes team formation on 11 Oct; the terms say 4 Oct. Ask on Discord or the support email which date binds, today | 8 Oct |
| [ ] | Eligibility answered. The rule is working professionals, entrepreneurs or founders, 21 plus, living in JAPAC, no students. The draft email in the Cup research folder was never sent. Send it or ask on Discord today | 8 Oct |
| [ ] | Google setup, steps 1 to 10 of `docs/google-setup.md`: project, budget alert, credits, key, APIs, Firestore, Secret Manager, gcloud login | 11 Oct |
| [ ] | Buy API credits on the Cup project. The AI Studio banner says calls fail after 12 Oct until credits are bought. Set a budget alert | 11 Oct |
| [ ] | Stay active on the organizer dashboard and Discord. Leaving the dashboard is a disqualifier | weekly |
| [ ] | First commit. The repo has no commits yet. Fresh-code proof is the commit history inside the building window | 8 Oct |
| [ ] | Public GitHub repo created and pushed (say go) | 14 Oct |
| [ ] | Docker image builds and runs locally from the Dockerfile. Build-plan section 13 says it has never been built | 13 Oct |
| [ ] | Cloud Run deploy in asia-southeast1 from the repo, public URL (say go) | 14 Oct |

## B. Kill tests (decide what ships)

| Done | Test | Result goes in |
|---|---|---|
| [ ] | B, play Be Scam Ready to the end on a phone and a laptop | `docs/kill-test.md` table; pass needs three rows ours does that theirs does not |
| [ ] | A2, Director writes a card, three runs on the Tier 1 key | ticks only, never generated text |
| [ ] | A3, translation keeps the tells, three languages | ticks only |
| [ ] | A, voice caller | skipped for the Cup: slice 9 is cut, the scripted call ships regardless |

## C. Build order (Builder with Claude Code; one slice at a time; run the check before the next)

| Done | Slice | Check |
|---|---|---|
| [x] | 1 Walking skeleton | 13 tests pass; `npm run check` passes (verified 8 Oct) |
| [x] | 2 Country and age | Clock set to Asia/Singapore gives Singapore; Japan shows the sticker-chat first; under 18 sees no sign-in (verified 11 Oct in a headless phone-width browser; the sticker-chat is first in the Japan pack and home widget, its own look lands in slice 5; no sign-in exists until slice 7, re-check then) |
| [x] | 3 Day engine on fixture cards | A perfect day gives 100% on both rates and full wallet; blocking a real twin costs one person; the "friend or family" card appears on day one (verified 11 Oct: server tests cover all three; one card played end to end at 390px) |
| [ ] | 5 Chat component with five looks, text messages, e-wallet | Philippines day shows purple-chat first; Japan shows sticker-chat; no hex from the avoid list in CSS |
| [ ] | 4 Director, Guard, Coach, pregeneration; Translator for two languages | 20 generated cards, at least 18 pass the Guard; a hostile note yields a cached card; client payload has no answer key; a translation keeps every part id |
| [ ] | 8 Scripted call: TTS beats, meter, six buttons, scoring | Three pushbacks each drop the meter; "Read the code" fills it; block the microphone and the call still scores |
| [ ] | 6 Language picker, "translated by AI" note, "This reads wrong" | Switch language mid-day and the next card is translated; the button increments flags |
| [ ] | 7 Google sign-in after day one, guest progress linked, "Delete my data" | Sign in on one device, open on another, progress matches; delete removes days, progress, id and email |
| [ ] | Freeze 16 Oct. After this only fixes | |

Submittable line sits after slice 8. If 16 Oct arrives earlier in the list, ship what passed and mark the rest "coming soon".

## D. Content (Content lead, Playtest lead)

| Done | Item | By |
|---|---|---|
| [ ] | Pattern notes for the 16 common cards, Philippines and Singapore first, in the `PatternNote` shape. Drafted with the scenario-author agent, approved by the Content lead, second look by the Playtest lead | 11 Oct |
| [ ] | Every generated card in the cache reviewed before the freeze | 15 Oct |
| [ ] | Hotline numbers per country confirmed on an official page | 13 Oct |
| [ ] | Playtest: five players, three days each, the two rates at day one and day three, written in their words | 15 Oct |

## E. Submission (Deck lead, Playtest lead)

| Done | Item | By |
|---|---|---|
| [ ] | Name chosen; identifiers stay neutral until then | 10 Oct |
| [ ] | Video under 3 minutes, English voice-over and subtitles, public on YouTube or Drive. Script from `docs/submission-deck-outline.md` | 16 Oct |
| [ ] | PDF deck, seven sections: problem, solution vision, community benefit, feasibility, scalability, architecture, business case | 16 Oct |
| [ ] | README in English with the live URL, the video link, the contact email | 16 Oct |
| [ ] | Submit on the dashboard. Confirm the deadline time zone on Discord first | 17 Oct |

## F. Automations already in place, and what runs them

- `npm test` and `npm run check` are the gate before any commit and any deploy. Claude Code runs both before calling a slice done.
- The `policy-reviewer` agent runs on every diff under `content/`, `server/agents/`, `server/guard/` or `web/`.
- The `scenario-author` agent drafts pattern notes; a person approves each one.
- The `cup-reviewer` agent audits the tree against sections A and E before every commit, push, deploy and the submission. It reports the gates it can see from code and lists the rest as reminders.
- Cloud Scheduler for the weekly Scout run is cut with slice 10.
