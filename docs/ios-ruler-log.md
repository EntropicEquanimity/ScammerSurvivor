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
