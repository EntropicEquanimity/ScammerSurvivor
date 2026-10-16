# Copy deck: plainer, friendlier words

Every line the player reads, screen by screen. The voice: a friendly game, second person, plain words, short sentences, calm and never blaming. "Tell" is never used alone on a play screen: it is "red flag" or "what gave it away". Lines where the phone itself talks (alerts, notifications, call screens, "Not delivered", "Transfer sent") keep the iOS system style.

Line numbers are after the change. "Applied" tables are in this commit. "Hand-off" tables are for files other builders are editing right now; nothing in them was changed here.

## Kept on purpose

- The practice label "Practice. Not a real message." (`shared/strings.ts:1`), "Practice call" on every call, and the 18-and-over lines: wording required by AGENTS.md rules 1 and 9.
- The non-affiliation sentence keeps all three legal parts (everything is invented; real brands appear only as plain words in lessons; nothing implies affiliation, endorsement or criticism). Only two words got plainer, and it is two characters shorter, so the first-open alert does not grow.
- Scoring words and action meanings: caught, fell for it, trusted, ignored, blocked, checked, they did not hear back. `web/src/features/day/ledger.ts` already matches the meanings the team set and is being edited by another builder, so it is untouched.
- `server/agents/chatterLines.ts`: every line is a sender speaking in character, already plain and short. No change.
- `shared/chips.ts`: every chip is already a short question in the player's own voice, under 16 characters. No change.
- Lock screen, age alert, age block, home widget, country picker, voicemail, code text, incoming banner: already plain. No change.
- Judge Lab and About keep their technical words (Director, Guard, cache): they are the judge-facing pages, the one place agent-lessons row 19 allows them. Only the lines a player could reach were touched.
- `web/src/strings.ts` blocks `firstOpen`, `home`, `chat`, `flags`, `debrief`, `notes` and `twinLine` are not rendered anywhere, so they were left as they are.

## Applied

### Privacy page

| File:line | Now | New | Note |
|---|---|---|---|
| web/src/shell/PrivacyNotice.tsx:12 | What this phone does with you | Your data | The old header read oddly. |
| web/src/shell/PrivacyNotice.tsx:20 | About the apps shown | About the apps here | |
| web/src/strings.ts:85 | This is a training simulation. Nothing here is a real message, account or payment. | This is a practice game. No message, account or payment here is real. | |
| web/src/strings.ts:87 | Your button choices go to our server to work out your score. This version does not save them. | Your taps go to our server so it can work out your score. It does not save them. | Same meaning. |
| web/src/strings.ts:88 | Your device remembers your age group and your country. Practice results last for this visit only. | This device remembers your age answer and your country. Your results last for this visit only. | |
| web/src/strings.ts:34 | Practice messages may be AI-generated. | Some messages here may be written by AI. | |
| web/src/strings.ts:36 | Contact the team through the repository | Ask the team on the project page | |
| web/src/shell/PrivacyNotice.tsx:30 | a `mailto:` link to a web address | an `https://` link that opens the project page | Bug fix: the row was a mail link to a URL, so it did nothing. Constant renamed CONTACT_EMAIL to CONTACT_PAGE. |

### Non-affiliation notice (lock alert, once-per-visit sheet, Privacy page)

| File:line | Now | New | Note |
|---|---|---|---|
| shared/strings.ts:3 | Every app and institution here is invented. Real brands appear only as plain words in lessons, and nothing here implies affiliation, endorsement or criticism. | Every app and organisation here is made up. Real brands appear only as plain words in lessons, and nothing here implies affiliation, endorsement or criticism. | Legal meaning unchanged: "invented" to "made up", "institution" to "organisation". |

### My practice, empty apps, About rows

| File:line | Now | New | Note |
|---|---|---|---|
| web/src/shell/PhoneTools.tsx:49 | Your practice in this visit. Every choice is a chance to learn. | How your practice is going this visit. Every choice teaches you something. | |
| web/src/shell/PhoneTools.tsx:62 | Go to my phone | Go to the home screen | Names where the row takes you. |
| web/src/shell/EmptyApp.tsx:39 | They arrive here during your practice day. | New ones land here when you play your day. | |
| web/src/App.tsx:77 | Watch Gemini write a card and code check it, answer key open. | Watch Gemini write a message and code check it, with the answers shown. | No "card", no "answer key". |
| web/src/App.tsx:78 | A family, an office or a group plays the same day; you see the tells they missed. | A family, an office or a class plays the same day. You see the red flags they missed. | |
| web/src/features/about/About.tsx:198 | Gemini writes the day, code checks every card and keeps every score. | Gemini writes the day. Code checks every message and keeps every score. | |
| web/src/features/lab/JudgeLab.tsx:236 | The lab is for adults. Younger players practise on reviewed cards only. | The lab is for people 18 and over. | Meaning changes on purpose: under 18 cannot enter at all since 16 Oct (rule 9), so the old second sentence was wrong. |

### Lesson (scam)

| File:line | Now | New | Note |
|---|---|---|---|
| web/src/features/lesson/LessonGroups.tsx:42 | What made it suspicious | What gave it away | Same words as the tap step. |
| web/src/features/lesson/LessonGroups.tsx:65 | The real one | What the real one looked like | Says what the group shows. |
| web/src/features/lesson/LessonGroups.tsx:79 | Only finds a parcel. | It only finds a parcel. Low risk on its own. | Says why it is fine. |

### Red flag names and why lines (lesson stamps, end of day, room, Coach fallback)

Each why is 17 to 25 words, second person, and passes the Coach line check (`server/agents/coach.ts` lineOk).

| File:line | Now | New | Note |
|---|---|---|---|
| shared/taxonomy.ts:28 | Borrowed authority | Posing as official | Plain words, same 18 characters, so stamps and the boss line keep their width. |
| shared/taxonomy.ts:13 | Fake testimonials, group members, professional branding, a small first payout or affection are there to make you lower your guard. | Fake reviews, friendly group members, a polished look, a small first payout or sweet talk are there to make you drop your guard. | |
| shared/taxonomy.ts:17 | A deadline, "today", an expiring parcel or points, an emergency or a threat leaves no time to think or ask someone. | A deadline, "today only", an emergency or a threat is there so you act before you can think or ask someone. | |
| shared/taxonomy.ts:21 | Asking you to keep it secret, not tell family or colleagues, or move to a private chat cuts you off from the people who would check. | Being told to keep it secret, tell no one or move to a private chat cuts you off from the people who would check. | |
| shared/taxonomy.ts:25 | A small payment, then a bigger one, then an unlock, tax, verification or recovery fee is how the loss grows. | A small payment, then a bigger one, then a fee to unlock it all is how the loss keeps growing. | |
| shared/taxonomy.ts:29 | A bank, police, government, CEO, celebrity, school, courier or regulator as the sender is meant to stop you questioning it. | A sender who claims to be a bank, the police, a boss, a courier or a famous name is counting on you not to question it. | |
| shared/taxonomy.ts:33 | Crypto, gift cards, QR codes, a personal account or a cash handover cannot be traced or reversed. | Crypto, gift cards, a QR code, a personal account or cash in hand cannot be traced or taken back. | |
| shared/taxonomy.ts:37 | A request for a one-time code, password, PIN, card number, login, recovery code, ID copy or screen share hands over your account. | Giving a one-time code, password, PIN, card number, ID photo or your screen hands someone your account. | |
| shared/taxonomy.ts:41 | Something that started on social media, a dating app, a job portal or a text message and moved to a private chat is leaving the place that could flag it. | Moving you from where it started to a private chat takes you away from the app that could warn you. | |
| shared/taxonomy.ts:45 | Stolen photos, a made-up employment history, an AI voice or face, or "camera broken" hide who is really there. | Stolen photos, a made-up work history, an AI voice or face, or a "broken camera" hide who is really there. | |

### Practice call, after it ends

Titles are unchanged (they stay under 16 characters for the 34 px title).

| File:line | Now | New | Note |
|---|---|---|---|
| web/src/features/call/CallViews.tsx:94 | ...not the one in the voicemail. That is the whole trick. | ...not the one in the voicemail. That is how to check. | "Trick" read like the scam's trick. |
| web/src/features/call/CallViews.tsx:97 | You hung up and called the official number. That is the whole trick. | You hung up and called the official number. That is how to check. | |
| web/src/features/call/CallViews.tsx:96 | The caller kept pushing until the call ran out. Hanging up is always allowed. | The caller kept you talking until time ran out. You can always hang up. | |
| web/src/features/call/CallViews.tsx:98 | That is always allowed. Next time, call the official number you already know as well. | You can always do that. Next time, also call the official number you know. | |
| web/src/features/call/CallViews.tsx:93 | Calling back the voicemail put you through to the same caller. | Calling the voicemail number back reached the same caller. | |
| web/src/features/call/CallViews.tsx:105 | Your phone showed Unknown. Real callers do that too, so the label alone never decides. | Your phone showed Unknown. Real callers can show that too, so it proves nothing either way. | |

### Money sent: the recovery sheet

| File:line | Now | New | Note |
|---|---|---|---|
| web/src/features/recovery/Recovery.tsx:62 | Once it has gone through, the minutes after matter most. | Once money has gone, the first minutes matter most. | |
| web/src/features/recovery/Recovery.tsx:68 | Quick action brings some money back. Faster is more. | Acting fast got some of it back. The faster you act, the more comes back. | |
| web/src/features/recovery/Recovery.tsx:70 | Nothing came back this time, but the report counts. Freezing the account first brings more back. | Nothing came back this time, but reporting still helps. Freezing your account first gets more back. | |

### Make it your phone (setup)

| File:line | Now | New | Note |
|---|---|---|---|
| web/src/features/setup/SetupScreen.tsx:70 | Pick the people scammers would pretend to be. Names only, nothing real. | Pick names for your people. Scammers will pretend to be them. Every name is made up. | |

### Room (facilitator)

| File:line | Now | New | Note |
|---|---|---|---|
| web/src/features/room/RoomPage.tsx:61 | Everyone plays the same practice day on their own phone. You see who fell for which tell. Nobody is named. | Everyone plays the same practice day on their own phone. You see which red flags fooled the group. No names are shown. | |
| web/src/features/room/RoomPage.tsx:62, 64 | Country pack | Country | "Pack" is a build word. |
| web/src/features/room/RoomPage.tsx:85 | Create the room | Start the room | Matches the page title. |
| web/src/features/room/RoomPage.tsx:207 | Writing the debrief / Write the group debrief | Writing the summary / Write a group summary | |
| web/src/features/room/RoomPage.tsx:209 | The debrief needs at least one finished day. | The summary needs at least one finished day. | |
| web/src/features/room/RoomPage.tsx:210 | The debrief did not arrive. Try again. | The summary did not arrive. Try again. | |
| web/src/features/room/RoomPage.tsx:212 | Group debrief, written by Gemini from the counts above | Group summary, written by Gemini from these numbers | |
| web/src/features/room/RoomPage.tsx:229 | This room is not open. Rooms live while the server does; start a new one. | This room has closed. Start a new one. | No server talk. |
| web/src/features/room/RoomPage.tsx:236 | real trusted | real ones trusted | Same words as the result card. |
| web/src/features/room/RoomPage.tsx:239 | Tells missed most | Red flags missed most | |
| web/src/features/room/RoomPage.tsx:240 | Tricks, caught against fell | Scams, caught and fallen for | |
| web/src/features/room/RoomPage.tsx:240 | No scam scored so far. | No scams scored so far. | |
| web/src/features/room/RoomPage.tsx:164 | caught 2, fell 1 | caught 2, fell for 1 | |
| server/routes/room.ts:281 | No tell was missed. Keep tapping the words that give it away. | No red flag was missed. Keep tapping what gives it away. | The summary used when Gemini does not answer. |
| server/routes/room.ts:282 | Safest action next time: stop, and verify by calling the number you already know. | Safest move next time: stop, then call the number you already know. | |

## Hand-off (files other builders are in; nothing changed here)

The brief's example ("Tap what gave it away. Tap again to unmark. If nothing did, tap Done.") is no longer in the code; the tell step now reads as below. The proposals are for the current text.

| File:line | Now | Proposed | Note |
|---|---|---|---|
| web/src/features/card/TellPicker.tsx:22 | Tap each part that gave it away. Fast finds earn a bonus. | Tap each red flag you see. Quick finds score more. | 10 words. |
| web/src/features/card/TellPicker.tsx:23 | Anything odd? Tap it. | Tap anything that looks wrong, or tap Nothing odd. | The old hint repeated the title. |
| web/src/features/card/TellPicker.tsx:51 | {n} marked | {n} tapped | Names the action. |
| web/src/features/card/actionLabels.ts:20 | Refuse code | Say no | Call disc labels should stay at 10 characters or fewer (agent-lessons row 11). |
| web/src/features/card/actionLabels.ts:21 | Read the code | Read code | Same rule. |
| web/src/features/card/actionLabels.ts:23 | Call official | Check it | Names the result; 13 characters is over the disc limit. Owner to confirm it reads apart from "Call to check". |
| web/src/features/chat/ChatThread.tsx:42 | They stopped answering. Decide now: a Reply now is your final answer. | They stopped replying. Your next tap is your final answer. | |
| web/src/features/lesson/LessonRows.tsx:51 | What you flagged | What you tapped | Another builder started editing this file during this pass, so it left the commit. |
| web/src/features/lesson/LessonRows.tsx:58 | Not a tell | Not a red flag | Already in that builder's working copy from this pass; keep it when committing. |
| web/src/features/lesson/title.ts:152 | You flagged nothing. Correct, it was real. / You flagged N parts of a real message. | You tapped nothing. Right, it was real. / You tapped N parts of a real message. | "Tapped" names the action. |
| web/src/features/lesson/title.ts:153 | You flagged nothing. It was a scam. | You tapped nothing. It was a scam. | |
| web/src/features/lesson/title.ts:31 | You engaged with a scam. | You replied to a scam. | "Engaged" is jargon. |
| web/src/features/day/EndOfDay.tsx:139 | The tell to watch | The red flag to watch | |
| web/src/features/day/EndOfDay.tsx:140 | No tell slipped past you today. | No red flag got past you today. | |
| web/src/features/day/EndOfDay.tsx:147 | The tell you miss most | The red flag you miss most | |
| web/src/features/day/EndOfDay.tsx:152 | It comes back subtler tomorrow. | Tomorrow it comes back harder to spot. | |
| web/src/features/day/ResultCard.tsx:41 | No tell got past you | No red flag got past you | Check the canvas line width. |
| web/src/features/day/DayScreen.tsx:143 | Checking what can still be done. | Seeing what you can still do. | |
| web/src/features/juice/GameHud.tsx:73 | combo, points double | streak, double points | Screen reader text. |
| web/src/features/aftermath/AftermathScene.tsx:101 | They: | (the sender's name) | Screen reader text; a bare "They:" reads as a placeholder (agent-lessons row 23). |
| web/src/features/browser/SafariView.tsx:60 | Tap a row to fill it, or Done to leave. | Tap a row to fill it in. Tap Done to leave. | |
| server/deal.ts:266 | Keep checking the same way: the number you know, the official app. | Keep checking this way: call the number you know, or open the official app. | The real message's "Next time" line. |
| web/src/features/day/ledger.ts | (all rows) | no change | Already says answered, checked, they did not hear back, blocked; caught, ignored, blocked, fell for it plus the amount. |
