# Pattern notes

One file per trick id, `content/notes/<trickId>.json`, in the `PatternNote` shape from `shared/types.ts`; `id` is the trick id in kebab case, which is how the Director's `trickFor` reads the trick back.
`country` is `*`: the note is country-neutral and the country pack supplies the apps, the currency and the hotline.
`setup` and `ask` are bracketed descriptions of the move with `[institution]` and `[chat app name]` placeholders, never a message someone could send.
`tells` are three or four of the nine ids in `shared/taxonomy.ts`; `safeReplies` and `unsafeReplies` come from `ACTIONS` in `shared/types.ts`.
`catalogueEntry` is the row in `docs/sources/JAPAC_WhatsApp_Viber_Scam_Catalogue_Expanded.pdf`; `source` is that file's name and the date it was matched, since the catalogue cites advisories without links (ponytail: one catalogue source per note; swap in the advisory URL when the Scout verifies it).
`confidence` is `high` for common ranks 1 to 8 and `medium` for the rest.
`approved` is written as `false` and only a person flips it to `true` after reading the note; the Director generates cards from approved notes only.
English only, no em dashes, no real brand names, no country names in `setup` or `ask`, no run of more than four digits.
