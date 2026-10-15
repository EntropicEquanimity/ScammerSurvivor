---
paths:
  - "web/**"
---

# UI rules

Source: `docs/ux-plan.md` and `docs/compliance.md`.

- Every route renders inside `PhoneShell`. The practice label "Practice. Not a real message." is rendered visually hidden for assistive technology on every screen and as a "Practice" tag on every notification card and app header. The non-affiliation sentence shows once per visit as a dismissible notice and on the Privacy page. The call screen says "Practice call".
- Made-up apps only, from `shared/brands.ts`: the real app's layout conventions with an invented name, an original mark, and none of the real brand's colours, typefaces or icons. The colours to avoid per layout are listed in `docs/ux-plan.md` (WhatsApp green and blue double ticks, Viber purple, Telegram blue, LINE green, Kakao yellow, Zalo blue, Messenger blue, the Google palette and Google Sans). No Messages-style look, no Apple emoji.
- No `<input>` or `<textarea>` anywhere. Nothing is typed. The one-time code moment is a button, and pressing it counts as the wrong move. "This reads wrong" is a button.
- Fake links are rendered as spans styled as links, never as anchors. No copy, share, download or screenshot-friendly receipt for scam text.
- The call screen shows a practice code that is a word, never digits, and a "Read the code" button; the meter moves only when the server says so.
- Translated languages show the "Translated by AI" or "Reviewed" note from the language list, and the "This reads wrong" button on every card and lesson.
- Built for any age: body text at least 18px, contrast at least 4.5 to 1, tap targets at least 48px, no timer that punishes slow reading, captions on calls, labels on every tappable part, reduced motion respected.
- The lesson never shames. It names the tells, says what a real institution or person never asks, shows the usual ending and the country's hotline from the pack.
- Fonts and colours follow the anti-AI aesthetic rules: none of the banned fonts, no purple-to-blue gradients, no card-grid as the default container. The frame follows iPhone layout conventions (decision of 9 Oct 2026): the device's own system font through `-apple-system, system-ui`, never an Apple typeface file; translucent glass surfaces over the generated wallpaper; the tokens in `web/src/base.css` (ink `#1c2027`, paper `#eef0f3`, 22px radius, pill buttons). Layout only: no Apple logo, no Apple emoji, no Messages-style look. Frame chrome (status bar, app labels, times) may go down to 13px; body copy and compliance copy stay at 16px or more, with 18px the default.
- Check every changed screen at 375px wide before calling it done.
