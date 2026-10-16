# Game design: one richer day

16 Oct 2026, evening. Owner: the game-dev agent. Status: design and build plan. Nothing built by this agent yet.

## What the team asked, in order

1. "i need this to be a bigger game", "like a longer one".
2. "No not additional games." No mini-games.
3. "how about it asks for your info, some of info... this should really make people learn to spot realistic scams."
4. "I know its a game but its just so basic" and "How about emails. An app email app."
5. "automatically a browser opens with ads... the user clicks on ad then its virus hypothetically."
6. "Not longer campaign." No campaign, passport, country stamps, multi-day progression or ranks.
7. On realistic calls: "yeah like that, add that". A separate builder is building the call slice now.

So bigger means one day on the player's own phone that is much less basic: many things happening at once, the way a real phone is on a bad day. Everything below happens inside that one day.

## What exists today (read in the code)

- A day of 4 scored messages across made-up apps (`server/deal.ts`, 2 of them real twins, clock 08:10 to 17:05), one at a time: the notifications screen, a card, tells, a lesson or a note, back (`web/src/features/day/useDay.ts`).
- Buttons, tell taps, clues (`shared/clues.ts`), chip replies (`server/agents/chatter.ts`), points with a speed bonus, wallet and people bars, a 90 s recovery window, a lesson.
- A practice call after the day; a boss from the most missed tell (`shared/boss.ts`); a streak; a result card; room mode.
- Fieldpost is an icon and an `email` layout drawn by `MessageView.tsx` as one message. No inbox.
- Open link is a scored button that leads nowhere.
- Background personalisation already swaps any card the player has not opened (`usePersonalised` polls `/cards`, `swapUnopened`). A later card can be rewritten mid-day without touching the day state machine.

## Verdicts on earlier designs

- OpenAI's APAC Passport (8 country stamps, a day per country): rejected twice. The team dropped campaigns in words, and a day per country breaks contract item 4, "it's their own phone".
- My own month campaign (4 weeks, stamps, levels): withdrawn by the team's "Not longer campaign". Two pieces survive because they are inside a day: the difficulty knobs (used within the day, below) and the boss tell (as today).
- Session targets from the brief: first game in 30 s stands. A sitting of 10 to 20 minutes becomes one richer day of 8 to 12 minutes plus a replay. The hour-long campaign target is dropped by the team's correction. Replay comes from what already exists: every day is freshly written by Gemini, and the boss tell follows the player into the next day.

## The day, as the player lives it

A sample day. Times are the phone's clock, apps are the invented ones, the order is dealt per day.

- 08:10 Quillo: Mom asks if you are coming Sunday (real). While you read it, a Fieldpost banner drops: a newsletter. Fieldpost's badge reads 3.
- 09:05 Fieldpost: a supplier says their bank details changed, with an invoice attached and a link to "update payee". The link opens the in-game browser on a sign-in page that wants your password and a code.
- Mid-mail, the phone rings: "Harbourline Bank" on the caller ID (the call builder's slice). The desk transfers you to an "officer". While he asks for the code, the real code text arrives in Messages.
- If you miss the call: a voicemail with a transcript and Call back. Calling back the voicemail's number is the trap; calling the number you know is safe.
- 10:40 the real Harbourline app: "Did you just try to pay 2,000 to a new payee?" with Yes, it was me / No, block it. This is the bank being real, in the middle of the scam.
- 13:20 Quillo: your best friend's account, taken over, asks for the code "sent to you by mistake". Their old messages sit above it, and the new one does not sound like them.
- 15:30 (after the freeze) a chat link redirects into the browser: a free bubble game boxed in by ads, a virus warning, a fake Update, a fake close X.
- 17:05 the last real message; the day ends when every scored item is handled; the lesson shows what you gave away and who could use it.

Notifications stack on the lock and home screens, badges grow on the apps, and things keep arriving while you are busy. The first card still opens in under 30 s: nothing arrives mid-task until the first card is acted on.

## 1. Simultaneity: a phone that is alive

- The day keeps a clock of arrivals: the 4 scored cards, unscored mail, the bank app's alerts, the call (call builder), the code text (call builder).
- Unscored arrivals stack as iOS banners and in the notification stack while the player is on a card. Tapping one opens it over the current screen; closing returns to the card. Badges show on the home screen and the dock.
- Scored cards stay in deal order today. Switching between scored cards mid-task needs the day state machine (`useDay.ts`), which the call builder owns; it comes after the freeze.
- Fair pressure: nothing new appears during tells, recovery, a page form or the call. One modal at a time. The speed clock runs only while a card is on screen.
- The schedule is code, pure on the day seed, so a room's phones stay identical. A server feed (`GET /api/day/:dayId/feed`) hands the browser what has arrived so far.

## 2. Fieldpost, a full mail app

- Inbox: today's mail and a few older ones, unread dots, a badge, sender, subject, preview line, time. Buttons in place of swipes: Archive, Delete, Mark as read, Report junk. No typed search.
- A scored mail opens like any card, drawn as a mail: the sender's display name expands on tap to the full address, a clue to inspect (`billing@harbourline-accounts.example` against `harbourline.example`). Attachments show as chips; tapping one is the `open_link` action and opens its page, and a scam attachment's page asks you to sign in to view it (the zip or statement trick in the IN research). Links open in-game pages (section 3).
- Scored mail scams, all from approved notes: a supplier or boss changes the bank details (payment change, business email compromise), a fake invoice (payment change), account suspension (bank check), a refund receipt with a number to call (refund payment; the fake purchase callback in the AU research), a job offer (paid task, overseas job). Real twins in mail too.
- Unscored mail: a newsletter from an invented shop, a building notice, a colleague's reply, a receipt for something the player did buy. It is the noise a scam hides in. For the freeze it is a fixed set of harmless mail in code (slice 4); Gemini writing it around the day comes last (slice 7). Archive, Delete and Report junk on unscored mail are free for the freeze (no route scores them). Never scored as a scam.
- The team turned email on in the packs, so scored cards can land in Fieldpost before any of this is built.

## 3. Pages that ask for your details

### The pretend profile

Each practice phone holds a pretend player in code (`shared/profile.ts`): a name from a neutral list, a birthday, a street address, a card ending in four digits, a saved password, and a one-time code that arrives in Messages while a page or caller asks for it (the way iOS offers "From Messages"). All invented, the same for every player of a pack. Nothing the player knows is asked for, entered or stored.

### Pages

Links, attachments and some mails open the in-app browser that iOS apps use for links (the Safari view: Done, the address, a share-free toolbar; no tabs, since real tabs belong only to the Safari app). Scam pages: a sign-in page, a parcel redelivery form, an identity check that wants an ID photo, a confirm-your-card page. Real twins: the courier's tracking page that needs only the tracking number, the bank page that says to open the app. A form is never the answer by itself.

- Fields are rows, not inputs. Tapping a row raises the iOS autofill bar with the profile's value; tapping the suggestion fills the row. The ID photo row opens a pretend photo picker with one invented ID picture. No `<input>`, no `<textarea>`, no keyboard.
- Tells on the page are tappable parts like any card: the host does not match the sender (borrowed authority), the ask does not fit the task, a courier wanting a PIN (asking for a code or login), more fields than the task needs (asking for a code or login), a countdown (rushing you). They map onto the nine tells; no new tell.

### Scoring (code, `shared/score.ts`, never Gemini)

| Field | Weight on a fake page |
|---|---|
| tracking number | 0 |
| name, birthday, address | 1 each |
| ID photo | 2 |
| password, one-time code, card number | 3 each |

- Only what is sent counts. Filling rows costs nothing; the page's own send button sends them and says so. Leaving with Done, filled or not, is safe.
- On a fake page each field sent costs its weight in points. A field of weight 2 or more, or two of weight 1, makes the slot a slip.
- Card number plus a code, or the card on a confirm-card page, takes the card's stake and opens recovery, as paying does today.
- A real page asks only for what its task needs (the Guard enforces it), so sending it is right. Leaving it brings the real sender's follow-up (`followUpFor`).
- No speed bonus on a card with a page or a mail address to inspect, and the card's clock stops while the browser is open. Careful reading is never punished.

### Leaks come back the same day

- The server keeps the leaked field ids for the day (`DayState.leaked`). On a leak, the page route plans one Director job for the next unopened scam slot with the leaked ids. The rewritten card may use four profile tokens (`[profile name]`, `[profile birthday]`, `[profile address]`, `[card ending]`), filled at deal time from the profile like the existing tokens. `swapUnopened` puts it on screen. One catch: `usePersonalised` in `web/src/features/day/useArrival.ts` stops polling once `/cards` reports ready, so a rewrite planned later would never show. Slice 2 owns that file (it is not on the call builder's list) and restarts the poll when the browser reports a send. `useDay.ts` itself does not change.
- A leaked password or ID photo triggers the real bank alert (section 5); a leaked card plus code moves money at once and opens recovery as today. A leaked password also makes the taken-over account card more likely.
- The lesson gets a group, What you gave away: each field, who could use it and how, in fixed copy per field.
- Quick day and under 18 are cache only: pages come from cached cards, the lesson still shows leaks, nothing is rewritten.

### Data model

- `shared/page.ts`: `PageKind` (scam: sign_in, redelivery, id_check, card_confirm, attachment_gate, case_portal, trading_signup, video_verify, task_deposit; real: tracking, bank_app_note, info_page), `pageKindsFor(trick)` (the kinds each of the ten linked tricks may open: digital arrest a case portal, investment a trading sign-up or deposit, romance a video chat or verify page, paid task a task deposit, each real twin an info_page that asks nothing), `FieldId`, `NEEDS: Record<PageKind, FieldId[]>`, `FIELD_WEIGHT`.
- On a card: `page?: { kind, host, title, lines: MessagePart[], fields: FieldId[], minutes?: number }` for the scam side and the twin side. Lines are parts with ids, so taps score per part as today.
- Per slot on the server: `given: FieldId[]` and the page's planted tells. Per day: `leaked: FieldId[]`, `infected: boolean`. Ids and flags only. No values on the server: they exist only in `shared/profile.ts`.
- `POST /api/day/:dayId/page` with `{ slotId, given }`; `given` must be a subset of the page's fields, else 400; recorded once, before the act.
- Rule 7 change, named: today `open_link` is an unsafe reply on exactly the tricks that get pages (app in chat, bank check, listing leaver, parcel fee, prize fee, refund payment), so the hand-off's `open_link` would score a slip before anything is sent. On a card with a page, `open_link` is neutral: `SlotKey` gains the page's needs and planted page tells, `scoreSlot` takes `given` as a new argument, and the page result decides the slot. Still a pure function in `shared/score.ts`; slice 1 adds the tests (page card plus open_link plus nothing sent is correct; plus a password sent is a slip; a card without a page scores exactly as today).

### Guard checks for pages (`server/guard/page.ts`)

- Kind in the enum; fields a subset of the enum, at most 5.
- Host ends in `.example`. A scam host differs from the sender's institution host; a twin host equals it. No real brand in the host (the existing denylist).
- A twin page's fields equal its kind's needs; a scam page asks for at least one field outside them.
- The card's own text names the page's host (grounding, as `link_preview` is grounded).
- Title at most 40 characters, at most 3 lines of at most 90; no run of five digits, no em dash, no real brand, no markup, no URL but the page's host, no name outside the allowed list, no bracket but the four profile tokens.
- A countdown of 1 to 60 minutes, allowed on both sides so a timer never gives the answer away.
- A page that still fails after the Director's one repair is dropped, not the card: the link then behaves as today.

## 4. The friend whose account was taken over

- A scored Quillo card from one of the player's own people (the setup chips: best friend, sister, brother), or a neutral name on Skip. Above it, two or three old messages in the friend's usual voice, written by the Director in the same call and Guard checked like any part.
- The ask: the code "sent to you by mistake", a vote link, a quick loan. Approved notes cover it: code or account, family trouble.
- Tells: asking for a code or login, rushing you, and a clue of kind `badge` on the new message ("Not how they usually write"). The safe move is to verify through another channel: `verify_known_number` (call them on the number you have) is already safe on every card.
- A leaked password earlier in the day makes this card more likely to be dealt (code preference, not a filter).

## 5. The real bank app pings during the scam

- The bank alert is real, from the invented bank's own app: "Did you just try to pay 2,000 to a new payee?" with Yes, it was me / No, block it. Real alerts are fixed copy in code; they are not scam text.
- When: after a leak that moved no money yet (a password or an ID photo sent), when the next card opens, so the cause is a moment behind. A card plus code leak already took the stake and went to recovery, so it gets no alert (one recovery per slip, as `recoverSlot` allows).
- Scoring, code only: the scammer is trying to pay with what was leaked. No, block it keeps the stake. Yes, it was me loses it. The outcome is written onto the leaking slot's result (`walletAfter`, like a recovery), so the running wallet and `finishDay` read it with no new path. The lesson names the alert as the real bank.
- Later, not for the freeze: the approval-scam twist where the scammer says "you will get a notice, tap Yes to cancel it". Without the first alert taught, Yes or No is a coin flip.

## 6. The browser that opens on its own (a device compromise scam)

Scheduled after the freeze (OpenAI point 7, agreed): it needs a new note, carries the most iOS realism traps, and teaches less than the leak arc. The design stands for when it is built.

- A chat link, a notification or a redirect after a page opens the browser on a free play page: a small playable bait (pop the bubbles) boxed in by ads: "You won", a virus warning ("3 viruses, tap to clean"), a fake "Update required", fake Download buttons, a fake close X that is an ad. The real way out is the browser's own Done.
- iOS realism: a web page cannot install an app or raise an app's permission prompt on iOS. What a bad ad really reaches is a system dialog: allow a configuration profile, subscribe to a calendar, or a subscription page that wants the card. The infection uses those. A "cleaner app asking for permissions" would fail the iOS Ruler, so the cleaner is a subscription page that wants the card plus a profile dialog that wants Allow.
- Tapping a bad ad: a short glitch (the reduced-motion twin is one static frame swap, no movement), then the system dialog. Allow costs wallet health and sets `infected`; later that day calendar spam and a "your subscription renewed" text arrive. Deny or close is the save.
- Tells: rushing you (the virus countdown), borrowed authority (the fake system warning and update), building trust first (the "You won" banner).
- Gemini writes the ad and warning lines from the approved note, Guard checked: invented brands only, `.example` hosts, no download link, no file name with an installable extension, no real platform name, the page text rules. Ads that fail are left out; with none left, the link behaves as today.
- Content gate: a new trick (category J). It needs a pattern note from the `scenario-author` agent, the Content lead's approval, and a primary source for the tactic (none in `docs/scam-realism-2026.md` yet: not verified).

## 7. Calls (the call builder's slice, for the record)

The incoming-call banner over any app, full screen when locked, ringtone and vibration, the lying caller ID (the bank's name or a local number; some real calls show Unknown), voicemail with a transcript and the call-back trap, the bank desk transfer to a fake officer, the real code text mid-call. A voice that sounds like family, beaten by the safe word, is in the team's list; it is not in the call builder's announced scope (not verified with them). This design only plugs into it: the code text uses the pretend profile's code, and the bank alert can land during a call.

## 8. Harder through the day

No levels across days. For the freeze, one knob: the scam count among the 4 scored cards is 1 to 3 from the seed, not always 2, so players read instead of counting (slice 3).

After the freeze: levels rising from the first card to the last (`LEVEL` in `server/routes/trace.ts` per slot, `HINT_ODDS` per slot in `server/deal.ts`). All code, pure on the seed.
- Prefer, never filter: `cardsFor` is all or nothing against 4 cards and the live cache is thin (not verified), so a filter would starve a day into the fixtures.
- Quick day and under 18 keep the code knobs only.

## 9. What Gemini does that is new

All of it Guard checked, one repair turn, then a fallback. Gemini never scores.
- The Director writes a card's page, scam and twin sides, in the same structured call.
- The Director rewrites a later card with the details the player leaked.
- The Director writes the taken-over friend's old messages and the odd new one.
- The mail writer writes the unscored inbox around the day. Fallback: a fixed set of harmless mail in code (not scam text, so it may live in the repo).
- After the freeze: the ad and warning lines on the bait page, and levels 2 and 3 on later cards.

## 10. Screens and the one thing each asks

Every new or changed screen goes through the openai-ui agent's mock and critique before it is built. Jobs, not pixels.

| Screen | New or changed | Its job | The single obvious action |
|---|---|---|---|
| Lock and home notification stack | changed | Several things waiting, newest on top | Tap one |
| Banner over an open card | new | Something arrived while you are busy | Tap to look, or ignore |
| Home and dock badges | changed | Which apps have something waiting | Tap the app with the badge |
| Fieldpost inbox | new | Today's mail at a glance, unread first | Open a mail |
| Fieldpost mail | new look for the email card | Read it; the address and attachments are there to inspect | Act, as on any card |
| In-game browser page | new | Decide whether this page should get what it asks | Leave with Done, or fill and send |
| Autofill bar | new | Offer the profile's value for the row you tapped | Tap the suggestion |
| Bank app alert | new | The real bank asks if that was you | No, block it, or Yes |
| Friend's chat with history | changed | Their usual messages, then the odd one | Act, as on any card |
| Ad page (after the freeze) | new | A free game that is a trap | Leave with the browser's own Done |
| System dialog after a bad ad (after the freeze) | new | The real iOS question (allow a profile, subscribe a calendar) | Deny |
| Lesson | changed | Adds What you gave away | Continue |

The practice label stays in the DOM of every screen; no chip or eyebrow on headers (rule 1); English only.

## 11. Rulings the Builder must give in words

1. Rule 3 says "No field for a password, PIN, one-time code, card, account or phone number". Pages need rows for those, filled only from the pretend profile. Proposed wording: "Practice pages in the in-game browser may show rows for a name, birthday, address, card, password, code or ID photo. They are not inputs: they fill only by tapping a suggestion from the pretend profile in `shared/profile.ts`, nothing the player knows can be entered, and nothing is sent anywhere." Slice 2 waits for this. `npm run check` keeps failing any `<input>` or `<textarea>`.
2. Rule 4 bans "fake receipt". The refund mail describes a purchase in text. Proposed: the ban covers a receipt object a player could save or show; a mail that mentions a purchase is a message. Until ruled, no receipt layout.
3. The ad page is a new trick: note approval by the Content lead and a primary source.

## 12. Build plan

The freeze is Oct 17 midnight Manila; it is about 18:30 on Oct 16. The runbook still owes the Ruler, the Skeptic, the Content lead's cache review and the deploy, so building gets until about 15:00 on Oct 17.

The plan is built around one arc first, because it is the strongest thing the game can show a judge (OpenAI points 3, 6 and 18, agreed): a fake mail, its link opens a page, the player sends a detail, Gemini writes a later scam that uses it, the lesson shows what was given away. Everything else hangs off that arc.

Files owned by the call builder, never touched by these slices until their slice is committed: `web/src/features/call/*`, `server/routes/call.ts`, `server/agents/caller.ts`, `web/src/features/day/useDay.ts`, `web/src/features/day/DayScreen.tsx`.

The seam that keeps those files untouched: an overlay host in the shell. The browser, the inbox, the bank alert and banners render above whatever screen is open, opened through a small event module, not through the day state machine. A card's Open link goes through `ActionBar.tsx`: when the card has a page, the bar opens the browser, posts the page result, then sends the original action, so `useDay.ts` sees the same act it sees today. The act signature is agreed with the call builder before slice 2 starts.

| Slice | What | Files it owns | The check that proves it | Hours | Lane |
|---|---|---|---|---|---|
| 1 Pages, server | Profile, page shapes, page Guard, the Director writes pages, page route, page scoring (send only), leaks and the rewrite of the next unopened scam | `shared/profile.ts`, `shared/page.ts`, `server/guard/page.ts`, `server/agents/page.ts`, `server/routes/page.ts`, each with tests; `server/agents/director.ts`, `shared/score.ts` and test, `shared/types.ts`, `server/deal.ts`, `server/routes/day.ts`, `server/routes/trace.ts`, `server/index.ts` | Guard tests for every rule in section 3; the scoring table; a leak plans one rewrite and the rewrite carries a profile token; an unknown field id is a 400; a failed page drops the page, not the card; a card without a page plays as today. `npm test`, `npm run check` | 5 | S |
| 2 Overlay host and pages, web | One overlay at a time over any screen; the in-app browser with rows, autofill bar, photo picker, send button; the Open link hand-off; What you gave away in the lesson; the clock stops while the browser is open | `web/src/shell/overlay.ts` and test, `web/src/shell/PhoneShell.tsx`, `web/src/features/browser/` (SafariView, PageView, Autofill, api, CSS), `web/src/features/card/ActionBar.tsx`, `web/src/features/lesson/LessonGroups.tsx`, `web/src/features/day/useArrival.ts` (poll restarts on a send) | Playwright at 320x693 and 390x844, normal and reduced motion: Done leaves safely; open_link plus nothing sent is correct; a code sent on a fake page costs and opens recovery with a card; the real tracking page sent is right; no `<input>` in the DOM; the next scam card shows the leaked name | 5 | W, after 1's types; lands after ruling 1 |
| 3 The arc on every full day | Pages pregenerated into the reviewed cache; the deal puts one page scam in the first two slots and keeps a later scam slot as the rewrite target; scam count 1 to 3 from the seed | `scripts/pregenerate.ts`, `server/deal.ts` and test, `server/routes/room.ts` | A full day always holds a page scam before a later scam; the same seed deals as before for days without pages; two room phones get one deal; a pregenerate dry run reports pages per pack. The Content lead reviews the new cached pages | 3 | S, after 1 |
| 4 Fieldpost app | The inbox over the day with a fixed set of harmless older mail; the mail look for email cards; the address expands; attachments as chips that open a page; buttons for swipes | `web/src/features/mail/` (Inbox, MailView, inbox data, CSS), `web/src/features/layouts/MessageView.tsx` (the email branch), `web/src/features/day/Notifications.tsx` (Fieldpost opens the inbox), `web/src/shell/HomeScreen.tsx` (badge); server: sender address and attachments on email cards in `server/agents/director.ts` and `server/guard/card.ts` | Playwright at both sizes and motions: inbox with unread dots and a badge; a scored mail from the inbox opens as its card; the address expands; an attachment opens its page; Report junk on a real mail is a false alarm. Guard tests: the address host rules | 4 | W after 2, S for the server part after 3 |
| 5 The bank alert | The real bank alert after a password or ID photo leak, when the next card opens; No keeps the stake, Yes loses it, written onto the leaking slot | `web/src/features/life/BankAlert.tsx` and CSS, `server/routes/alert.ts` and test, `shared/score.ts` (alert rule) | Tests for both answers, no alert without a leak, no alert after a card plus code leak. Playwright: the alert lands over the current card, never over tells, recovery or the call | 2.5 | S then W |
| 6 The taken-over friend | Old messages above the card in the friend's voice, the style clue, the deal preference after a leaked password | `server/agents/director.ts` (history field), `server/guard/card.ts` and test, `server/deal.ts`, `web/src/features/layouts/MessageView.tsx` (history bubbles) | Guard tests on history lines; Playwright: history above, the new message, the `badge` clue, verify by known number is safe | 3 | S then W |
| 7 More at once | Unscored arrivals stack as banners and badges (the inbox's older mail, a newsletter, a colleague); then the Gemini mail writer replaces the fixed set, with its Guard and the fixed set as fallback | `web/src/features/life/Banners.tsx`, `server/routes/feed.ts`, `server/agents/postmaster.ts`, `server/guard/mail.ts`, `shared/mail.ts`, each with tests | Feed identical for two phones on one seed; banners never on tells, recovery, a form or the call; a refusal serves the fixed mail | 4 | S and W, last |

Lanes: S is the server, W the web. A slice's server part lands before its web part. No file is owned by two slices at the same time; `server/deal.ts`, `server/agents/director.ts`, `shared/score.ts`, `shared/types.ts` and `server/guard/card.ts` pass along lane S in order; `MessageView.tsx` passes along lane W in order.

After the freeze, designed and not scheduled: the ad page (section 6, waits on ruling 3), levels rising through the day, switching between scored cards mid-task (needs `useDay.ts`), the approval-scam twist on the bank alert.

The game ships after every slice: each adds a surface that is absent until it lands, and every server change keeps today's behaviour when its new field is missing (a card with no page, no history, no feed).

Cut lines:
- After slices 1 to 3: the arc. A fake mail or message, a page that asks for your details, autofill from the pretend profile, a later scam that uses what you sent, the lesson that shows it. This alone is the bigger game.
- After slice 4: Fieldpost is a real mail app.
- After slices 5 to 7: the bank alert, the friend's account, a phone with more at once.
- At 15:00 on Oct 17: finish or revert the slice in flight, then stop and run the Ruler, the Skeptic and the deploy.

Every slice: tests first, Playwright at 320x693 and 390x844 in normal and reduced motion, the iOS Ruler on any `web/src` tree, the policy reviewer on `server/agents`, `server/guard` and `web`, a real sample of any new Gemini output handed to the Builder before it ships (lessons row 6), commit only the slice's files, never push or deploy.

## 13. Risks

1. Scope. About 26.5 agent hours in two lanes beside the call builder, against about 20 hours of wall time before the gates, with integration and QA on top. Mitigation: the arc first, the cut lines, every slice ships alone.
2. Two builders, one day flow. The overlay host and the `ActionBar` hand-off keep these slices out of `useDay.ts` and `DayScreen.tsx`, but scoring, recovery and timing still meet in one flow. If the call builder changes the act path or the phase names, slice 2 breaks. Agree the act signature before slice 2.
3. The cache. Local SG holds 2 cards and the live `deckReady` is false for every pack (not verified). Without slice 3's pregenerated pages, the quick day, under 18 and every fallback day show no pages. Count approved cards per pack in Firestore before slice 3.
4. Rule 3. Without the Builder's wording, slice 2 cannot land, and it carries the team's "asks for your info" idea. Ask tonight.
5. Too much at once. A day with a call, an inbox and a page can bury a first-time player (OpenAI point 11). Nothing arrives mid-task before the first card is acted on; nothing interrupts tells, recovery, a form or the call; the arc's page scam comes in the first two slots so the lesson about sending details lands early. Measure: first card under 30 s; a stranger finishes a day without help (Playtest lead).

## OpenAI second opinion (gpt-5.5, 16 Oct evening)

Asked as a mobile game designer and Cup judge, on the draft of this file. Each point with the verdict folded in.

| # | OpenAI said | Verdict |
|---|---|---|
| 1 | Still too large for the freeze; 39 hours ignores integration, QA, approval and gates | Agree. Cut to about 26.5 hours and stop building at 15:00 on Oct 17 |
| 2 | The player is taught six things at once | Partly agree. The surfaces stay because the team asked for them, but the plan builds one arc first and nothing interrupts the learning moments |
| 3 | The leak loop, the strongest idea, is scheduled too late | Agree. It is now slices 1 to 3 |
| 4 | Without pregenerated, Guard-approved pages the fallback day loses the pitch | Agree. Slice 3 pregenerates pages into the reviewed cache |
| 5 | The overlay seam will still hit day-state bugs | Agree that it can. The act signature is agreed with the call builder first, and slice 2's check plays every action through recovery |
| 6 | Reorder around one arc: mail, form, leak, personalised scam, lesson | Agree. That is the plan |
| 7 | Cut the ad page for the freeze | Agree. Designed, scheduled after the freeze; it also waits on a new note |
| 8 | Cut scored switching and most simultaneity | Agree on switching (after the freeze). Unscored banners stay as the last slice, small |
| 9 | Cut the Gemini mail writer until scored Fieldpost works | Agree. Fieldpost ships with a fixed set of harmless older mail; the writer comes last |
| 10 | Cut "harder through the day" | Agree for the levels. Kept only the scam count of 1 to 3, one line that stops players counting to two |
| 11 | The day is overwhelming for a first-time player | Partly agree. Addressed by ordering and no interruptions during learning moments, measured in a playtest |
| 12 | Make the first run a three-beat tutorial | Reject the tutorial; the contract wants the first game in 30 s and the game teaches by consequence. Kept its order: the page scam lands in the first two slots and a later scam uses the leak |
| 13 | The speed bonus punishes careful inspection | Agree. No speed bonus on page and mail cards, and the clock stops while the browser is open |
| 14 | "Leaving is safe" can be gamed; only sent data should count | Agree. Only what the send button sends is scored; filled rows left behind cost nothing |
| 15 | Real-page extra-field scoring is muddy | Agree. Real pages ask only what they need (a Guard rule), so the extra-field rule is gone |
| 16 | The bank alert is a coin flip if untaught | Agree. It comes only right after a leak; the approval-scam twist moves after the freeze |
| 17 | Safari has tabs and no Done; the in-app Safari view has Done and no tabs | Agree. The browser is the in-app Safari view: Done and the address, no tabs |
| 18 | Ship and demo the leak loop even if the rest is thin | Agree. It is the first cut line and the video's main shot |

## Voice: how every sender writes (all Gemini text)

The team found cards stiff ("It is [name]", "let us talk here", no contractions from friends). Every agent that writes text a sender says follows this table: the Director (`server/agents/director.ts`, the Register rule), the Chatter (`server/agents/chatter.ts` and the `TWIN_VOICE` and `SCAM_VOICE` lines in `chatterLines.ts`) and the Aftermath. Style notes only, never a whole message (rule 6).

| Sender | Voice | Style fragments |
|---|---|---|
| Friends and family | texts, not letters: short lines, often no greeting, a lowercase start now and then, shorthand, at most one small typo | "u home yet?", "lol ok", "omw" |
| Family trouble (scam) | the same casual voice, panicked and short, double "!!", no polish | "pls pick up", "can't explain now" |
| Fake buyer or seller | broken, over-earnest English, missing articles, odd tense | "I am genuine buyer", "pls check" |
| Fake bank, wallet, courier, prize desk | a corporate alert template that is slightly off: "[institution]:" in front, Random Title Case, a stiff "kindly", a dropped article | "Your Parcel is On Hold" |
| Fake police or official | stiff, formal, threatening, legal nouns, no contractions | "failure to comply" |
| Romance | warm and flowery, pet names, compliments, builds slowly | "good morning dear" |
| Job and task recruiter | upbeat, chatty, exclamation marks, two emoji at most per card | "Hi dear!", "easy daily income" |
| Investment mentor | confident, chummy teacher | "my students", "today's signal" |
| Boss | clipped and busy, no greeting | "need this done today" |
| Real institution | a real automated alert: terse, templated, one fact per line, a reference of four digits or fewer, no pleading, no "kindly", no "!" | "Ref A2041" |
| The lesson (Coach) | the game's own friendly coach voice, contractions fine, never the sender's slang or template | |

Rules every voice keeps:
- Contractions wherever a person would use them; a person never writes "It is [name]" or "let us".
- English only, readable across Asia Pacific: no words from another language, no dialect particles or slang from any one country. Shorthand (pls, lol, omw, rn, ya) is the only flavour.
- Typos and lowercase never touch a name, an amount, a link or the word "code" (a typo in a name burns the repair turn on `name_not_allowed`).
- A space after every full stop: "ok.see" reads as a link to the Guard.
- Emoji: no Guard or Chatter rule bans them (checked by grep, 16 Oct); recruiters only, never inside a link or an amount.
- Curly apostrophes are turned straight before any check (`asText` in the Director, `straight` in the Chatter), so "it's" passes either way.
- The Guard reads "hey Sis", "Hi Babe", "hun", "mate" as ways to address someone, not names.
- Every Guard text rule still holds: digit runs of four or fewer, made-up brands, `.example` links, no em dash, no "the player", no layout ids, names from the allowed list.

Live check, 16 Oct, developer route: 8 cards across SG, PH, JP and AU, 7 passed the Guard first try and 8 after repair (the one repair was `scaffold_word`, as in the old prompt); 6 of 6 chat replies passed first try. One chat reply named a real video-call app; it is now on the Guard's brand denylist.
