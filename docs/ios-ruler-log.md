# iOS Ruler log

One entry per run of `.claude/agents/ios-ruler.md`. Measured through computed styles at 390x844 and 430x932, DPR 3. SHIP or HOLD; HOLD blocks a deploy until the named fails are fixed or the Builder overrides in words. Deliberate divergences never flagged: 18 px body, 16 px chrome, 15 px alert message, 13 px home labels, 48 px targets, accent #0a70e8, 19 px message text.

## 2026-10-16, uncommitted tree after the UI run (31 web files plus tells.css), local build

Pass counts: lock 11/13, home 8/8, setup 4/6, day lock 5/7, card 9/12, tells 6/8, real-twin note 2/4, recovery 5/7, lesson 5/6, end of day 4/7, lab 5/9, room 1/4, about 2/5, privacy 2/3, call not reached in the app (harness only). Total 69 of 99. Every reduced-motion twin resolves.

Changed since the audit baseline (live revision 3): floating 134x5 indicator instead of a 48 px band; one modal instead of two; lock clock 104 px/600 at 66 percent width (was 148/200 at 87 percent); date 20; no app-name line or pill on the day's notifications; day clock in the status bar on the day lock; card header Messages-style with the app colour behind the time; bubbles #e9e9eb, radius 18, 78 percent, no border, tail and thread time; buttons on the card, no action sheet in the act path; accent #0a70e8; setup rows unboxed; sign-in placeholder gone.

Fails, ranked:
1. Real-twin note screen unreadable: header and status time in ink over the wallpaper (`Lesson.tsx` line 116 section lacks `data-look` and `--app-colour`).
2. Status time unreadable on the tells screen and the scrolled lab (`frame.css .phone:has(.app, .nav-collapsed) .status-bar`).
3. About title at 1.09:1, no nav bar, text-link back (`about.css`, `About.tsx`).
4. Two clocks on the card: real time in the status bar against 08:10 in the thread (`Notifications.tsx` cleanup deletes `data-clock`).
5. Recovery sheet and the call veil start at y 54 and end at 810 (`recovery.css .recovery-sheet`, `call.css .call`).
6. 52 px dead band above the settings nav on lab, room, privacy (`shell.css .settings > .nav`).
7. Edge-to-edge glass bands with hairlines under setup, end of day and the real note (`day.css .page-end`).
8. 1 px outlines on `.action-std`, `.setup-chip`, `.lab-chip`, `.room-chip`, the stamps, the lock notification, the notification cards, the result card image.
9. Lock notification app-name line; the drop-in banner covers the date and clock (`FirstOpen.tsx`, `Notifications.tsx`).
10. Decorative back chevron on the card; `.lab-quiet` blur ghost; underlined install link.

Three worst web-page tells: 1 px outlines on capsules and chips; edge-to-edge bands with hairlines; the dead band above the settings nav next to the About title in ink on the wallpaper.

Notes: the alert message measures 16 px against the 15 in the divergence list; call control labels are 13 px; the alert body and the lock notification carry the same sentence twice on one screen.

Verdict: **HOLD**.

## 2026-10-16, tree after Fix run A (34 modified web and server files on f8c365f), local build

Method: four passes at 390x844 and 430x932, normal and reduced motion, DPR 3, iPhone user agent, 25 screens through the app's own taps; values from computed styles and rects. The call's three views were reached with stubbed start and turn responses (no local beats), so the mount is verified and the real beat path is not. The lab after Generate was not run locally.

Pass counts: lock 27/28, country picker 11/11, home 16/16, setup 13/13, day lock 14/16, card 22/24, tells 10/10, real-twin note 7/9, recovery 11/11, lesson 11/11, call 20/21, end of day 13/13, lab 10/10, room 17/17, about 10/11, privacy 9/9. Total 221 of 230. Every reduced-motion twin resolves.

Changed since the previous entry (69 of 99, HOLD): all four HOLD triggers gone. Real-twin note owns its look, status time in ink at 14.5:1. Tells nav glass spans y 0 to 98; scrolled lab, room, about and privacy bars the same. About has the 44 pt bar and a 34/700 title at 16:1. One clock everywhere on the day. Recovery and the call span the full height. Settings navs at y 0, no dead band. Floating capsules on setup, lesson and end. Chips, capsules, stamps, lock notification and result card unoutlined. Lock notification without the app-name line; banner lands under the clock. Lab quiet button without blur; install row plain. Alert and notification no longer repeat a sentence. The Gemini chip is a 48 px button under the number.

Fails, ranked (fixed in the same session, before commit): the decorative back chevron (dropped when no destination); the glass band under Continue on the real-twin note and under Next on the ended call (page-end now floats everywhere); the 1 px outline on the day's notification cards and stakes pills (border 0); the translucent reduced-motion banner twin (banner appears whole); the 11 px chip text at 3.97:1 (13 px); the 16 px alert message (15 px); underlined About sources (plain accent); the room mirror that could exit the process without local credentials (guarded).

Not failed, noted: home widget 176.5 at 430 against 170 (not verified); trace drawer top radius 10 against iOS 26's larger sheet corner (not verified); glass edges on inset groups and nav capsules; the composer bar hairline; swipe hint 3.2:1 at 430; the alert overlaps the lock notification by 31 px under the scrim at 390.

Verdict: **SHIP**.

## 2026-10-16, live revision 8, commit 107a6f5 (bundle hashes matched a clean build), measured on the live URL

Pass counts: lock 29/29, picker 11/11, home 18/18, setup 14/14, day lock 16/18, card 25/27, tells 10/10, real-twin note 10/11, recovery 12/12, lesson 12/12, call 25/27, end 14/14, lab 10/10, room 17/17, about 11/11, privacy 9/9. Total 243 of 250. Every reduced-motion twin resolves. The call measured on the real path with voiced beats from the bucket. Agent lessons: rows 1, 3, 4 pass; rows 5, 11, 12 fail (5 and 11 failed exactly where the Builder caught them by hand, so the checks work).

Fails, ranked:
1. Feature CSS overrides lose to base.css in the bundle: `main.tsx` imports App before `./base.css`, so `.glass{border:1px}` lands after `.notif,.stakes-pill{border:0}`; the outlines are back on the day's notifications and stakes pills.
2. Call grid labels run under the End disc at 390; at 320 the End disc covers a control (`call.css .call-grid`, `.call-talk-end`).
3. Continue on the real-twin note and Next on the ended call touch the home indicator at 390 and 320 (`lesson.css .app .page-end`, `call.css .call-ended .page-end`; the lesson's 33 px gap is the reference).
4. Thin glass on every collapsed nav shows the wallpaper wave (row 5; fixed in 167eecb, not deployed) and faintly on the lock notification (`first-open.css .lock-notif`).
5. Labels wrapping to two to four lines (row 11; fixed in 80f7c26, not deployed).
6. AI chip text 3.97:1 computed (`card.css .ai-chip-pill`).
7. "Open the link" underlined inside a capsule (`card.css .cta-link`).

Also from row 12: home widgets 152 vs 137 tall at 320; lesson stamps 29, 30, 31 tall; content runs under every floating capsule with no fade; the alert covers the lock notification mid-text at 320 and 390.

Three worst web-page tells: the wave through every collapsed nav; wrapped labels making uneven capsules; content under floating capsules with no fade.

Not verified: the recovery request failed inside the browser in 3 of 7 live passes while curl answered 200 in 0.23 s.

Verdict: **HOLD**.

## 2026-10-16, HEAD 8277ec4 (fix run B), local build from a clean tree (dist 15:50; two later uncommitted edits to base.css and day.css not measured)

Method: build, serve :8080 with GEMINI_ROUTE=developer and CARD_CACHE=file, 320x693, 390x844, 430x932, DPR 3, iPhone UA, normal and reduced motion; computed styles and rects. The call ran on real local beats. No-call via a 503 on /call/start; recovery held 93 s to reach 0. Buttons checked by running HEAD offeredFor on 76 local fixture cards and 32 live generated cards. Local SG has 2 cache cards, so the day served the bracketed fixtures.

Pass counts: lock 29/30, picker 11/11, home 17/20, setup 14/14, day notifications 19/20, card 23/26, tells 10/12, real-twin note 11/11, recovery 13/15, lesson 12/14, call 30/37, end 15/16, lab 10/10, room 17/17, about 13/13, privacy 9/9. Total 253 of 275. Every reduced-motion twin resolves; the ended call's twin lands 34 px off.

Fails, ranked:
1. Home indicator white on white on the ended call, no-call and recovery (computed rgb(255,255,255) on light surfaces): `frame.css .home-indicator span`, key it to `[data-surface=light]` and `.recovery-sheet`.
2. Lesson group header "The scam" 2.27:1 sampled at 390 over the orange band: `shell.css .inset-header`.
3. Raw tell id in the coach line, "You caught synthetic_identity because" (1 of 6 runs): `server/agents/coach.ts`, filter ids to labels.
4. Bracketed stage directions on the day lock, card and lesson whenever the cache is short or down: `server/routes/day.ts cardsFor` returns fixtures.
5. Call number "+XX XXX XXX 2140" on ringing and talking (row 23, second time): `CallScreen.tsx NUMBER`.
6. Caller name scrolled out of view at 320 while talking: `CallScreen.tsx TalkingView` caption `scrollIntoView`.
7. Ended call and no-call Next 34 px higher under reduced motion (563 vs 597 at 320, 714 vs 748 at 390): `call.css .call-ended .page-end`.
8. Buttons vs words (row 20): `.example` links get no Open link; "downloaded your contact list" gets Install; "send the menu link tomorrow" gets Open link; Share code with Read the code on one card; Read the code offered on a fee call with no code: `server/deal.ts CUES`, `server/routes/call.ts` offered.
9. Tells nav glass spread 0.17 to 0.18 (limit 0.15); Done capsule 52 to 100 against a bar ending at 98: `tells.css .tells > .nav`, `.tells .nav > button`.
10. First day notification glass shows the wave, spread 0.20 to 0.22 with the icon excluded: `day.css .notif`.
11. Recovery lead still "You have 90 seconds." in the too-late state: `Recovery.tsx`.
12. Ended call says ended three times ("Practice call · ended", "You hung up.", "Call ended"): `CallScreen.tsx EndedView`.
13. "Dev" as a name (row 23): `shared/people.ts`, `server/agents/director.ts NEUTRAL_NAMES`.
14. Smaller: call avatar ring reads as a doubled stroke (`call.css .call-ring-track`); lock notification body runs 5 lines (iOS stops at 4); home widget "In Singapore, scams arrive on" ends on icons; end page content clips hard at y 54 when scrolled; icon 52 and widget 137 at 320.

Changed since the previous entry (live revision 8, 243 of 250, HOLD): the bundle-order outlines are gone; call grid labels clear the End disc and the indicator by 33 px at every size; Continue and Next float 33 px above the indicator; collapsed settings navs measure 0.10 to 0.15; labels on one line in all six passes (Quick day included); AI chip and cta-link fixed. Run B fixes 2 to 8 hold: hotline on the ended call, no "Practice ·" on notifications, Scammer Survivor on the result card, Messages once, short ended title with body, No call today on 503, too late at 0. Fix 1 holds for most cards and misses the cases in fail 8.

Three worst web-page tells: the invisible home indicator on white screens; the hard clip at the status bar on the scrolled end page; the stage-direction brackets when the fixtures serve.

OpenAI second opinion (gpt-5.5) confirmed and added: fail 12 (triple ended), the 5-line lock notification, the home widget sentence, the end-page clip at y 54, Read the code on the fee call (OpenAI said). Rejected: Share code on the verify card (the card asks for the code), end summary contrast (11.5 to 16.4:1 sampled), About developer copy (row 19 allows it there), recovery ring seam (the 89 of 90 progress gap), the bubble cut by the tray (normal thread scroll). Not verified: the orphan "You" in the coach line, captured mid-stream.

HOLD on one trigger: the lesson header at 2.27:1. The other fails are ranked, not blocking by the brief. The 16:03 uncommitted day.css edit removes the wallpaper under app steps and needs its own ruling once committed.

Verdict: **HOLD**.

## 2026-10-16, HEAD 7d75703, local build from a clean worktree (16 approved SG cards, file cache)

Method: six full passes at 320x693, 390x844, 430x932, normal and reduced motion, DPR 3, iPhone UA; a two-exchange chat in every pass; recovery held to zero; a fast-correct run for the points flight. Computed styles and rects, contrast computed and sampled. Call audio did not play locally (file:// beat URLs); captions and buttons measured.

Pass counts: lock 9/13, home 6/12, setup 4/8, day notifications 8/12, card and chat 9/19, tells 6/8, lesson 6/10, real-twin note 4/6, recovery 5/10, call 10/16, end 5/10, lab 3/5, room 3/4, about 3/5, privacy 3/4. Total 84 of 142 (stricter table than the last entry: home taps, chat, clues, HUD and computed contrast are new rows). Every reduced-motion twin resolves; ended call and note Next land 34 px higher.

Fails, ranked:
1. Swipe hint white on the peach lower wallpaper, 1.62:1 sampled, all sizes (unreadable, default path): `first-open.css .lock-swipe`.
2. Caller name under the status bar at 320 while talking, y 20-30, 1.44:1: `CallScreen.tsx TalkingView`.
3. Home icons open nothing: 4 dock icons and Fold only focus Play: `App.tsx` never passes `onOpenApp` to `HomeScreen`.
4. Home indicator white on white on tells, recovery, ended call (1.0 to 1.01): `frame.css .home-indicator span`, extend the ink rule beyond `.phone:has(.app)`.
5. Setup Done, lesson Next and end Play tomorrow sit on the indicator, gap -1 px (row 14): the `.page-end` bottom inset.
6. Computed contrast under 4.5 (row 15): `.action-std`, `.chat-chip-quiet`, `.setup-chip`, `.lab-chip`, `.recovery-btn` 3.97; `.cta-fill` 3.74; accent on #f2f2f7 4.19 (`.lesson-link`); `.widget-country` 3.4 to 3.7.
7. Lab, room, about, privacy and progress on the wallpaper (row 26): `shell.css .settings`.
8. Composer band with a 1 px hairline, 156 to 272 px tall; at 320 the ask hides under seven buttons; the in-bubble Pay pill is cut by the bar at 390 too (OpenAI said): `card.css .actions::before`, `ActionBar.tsx`.
9. Money buttons (row 20): in-bubble Pay pill plus Pay plus Send money on one card; Pay pill on purchase alerts and an incoming dinner split: `clues/faces.tsx`, `server/deal.ts`.
10. X-masked numbers: "+XX XXX XXX 2140" on the call (third time), "+65 XXXX nnnn" in every card header: `CallScreen.tsx NUMBER`, `AppHeader.tsx`.
11. Status-bar time doubles the big clock on lock and day lock: `PhoneShell.tsx .status-bar > span`.
12. Ticking mm:ss clue timers ("39:56", "09:59") beside the day time, still ticking on the finished note: `clues/faces.tsx`.
13. Recovery lead "You have 90 seconds." at 0 (second time); "500" and "Wallet 5,000" without currency: `Recovery.tsx`, `StakesBar.tsx money`.
14. Ended call: "Practice call · ended", "You hung up.", "Call ended"; ended and note Next 34 px higher under reduced motion: `CallScreen.tsx EndedView`, `call.css .call-ended .page-end`, `lesson.css .app .page-end`.
15. "+100 lightning" flight lands at y 40 over the status icons: `Juice.tsx .juice-points`.
16. HUD on the lock, the tells (competes with the hint, OpenAI said) and the lesson; a bare number and a 46x4 bar with no word; the 3 px speed bar reads as a page-load bar (OpenAI said): `DayScreen.tsx HUD_HIDDEN`, `GameHud.tsx`, `SpeedBar.tsx`.
17. Widget with five targets and two accent text links: `HomeScreen.tsx DayWidget`.
18. Result card image blank (grey, document glyph, "SG", "missed tell: rushing you"): `ResultCard.tsx`.
19. Hard clip under the solid card header and at the top of the end page: `card.css .app-header`, `day.css .end .page-body`.
20. "Dev" as a name (third time): `shared/people.ts`, `server/agents/director.ts NEUTRAL_NAMES`.
21. Smaller: lock notification 5 lines; doubled call ring; recovery ring notch; tells Done 52 to 100 against a 98 bar; clue title ellipsis "Porch light requ..."; "One moment." coach placeholder in 3 of 6 lessons; chat fallback "Your account stays on hold" sent twice by a friend; dock spread 0.161; setup with no nav bar; lock shortcuts are globe and shield, not iOS (OpenAI said); lesson stamps tilted with mismatched baselines (OpenAI said); "Marked" sits in the text line (OpenAI said); # for Ask for ID and a chat glyph for Read the code (OpenAI said).

Changed since the previous entry (8277ec4, 253 of 275, HOLD): fixed: lesson group header (ink on #f2f2f7, 15.6:1 computed), raw tell ids (none in 3 completed coach lines), fixture brackets (none with 16 cards), first notification glass (0.007 to 0.028), tells nav glass (solid white), widget sentence. New: in-app screens grouped and white, flat icons, one widget, dock, HUD, speed bar, clues, reply chips with typing dots and scroll (two exchanges pass), unknown-sender line, boss row. Still open: indicator on light screens, call number, caller name at 320, reduced-motion Next, recovery lead, triple ended, Dev, doubled ring, 5-line notification, end clip, Done overhang. Regressed: bottom buttons now touch the indicator; settings pages still on the wallpaper; the swipe hint lost contrast on the new wallpaper.

Three worst web-page tells: the composer band with a hairline that buries the message; hard clips under solid headers; icons that do nothing when tapped.

OpenAI second opinion (gpt-5.5) confirmed and added the points marked above. Rejected: the lock notification as legal copy (the non-affiliation line is required); the orphan widget label (iOS labels widgets); day-lock glass too thin (0.007 to 0.028 measured); a clipped fourth notification (fully visible); Gemini copy in the lab (row 19 allows it there); "ended x3 overstated" (title plus two literal "ended"). Not verified: Mira's number changing between cards (some cards are scams claiming a new number).

HOLD on two triggers: the swipe hint at 1.62:1 and the caller name at 320 at 1.44:1. By the letter of the brief the lock and day lock also show two clocks (same value).

Verdict: **HOLD**.

## 2026-10-16, HEAD 9b18a5e, local build from a clean worktree (ss-qa file cache, local beats)

Method: 12 passes at 320x693, 390x844, 430x932, normal and reduced motion, DPR 3, iPhone UA: 6 full days (lock to end, More sheet, in-app browser, autofill, send, full-screen ring on the lock, voicemail banner, voicemail, call back, code notice, ended, settings) and 6 banner days (ring banner and voicemail banner over a card). Computed styles and rects, contrast computed and sampled. Call audio is file:// locally, so beats ran on the caption timer. The page scam leak reached the next scam on screen ("Jordan Lee", "card 4417") in 6 of 6 full days.

Pass counts: lock 11/12, home 8/9, empty app 7/7, setup 6/6, day lock 5/7, card 6/10, More sheet 5/6, browser 6/7, autofill 2/3, sent 2/3, tells 5/5, recovery 5/5, lesson 4/8, real-twin note 3/3, ring on the lock 4/6, ring banner 5/6, voicemail banner 4/5, voicemail 3/6, call talking 4/7, code notice 3/4, call ended 4/5, end 3/5, lab 2/3, room 3/3, about 3/3, privacy 3/3. Total 116 of 147 (32 new rows for the new screens). Every reduced-motion twin resolves (ring pulse static at 0.6, banners appear whole, call fades).

Fails, ranked:
1. Caller name under the island at 320 while talking, y 20, 1.5:1, when the caption is long; with a shorter caption the caption runs 34 px under the button grid (289-480 vs grid 446): `CallScreen.tsx TalkingView`, `call.css .call-caption` (cap its height and scroll inside it). Third time (8277ec4, 7d75703).
2. No status time on the full-screen ring, voicemail, talking and ended screens over the day lock (sampled 1.0): `first-open.css` line 64 `.phone:has(.lock, .day-lock) .status-bar > span:first-child` also fires under `.call-layer`; add `:not(:has(.call-layer))`.
3. Day lock clock runs backward when the newest card is opened first (17:05, 13:20, 10:40, 08:10); voicemail row shows 08:10 while the lock reads 13:20 and its banner said now: `Notifications.tsx` line 56 `latest(cards)` over remaining cards, `Voicemail.tsx dayTime`.
4. Score capsule undimmed above the More sheet scrim (252 vs 150 sampled): `juice.css .game-hud` z-index 40 over `tray.css .sheet-scrim` 20.
5. Browser Send button cut flat by the hint band (726-774 vs band 768) and 24 px under the autofill strip: `browser.css .safari-page`, `.safari-hint`, `.quicktype`.
6. Masked numbers: "+65 XXXX 2841" on card headers and lesson rows (second time), the dot-masked call number on the ring, banner and voicemail (fourth time for the call number): `AppHeader.tsx`, `server/agents/caller.ts` number table.
7. Tray buttons 44 px and Quick day 40 px against the 48 px rule: `tray.css .action-std, .cta`, `home.css .widget-quick`.
8. Code beat caption "the practice code on screen" as a fragment, naming a practice code while the text shows a one-time code (14 of 16 local beat files): `scripts/tts-beats.ts` code beat.
9. Buttons and words: Pay pill on a real refund credit; a real twin that says to use your one-time code at a link: `clues/faces.tsx`, `server/deal.ts`, `server/agents/director.ts` real-twin rules.
10. Voicemail banner on the lock lands on the stack and cuts a notification; the arriving banner covers the Wallet and People widgets: `voicemail.css .vm-banner`, `day.css .notif-banner`.
11. Smaller: ledger "500 gone, 300 back" and "Wallet 4,800 of 5,000" without SGD (`ledger.ts` line 55, `EndOfDay.tsx` line 99); "id photo" lowercase on the sent box (`PageView.tsx` line 100); coach stuck on "One moment." in 1 of 6 (`Lesson.tsx` line 65); lesson stamp and lab chips wrap at 320; text ghosts through the collapsed end nav; the alert covers the lock notification by 80 px at 320; HUD "0" with no word.

Changed since the previous entry (7d75703, 84 of 142, HOLD): fixed the swipe hint (1.62 to 5.3-6.0), home icons open their apps, ink indicator on light screens, bottom buttons 33 px above the indicator, tray accent ink 5.16:1, settings on grey, the composer band and its hairline, one clock on lock and day lock, mm:ss clue timers, recovery currency, triple ended, the reduced-motion Next offset, the result card, Rohan for Dev, the 5-line notification. Still open: masked numbers, a money pill on a non-money card, the caller name at 320, the coach placeholder. New: browser, autofill, sent box, empty apps, More sheet, ring banner, full-screen ring, voicemail banner and screen, code notice.

Three worst web-page tells: page content cut flat by the browser hint band; the score capsule floating undimmed over a modal scrim; text ghosting through the collapsed end nav.

OpenAI second opinion: not run. The call returned 429 insufficient_quota, "credit_balance_exhausted", on a one-line probe as well; the account needs credits.

HOLD on one trigger by the letter of the brief: the unreadable caller name and covered caption at 320 on the default call path. Fail 2 (no status time over the call and voicemail) is ranked, not a trigger.

Verdict: **HOLD**.
