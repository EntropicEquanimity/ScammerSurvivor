# Director reliability report

The one public proof that the Director (`server/agents/director.ts`) does what the deck says. `scripts/eval-director.ts` runs N generations through `writeCard` (generate, Guard, one repair turn with the Guard's reasons, Guard again) across every country pack and every approved pattern note, writes nothing to the card cache, and prints and writes `web/public/eval.json`. The About page (`#/about`) renders that file as a table. The file holds numbers and Guard rule ids only, never a card, so it is committed.

## What it measures

| Field | Meaning |
|---|---|
| `n` | generations run |
| `model`, `route` | the Director's model id and the route the run used (`developer` is the API key; `vertex` is the enterprise route on Cloud Run) |
| `passFirstTry` | cards the Guard accepted on the first draft |
| `passAfterRepair` | cards the Guard rejected once, then accepted after the repair turn |
| `rejected` | cards dropped after the repair turn failed too, plus Director errors (a refusal, a 503 on both models, bad JSON). In the app these serve a reviewed cached card (AGENTS.md rules 4 and 5) |
| `fallbacks` | runs where a 503 sent the request to `gemini-3.6-flash` |
| `meanMs`, `p95Ms` | wall time per card through `writeCard`, including the repair turn when one ran |
| `meanTokens` | prompt plus candidate tokens per card, summed across the two Director turns when a repair ran, from the API's usage metadata |
| `failReasons` | how many times each Guard rule fired, counted on Guard events only (first and second check), so one card can count twice for one rule |
| `costEstimateUsd` | tokens times the published Gemini 3.8 Flash prices (see below), or `null` when the price was not verified |

The three pass and reject counts always sum to `n`. The selection is seeded (`--seed`, default 1): packs rotate so all eight carry equal weight, and the note for each slot comes from the seed, so the same seed plans the same run.

## The run in `web/public/eval.json`

Run on 16 Oct 2026 (Manila) from the Builder's machine, `GEMINI_ROUTE=developer`, the Cup project's Tier 1 key, `--n 20`, seed 1, five in flight at once. Every pack got two or three cards; thirteen of the sixteen approved notes were drawn.

| Measure | Result |
|---|---|
| Passed the Guard first try | 20 of 20 |
| Passed after one repair | 0 of 20 |
| Dropped | 0 of 20 |
| Fallback model used | 0 of 20 |
| Mean time per card | 17.2 s |
| 95th percentile | 23.8 s |
| Mean tokens per card | 1313 |
| Guard rules fired | none |
| Estimated cost of the run | USD 0.047 |

Not verified: whether `candidatesTokenCount` includes thinking tokens on this model. `server/gemini.ts` records only `promptTokenCount` and `candidatesTokenCount`; if the API reports thinking tokens in a separate field the output side, and the cost, read low.

## How this squares with the Oct 16 kill test

Kill test A2 on the same key earlier on 16 Oct (`docs/kill-test.md`): the original prompt passed 0 of 4 (`isolation` and `payment_substitution` never tagged on an ask part, US-style numbers, one 22-digit run); with the generate, Guard, one repair, Guard loop, 6 of 6 passed at about 34 s per card including the repair. That finding set the design: the repair loop ships, the Guard is the gate, the reviewed cache is the floor.

This run passed 20 of 20 on the first draft, so no repair ran and the mean time halved. The shipped prompt in `director.ts` differs from the kill-test prompt: it spells out the mask shape, says which words carry each tell and asks for every note tell on an ask part, and the response schema constrains `tellIds` and every reply list to the enums. That the higher first-try rate comes from the prompt and schema alone is not verified; a run with the kill-test prompt through the same script would show it. Either way the loop stays: a first draft that fails still gets its one repair turn, and the Guard still has the last word on every card.

The free-tier key mistake, for the record: every 503 on 2, 3 and 8 Oct and the first attempt on 16 Oct ran on a free-tier key from another project, with a 20-request daily quota. The Cup project's Tier 1 key completed 14 of 14 calls with no 503 in the capacity test and 20 of 20 here. The key lives in the local `.env` and Secret Manager, never in a tracked file.

## Prices used

Gemini 3.8 Flash, Standard tier, USD per 1 million tokens, read at https://ai.google.dev/gemini-api/docs/pricing on 16 Oct 2026: input 0.75, output 3.75 (output includes thinking tokens), both through 31 December 2026; the page lists higher prices from 1 January 2027. These are the Developer API prices. The Vertex AI price for the same model was not fetched and is not verified; the live app runs on Vertex, so its cost may differ.

## How to rerun

From the repository root, with the repository `.env` holding `GEMINI_API_KEY` (never printed, never committed):

```
GEMINI_ROUTE=developer node scripts/eval-director.ts --n 50
```

| Flag | Effect |
|---|---|
| `--n N` | generations (default 50) |
| `--country CC` | one pack only, instead of rotating all eight |
| `--seed N` | the selection seed (default 1) |
| `--dry` | print the plan and exit without a model call |

Leave `GEMINI_ROUTE` unset to run on the enterprise route with `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION` and application default credentials, which is what Cloud Run does. The script prints one line per card (pack, note id, trace outcomes, Guard rule ids, milliseconds) and the JSON, then overwrites `web/public/eval.json`. Nothing it prints or writes contains card text. Commit the new file with the commit message naming the date and `n`.
