# Art assets

Everything under `web/public/art`. Art generated with gpt-image-2.5 at build time; everything the player sees inside the game is written by Gemini and checked by code.

Generated files were made on 16 Oct 2026 with `gpt-image-2.5-flare`, quality high, from a script kept outside the repo. Every prompt ended with the same avoid clause: no text, letters, numbers, logos or watermarks, and none of the colours on the avoid list in `docs/ux-plan.md`. Each output was inspected by eye for text and marks, and the saturated mid-tone blues were sampled: median hue 187 to 201 across the four backgrounds, on the cyan side of the avoid-list blues (hue 199 to 216). `wallpaper-tide.jpg` is the closest at median 201, the same band as the shipped `wallpaper.jpg` at 196. The first dusk wallpaper and thumbnail came back at median 208 to 209 and were regenerated with an explicit teal steer.

Opaque backgrounds are JPEG because the PNG at the same size was 1.1 to 1.8 MB, over the 400 KB cap; the mark keeps PNG for its alpha channel.

| File | Size | Dimensions | Prompt summary |
|---|---|---|---|
| `mark.png` | 19 KB | 1024x1024, RGBA | Scammer Survivor mark: one flat ink shape, a phone silhouette with a diagonal cut through its upper right corner, on transparent. Alpha noise removed and colour flattened to `#1c2027` after generation. Not a shield. |
| `mark-512.png` | 11 KB | 512x512, RGBA | Same mark, resized with Pillow for the PWA icon. Not yet wired into `web/public/manifest.webmanifest` or `web/public/icons`, which other owners hold. |
| `result-card-bg.jpg` | 114 KB | 1024x1536 | Result-card background: deep navy, soft cyan and amber glow in the lower third, grain, upper two thirds empty for white text. |
| `wallpaper-dusk.jpg` | 110 KB | 1024x1536 | Lock-screen variant: navy with crossing cyan and orange silk ribbons, same family as `wallpaper.jpg`. |
| `wallpaper-tide.jpg` | 125 KB | 1024x1536 | Lock-screen variant: midnight blue, one broad cyan wave rising from the bottom left with an orange ember crest, dark upper half. |
| `thumbnail-bg.jpg` | 114 KB | 1536x1024 | YouTube thumbnail background: navy, cyan and orange ribbons sweeping in from the right, left half dark for a title. No text. |
| `wallpaper.jpg` | 96 KB | 780x1170 | Existing lock-screen wallpaper (dark blue, cyan, orange wave), referenced by `web/src/base.css`. Prompt not on record. |
| `wall/a.jpg` | 96 KB | 780x1170 | Existing wallpaper candidate, byte-identical to `wallpaper.jpg`. Prompt not on record. |
| `wall/b.jpg` | 46 KB | 780x1170 | Existing wallpaper candidate, dark teal and amber haze. Prompt not on record. |
| `wall/c.jpg` | 65 KB | 780x1170 | Existing wallpaper candidate, dark green silk. Prompt not on record. |
| `quillo.png` | 31 KB | 192x192 | Existing app icon, glass tile, speech bubble on red-orange. Prompt not on record. |
| `fieldpost.png` | 29 KB | 192x192 | Existing app icon, glass tile, magenta. Prompt not on record. |
| `fold.png` | 24 KB | 192x192 | Existing app icon, glass tile, teal. Prompt not on record. |
| `relay.png` | 30 KB | 192x192 | Existing app icon, glass tile, sienna. Prompt not on record. |
| `sms.png` | 26 KB | 192x192 | Existing icon for Text messages, glass tile, grey. Prompt not on record. |
| `practice.png` | 26 KB | 192x192 | Existing icon for My practice, glass tile, open book on green. Prompt not on record. |
| `privacy.png` | 35 KB | 192x192 | Existing icon for Privacy, glass tile, slate. Prompt not on record. |

## Coverage

Every invented app in `shared/brands.ts` (quillo, fieldpost, fold, relay) already had an icon, so none were generated this round. Institutions in `shared/brands.ts` are sender roles, not apps, and carry no icon.

Generations used: 7 of the 30 budget (5 first passes, 2 palette retries).
