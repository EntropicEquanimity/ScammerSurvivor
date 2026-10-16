# UX plan: Scammer Survivor

Rewritten 3 Oct 2026 to match `docs/superpowers/specs/2026-10-03-practice-phone-design.md`. Where this doc and the spec disagree, the spec wins. English copy only. Every wireframe uses bracketed placeholders; no finished scam line appears anywhere in this file.

## Design principles

### Phone interface study, 3 Oct 2026

The implemented preview adds familiar phone conventions: status bar, notification centre,
app grid, unread badge, bottom dock, back navigation and a home indicator.
The mobile shell fills the viewport; desktop uses a phone frame beside an art-direction picker.
These are original surfaces and marks, with no borrowed platform assets.
Navigation follows the distinction between destinations and content actions in
[Apple's tab bar guidance](https://developer.apple.com/design/human-interface-guidelines/tab-bars).

Three looks can be compared live through Appearance:

| Direction | Visual choices | Intended use |
|---|---|---|
| Daylight | Clear blue wallpaper, crisp white surfaces, vivid original app icons | Recommended everyday default |
| After hours | Midnight ink, amber accents, angular wallpaper loops | Optional evening look |
| Paper cut | Cream, ochre and clay shapes, crisp outlines, serif home heading | More expressive workshop direction |

The controls and exercise remain identical across looks. Appearance lasts for the visit.
The exact practice label and non-affiliation sentence come from `shared/strings.ts`
and stay outside the scrolling exercise in `PhoneShell`.

This slice includes one existing scripted chat, its scored lesson, a session summary,
Appearance and Privacy. Other app tiles are marked coming soon. Both age groups use the
same prepared, model-free endpoint in this slice. The younger group must receive a
separate cache-only server path before any model generation is added to the day route.
The interface offers English only; legacy translation fixtures are not exposed by the picker.
The full country deck, live call, generated cards and part-based tell tapping remain future slices.

Validation: the message, reply, tell selection, lesson and session score were exercised in
the browser. All three looks were inspected at 390 by 844, with a narrow layout check at
320 by 700. The score was retained from the lesson into My practice. The default home dock
fits at 390 by 844; shorter viewports scroll the phone content while retaining both notices.

### Shared rules

1. Anyone, any age, any JAPAC country. Large type and plain words are the default, not an accessibility mode.
2. Act, never label. No screen ever asks "real or fake?". The buttons are the real options, and the consequences show on the phone.
3. Calm, not scary. The frame uses ink on paper with one warm notice colour. Red appears nowhere in the frame.
4. The made-up apps feel like the real ones through layout, never through names, logos or brand colours.
5. The practice label and the non-affiliation sentence are visible in the same viewport as every mock, including calls.
6. Nothing is typed. Every interaction is a tap.

## Player journey

1. **Open the link.** Country shown at the top from the time zone, with Change. "Use my location" appears only when the zone is ambiguous.
2. **Age screen.** "18 or older" or "under 18". Under 18 gets cached cards only, no sign-in, no call.
3. **Pack screen.** "In [country], most scams arrive on these apps", three app tiles in the pack's order, a confidence label ("from police statistics" or "based on usage"), and Play. The quick day is offered to first-time players.
4. **The day.** The clock runs morning to night. The wallet and the people who count on you sit in the status area. Notifications pop from the three apps in turn; tapping one opens the card inside that layout.
5. **A card.** The message or call with its action buttons and, inside a scam, the buttons the scam itself offers. After acting, the player taps the parts of the message that gave it away.
6. **The lesson.** The real twin and the scam side by side, differences marked, the usual ending, what that institution or person never asks, the country hotline and reporting link.
7. **The call.** Last card of a full day: the practice-call screen with the meter and six buttons. Skipped on a quick day.
8. **End of day.** Money kept, people kept, the collection by category, the one tell most missed. Then, for 18-or-older players, "Sign in with Google to keep your progress".

## Screen inventory

| Screen | Purpose | Key elements | Build order |
|---|---|---|---|
| First open | Country and age | Country line with Change, "Use my location" when needed, 18-or-older and under-18 buttons, label, non-affiliation sentence, privacy link, contact email, "not affiliated" line | 1 |
| Pack | Choose where to practise | Three app tiles, confidence label, "new this week" mark where present, Play, Quick day | 2 |
| Day | The frame around every card | Clock, wallet, people strip, notification cards from the three apps | 2 |
| Card (chat looks) | One decisive moment | The thread in the chosen look, action bar, in-message risk buttons | 2, 5 |
| Card (text messages, e-wallet, email) | Same, other layouts | Same action bar; the e-wallet "enter the one-time code" is a button | 5 |
| Spot the tell | Tap what gave it away | The message with tappable parts, Done | 4 |
| Lesson | Teach the difference | Side-by-side real and scam, marked differences, usual ending, hotline, Next | 3 |
| Call | The boss fight | Practice-call banner, invented institution, masked number, confidence meter, practice code (a word), six buttons, captions | 8 |
| End of day | The result | Money kept, people kept, collection by category, most-missed tell, sign-in offer (18 or older), Play tomorrow | 2 |
| Collection | Browse turned cards | Ten category rows, each card beside its real twin | 4 |
| Language picker | Choose a language | Every JAPAC language; "translated by AI" or "reviewed" note per language; English first | 6 |
| Privacy notice | Say what is stored | The retention table in plain words, fonts, sign-in, location, AI content | 1 |
| Delete my data | Remove the record | One confirm button, then signed out | 7 |
| Approval page (team only) | Approve Scout notes | Note, source, date, Approve and Reject | 9 |

## Phone shell, label and sentence

| Part | Rule |
|---|---|
| Frame | A phone outline on the paper background; on a laptop it sits left of centre with a notes panel on the right |
| Label | "Practice. Not a real message." as the top bar of every screen; the call screen reads "Practice call" |
| Sentence | Under the label on first open, in the footer of every mock: "To make scenarios realistic, we may mention real platforms or services. These references are for illustrative purposes only and do not imply any affiliation, endorsement, or criticism." |
| Status bar | Time from the day clock, a signal glyph, wallet amount |
| Look | iPhone layout with the glass look (9 Oct 2026): translucent surfaces over the generated wallpaper, system font, ink `#1c2027` on paper `#eef0f3`, 16px minimum for frame chrome, 18px for copy, sentence case |

## The seven layouts as a design system

One chat component carries five looks. Text messages, email and e-wallet are their own components. Every layout has a placeholder name `[name]` until the naming step, an original mark, and a colour rule from the viability research in `docs/compliance.md`.

| Layout | Modelled on | Keeps (generic conventions) | Must avoid |
|---|---|---|---|
| green-chat | WhatsApp family | Header with avatar and name, left and right bubbles, timestamps, read indicator, voice-note bubble | WhatsApp green (`#25D366`, `#075E54`, `#128C7E`), blue double ticks, the telephone-in-bubble icon |
| blue-chat | Messenger family | Round avatars, bubble colour for the sender, reactions row, "active now" line | Messenger blue and its gradient, the lightning mark |
| sticker-chat | LINE, KakaoTalk, Zalo family | Sticker row, read counts, official-account badge, bright accent | LINE green (`#06C755`), Kakao yellow (`#FEE500`), Zalo blue |
| cloud-chat | Telegram family | Channel and group headers, forwarded tag, inline buttons, file bubbles | Telegram blue (`#0088CC`, `#229ED9`), the paper-plane mark |
| purple-chat | Viber family | Sticker row, call banner, group chat header, "message seen" line | Viber purple (`#7360F2`, `#655CAC`), the phone-in-bubble icon |
| text messages | Any SMS app | Sender ID line, grey incoming bubbles, link shown as plain text | Blue or green bubble pairs that read as a known phone OS |
| email | Every mail client | Inbox list, round avatar, subject and snippet, opened message, overflow menu with "Report spam" and "Report phishing" | Google palette, Google Sans, the envelope mark, any Gmail-only control |
| e-wallet | Any wallet or bank app | Balance card, send and receive, transaction list, payment request, an "enter the one-time code" button | Any real wallet's signature colour; QR code as the main element |

Rules for all layouts:
- Read indicators use words ("Delivered", "Seen") or a neutral glyph, never blue double ticks.
- Emoji come from a licensed set (Noto or Twemoji), never Apple emoji.
- Fake links are plain text spans styled as links. Nothing navigates.
- Each layout's primary colour is chosen at the naming step and recorded in `shared/brands.ts`; the colours above are the ones it must not be or resemble.

## Action bar and in-message buttons

| Button | Shown on | Counts as |
|---|---|---|
| Reply | Chats, text messages, email | A reply through the same channel |
| Ignore | All | Leaving it |
| Block and report | All | The safe reply for a scam; a false alarm for a real message |
| Verify by calling the number you already know | All | The safe check |
| Pay, Open the link, Send money, Share the code, Install, Keep it secret | Inside a scam, as the scam offers them | Unsafe replies; the usual ending plays |
| Approve, Decline, Enter the one-time code | E-wallet | The code button is always the wrong move and never opens a field |
| Answer, Decline | Incoming call | Taking or leaving the call |

Two taps are never required to act: one button, one result. Buttons carry words, not only icons or colours.

## Spot the tell

After acting, the same message is shown with its parts tappable (sender line, number, link text, each sentence, each attachment or button). Tapping a part that carries a tell marks it; tapping a part with none is a false flag. A tell counter shows "2 of 3 found" without saying which are left. Done ends the step. On a real message, the step says "Nothing to find here. Was anything suspicious?" and any tap is a false flag.

The nine tells, as shown in the lesson: trust-building, urgency, isolation, escalation, authority, payment substitution, credential theft, platform migration, synthetic identity.

## The lesson

- Two columns on a laptop, two stacked cards on a phone: the real twin and the scam, the tells marked in place on the scam.
- One line per tell in plain words.
- "What [institution or person type] never asks for."
- The usual ending from the card: what happens if you comply.
- The country hotline and reporting link from the pack.
- Tone: never shames. "Most people would have hesitated here" over "You fell for it".

## End of day and the collection

- Four figures: money kept, people kept, scams caught (of those shown), real messages trusted (of those shown).
- The collection: ten category rows, each with "[n] of [m] collected" and the turned cards, each beside its real twin.
- "The tell you miss most" with one sentence, and "It comes back tomorrow".
- "Sign in with Google to keep your progress across devices", 18 or older only.

## The call screen

| Element | Rule |
|---|---|
| Banner | "Practice call" in the label bar |
| Caller | Invented institution from the brand registry and a masked number in that country's pattern (`09XX-XXX-dddd` or the country's equivalent) |
| Meter | A bar across the top labelled "Caller's confidence", moved only by code |
| Practice code | A word, never digits, under the heading "Your practice code" |
| Buttons | Ask for a reference number, I'll call you back, Refuse the code, Read the code, Hang up, Hang up and call the official number |
| Captions | Live captions of the caller's speech, always on |
| Video variant | A blurred placeholder frame with "Camera not working" and the same buttons; the broken camera is itself a tell |

The player's own speech is heard by the caller so the call feels real, and never scored; the buttons are what count.

## Language picker

- Every JAPAC language listed, English first.
- Each non-English language shows "Translated by AI" or "Reviewed" beside its name.
- When playing in a translated language, every card and lesson shows a small "Translated by AI" note and a one-tap "This reads wrong" button that flags that card for review. No text field opens.
- Translations come only from approved English cards and are translated part by part, so the tappable parts and their tells stay aligned.
- The call stays in English for the Cup; the picker says so on the call card.

## Accessibility rules for the Cup build

| Rule | Value |
|---|---|
| Body text | 18px minimum; message text 19px |
| Tap targets | 48px minimum with 8px between |
| Contrast | 4.5 to 1 for text, 3 to 1 for large type |
| Timers | None that punish slow reading; the day clock is decorative |
| Captions | On every call |
| Screen readers | Every button and tappable part has a label; the tell counter is announced |
| Motion | Respects the reduced-motion setting; no autoplaying motion |
| Text size | The phone's own setting is respected; the chat screen still works at 200% |
| Colour | Never the only carrier of meaning; every state has a word |

## Wireframes

First open:

```
[Practice. Not a real message.]
Country: [country]  Change
Practise spotting scams
This is practice only. No real money or accounts.
[ Yes, I am 18 or older ]
[ No, I am under 18 ]
Not affiliated with any brand. Every app shown here is made up.
Practice messages may be AI-generated.
[non-affiliation sentence]
Privacy notice   Contact: [email]
```

Pack screen:

```
[Practice. Not a real message.]
In [country], most scams arrive on these apps
(from police statistics)
[ [name] green-chat ]  [ [name] cloud-chat ]  [ [name] e-wallet ]
[ Play a day ]   [ Quick day, 60 seconds ]
```

A card in a chat look:

```
[Practice. Not a real message.]
< [sender display name]   [masked number]
  [real-twin message: an ordinary message of the same kind]
  [scam message: setup, then the ask]  [ Open the link ] [ Send money ]
[ Reply ] [ Ignore ] [ Block and report ] [ Verify by calling the number you know ]
[non-affiliation sentence]
```

Spot the tell:

```
[Practice. Not a real message.]
Tap what gave it away      2 of 3 found
[sender line] [number] [sentence 1] [sentence 2] [link text] [button]
[ Done ]
```

Lesson:

```
[Practice. Not a real message.]
Real                         Scam
[real twin]                  [scam with tells marked]
Urgency: [one line]
Credential theft: [one line]
A [institution type] never asks for [thing].
If you had complied: [usual ending]
Report it: [hotline]  [reporting link]
[ Next ]
```

Call:

```
[Practice call]
Caller's confidence  [########------]
[institution name]   [masked number]
Your practice code: [WORD]
[captions of the caller]
[ Ask for a reference number ] [ I'll call you back ] [ Refuse the code ]
[ Read the code ] [ Hang up ] [ Hang up and call the official number ]
```

End of day:

```
[Practice. Not a real message.]
Day over
Money kept [amount]   People kept [n] of [m]
Scams caught [n] of [m]   Real messages trusted [n] of [m]
Collection: Investment 2 of 4, Delivery 1 of 3, ...
The tell you miss most: [tell]. It comes back tomorrow.
[ Sign in with Google to keep your progress ]   [ Play tomorrow ]
```

## Motion and sound

- Notifications slide in from the top with a short tone; both respect reduced motion and a mute toggle on the day screen.
- The meter moves in steps, never smoothly, so each move reads as a cause.
- No confetti, no shaking screens, no red flashes.

## Never on any screen

- A text field or keyboard of any kind.
- A real brand name, logo, icon, typeface or signature colour inside a mock; the forbidden colours above.
- A real link, a working form, a QR code that scans to anything, a receipt that could be screenshotted as proof of payment.
- A "real or fake?" prompt.
- A countdown that penalises reading time.
- Any scam line in docs, fixtures or wireframes: bracketed placeholders only.
- Any language-specific special treatment beyond the picker notes.

## Playtest questions

1. Does a first-time player reach a scored card inside 60 seconds without help?
2. Do players understand that blocking a real person has a cost, from the people strip alone?
3. Which tells do players tap first, and which never?
4. Does the side-by-side lesson change behaviour on the next card of the same kind?
5. Is the meter on the call read as the caller's confidence, not the player's score?
6. On a translated language, how often is "This reads wrong" pressed, and on which parts?
