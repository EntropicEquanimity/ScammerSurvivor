# Kill test B: Be Scam Ready, played 16 Oct 2026

Played at bescamready.withgoogle.com/intl/en in Chrome on a laptop viewport, through the browser tools. One story (the retiree, May) was played through the morning call, the midday text and up to the evening chat's choice screen. The evening consequence and the end-of-story screen were not seen (see the not verified list). Screenshots stayed outside the repository; nothing from the game is quoted here.

## How a scored moment is reached

Clicks from the landing page to the first scored decision: 13.

1. The play button on the landing page.
2. The story start button on the character screen.
3. Open the balance panel (the game tells you to).
4. Close it; this triggers the incoming call.
5. Answer the call.
6 to 8. Advance three captioned caller lines, one button press each; the caller's audio is muted by default.
9. Press the hand button, which opens a checklist asking the player what is happening.
10 and 11. Tick two options.
12. Submit the checklist. No feedback is shown for it.
13. The first scored decision: hang up or hand over the details, on a timer.

Time: the in-call clock read about a minute and a half when the choice appeared, so roughly two minutes from landing to the first scored decision. Not timed with a stopwatch.

## The table

| Feature | Be Scam Ready (confirmed by play) | Ours (approved plan) | Note |
|---|---|---|---|
| Format | Story game. One character per story with a savings goal, a room scene, a day clock (morning, midday, evening), a dollar balance, and trick cards collected into a wallet with six slots. Each chapter is one item: a scripted lead-in, a checklist of what is going on, then a timed two-option action | A day on your own phone dealt from a country deck; you act on each item, never label it | Theirs makes you label first (checklist) and act second; only the act is scored |
| Channels | In May's story: a phone call (captioned lines, no live voice), a text message from a made-up bank, and a chat message in a generic messaging app. Video call and email not reached in this story | Five chat looks, text messages, email, e-wallet, phone and video call | Their call is a slideshow of lines with an answer button |
| Content | Fixed scripts with invented names for the bank, the shop, the payment app and the messenger. Identical on replay. No mention of generative AI anywhere on the site | Generated from the catalogue and current advisories; a person approves each card; the Guard checks it | |
| Real messages mixed in | Yes, one of three. The midday item is a genuine purchase-verification text from the bank; blocking it is marked as the wrong move and the lesson says so | Every scam has a real twin of the same kind; trusting the real ones is a separate score | Theirs folds the real item into the money balance; there is no trust number |
| A caller that talks back | No. The caller reads fixed lines; the player cannot speak or type, only advance, then choose hang up or comply. No microphone prompt at any point | Turn-based caller built from pregenerated beats, with a confidence meter; live caller only if kill test A passes | |
| Country and apps | No country choice. Dollars. Generic app names. The police and identity-number wording is generic rather than tied to any country | Eight country packs; the apps and the hotline change with the country | |
| Languages | English only. The site lives at /intl/en and no language switch exists on the landing page, the header or the game header | English for the Cup; translation of approved cards cut | Both English only at the Cup; theirs has no visible path to more |
| Score shown | The dollar balance only. A wrong choice costs money and a narrative line explains the loss. No caught or trusted counts. Trick cards unlock at chapter end whether the choice was right or wrong (confirmed: two cards unlocked after a wrong morning choice) | Scams caught, real messages trusted, money, people | |
| Gets harder as you improve | No sign of it. Fixed order, same items on replay, no difficulty setting | Missed tells return subtler | Not verified across all three stories |
| Lesson after each item | Yes. A consequence line in the character's voice, then a card with the tactics used and one rule to remember, then trick cards at chapter end. No side-by-side real version, no hotline | Side by side with the real twin, the usual ending, the country hotline; tap the tells on the message itself | |
| Time to first scored message | 13 clicks, about two minutes | Under 60 seconds | |

Other things noticed during play, with the matching plan item:

- Recovery after a slip. Theirs: the story carries on after a wrong choice; the loss is shown as money and a line of regret, and the next chapter starts. No retry, and the same tell never comes back. Ours: a missed tell returns later in the day in a subtler form, and the lesson shows what was missed.
- Tell someone. Theirs: on the correct morning path the character checks with her daughter, as narrative only; the player never chooses to tell anyone. Ours: telling someone is an action the player can take on an item, and it counts.
- Room mode. Theirs: single player, with a share button in the header and nothing else social. Ours: a room where several phones play the same day and the scores sit side by side.
- Progress is stored in the browser and records whether each chapter's choice was correct, but the game restarts the story from the morning on reload.
- Scene changes are gated on short videos and CSS animations finishing; with reduced motion on, or when the video does not load, the game can sit on a screen with nothing to press.

## Verdict

Pass. Six table rows where ours does something theirs does not: Real messages mixed in (a trust score beside the scam score), A caller that talks back, Country and apps (eight country packs with matching apps and hotline), Gets harder as you improve, Lesson after each item (tap the tells on the message itself), and Time to first scored message (inside a minute against their two). Of these six, country packs, trust score, tap the tells and the turn-based caller are not "Gemini wrote it". The pass rule (three or more rows, at least one not "Gemini wrote it") is met by the table rows alone. Two more differences, a tell-someone action and room mode, are bullets under the table, not rows, and do not count toward the rule.

Recommended three for the deck's solution slide, from the table only: Country and apps, A caller that talks back, Real messages mixed in with a trust score. Two rows we assumed were gaps are not: they do mix in one real message, and they do show a lesson after each item. The pitch should not claim either as unique, and must not claim anything about stories two and three, the phone layout, timer expiry or the story summary; none of those was seen (see the not verified list).

## Not verified

- The evening chapter's outcome and the end-of-story screen. The evening choice screen was reached; stored progress then recorded a choice, but it was not made by a click that was observed and its consequence was not seen, because the tab was taken over by another browser session at that point. What the story summary shows (trip outcome, any rate) is not known.
- What happens when a choice timer runs out. Not observed directly; some recorded outcomes may have been timer defaults rather than clicks. The outcomes that were seen (a wrong choice costs money, blocking the real text is marked wrong, cards unlock either way) stand.
- Stories two and three: not played. Whether they add video call or email, or get harder, is not known.
- Phone layout: the game asks a landscape desktop viewport to rotate; it was played in the desktop layout. Not played on a phone.
- Whether the checklist step is scored silently: it shows no feedback and the stored progress records only the action choice, so it appears unscored, but the code was not read.
- Exact time to the first scored decision: estimated from the in-call clock, not a stopwatch.
- Whether a language switch exists on the resources page: only the landing page and the game were checked.
