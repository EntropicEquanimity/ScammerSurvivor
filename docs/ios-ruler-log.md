# iOS Ruler log

One entry per run of `.claude/agents/ios-ruler.md`. Measured through computed styles at 390x844 and 430x932, DPR 3. SHIP or HOLD; HOLD blocks a deploy until the named fails are fixed or Angel overrides in words. Deliberate divergences never flagged: 18 px body, 16 px chrome, 15 px alert message, 13 px home labels, 48 px targets, accent #0a70e8, 19 px message text.

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
