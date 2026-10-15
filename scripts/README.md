# Scripts

## pregenerate.ts

Fills the card cache ahead of time (AGENTS.md rule 4): every country pack in
`content/packs/` times every approved pattern note in `content/notes/` goes
through the Director once. The Director generates, the Guard checks, one repair
turn quotes the Guard's reasons, the Guard checks again, then the card is kept
or dropped. Six cards run at a time; expect about 35 seconds per card.

```
node scripts/pregenerate.ts [--country SG] [--limit 4] [--dry]
```

| Flag | Effect |
|---|---|
| `--country CC` | one pack only (ISO alpha-2, any case) |
| `--limit N` | the first N approved notes per pack |
| `--dry` | print the plan (packs, notes, levels) and exit without a model call |

Notes ship with `approved: false` and are skipped (the summary counts them);
a person flips a note to `approved: true` in `content/notes/` before the first
real run, or the plan is 0 cards. Level comes from the note's confidence:
`high` is 2, anything else is 1. People is empty and the
allowed names are a fixed JAPAC-neutral English list inside the script.

### Environment

The script reads `.env` in the repo root if present (plain `KEY=VALUE` lines,
no quotes; a variable already set in the shell wins). The Director routes by
`GEMINI_ROUTE`: `developer` uses `GEMINI_API_KEY`; anything else is the
enterprise route with `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION` and
the default service account credentials.

### What it writes

Cards go through `writeCards` in `server/cache.ts`:

- Firestore collection `cards`, one document per card id, when
  `GOOGLE_CLOUD_PROJECT` is set (the default on Cloud Run and with the repo
  `.env`). Locally this needs application default credentials; without them
  set `CARD_CACHE=file`.
- `output/cache/<CC>.json` otherwise, or when `CARD_CACHE=file`
  (`CARD_CACHE_DIR` overrides the folder). Generated cards never belong in a
  tracked file; keep that folder out of git.

New cards replace cached cards with the same id. Nothing else in the cache is
touched. Every generated card lands with `approved: false`; the app deals only
approved cards, so nothing reaches a player before the review step.

### What it prints

Ids, counts and trace outcomes only, never a card's text:

```
packs 8 (AU HK ID IN JP MY PH SG), notes 6 approved, 2 skipped
plan: 48 cards, 6 at a time
  SG parcel_fee: card director:rejected@gemini-3.8-flash guard:rejected[name_not_allowed] director:repaired@gemini-3.8-flash guard:ok 40464ms
SG: generated 6, rejected 0, repaired 6, mean 34000 ms, backend firestore
wrote 48 cards
```

A note that throws logs the error name and counts as rejected. A non-zero exit
means the run itself failed before writing (a missing key, an unreadable pack).
