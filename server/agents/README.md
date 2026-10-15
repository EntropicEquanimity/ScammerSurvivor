# Agents

One agent per file, prompt inside. Model ids live in `server/gemini.ts` only. Code scores; agents write.

## Director (`director.ts`, live)

Turns one approved pattern note into one card: `writeCard({ note, pack, people, level, allowedNames?, generate? })` gives `{ card, trace }`.
The user turn carries the note as JSON, the pack's currency and apps, the level, and the allowed first names (the player's people, then Mira, Dev, Lena, Tomas).
The draft goes through the Guard (`server/guard/card.ts`); on reasons it gets one repair turn that replays the first message, the model's JSON as a model turn, and "Code review rejected the card for these reasons: ...", then one more Guard. Measured on Oct 16: first try fails, the repair passes, about 34 s a card.
Accepted drafts become a `Card` (uuid, `country` from the pack, `layout` from the note, `stake` a round tenth of the wallet, `neverAsks` from a per-category table, `approved: false`); a second failure or any model error gives `card: null` so the caller serves cache (rule 5). Nothing is thrown and nothing is logged.
`DIRECTOR_SYSTEM` is the prompt, `DIRECTOR_SCHEMA` the structured-output schema (tells and replies as enums, difficulty 1 to 3, every field required).

## Coach (`coach.ts`, live)

Writes the short lesson after code has scored one slot; streams text, never a score.

## Caller (designed)

The live call persona and its tool definitions for `gemini-3.8-live`, with the scripted TTS fallback.

## Scout (designed)

Reads public advisories with Search grounding and drafts pattern notes a person approves.

## Translator (designed)

Translates an approved English card part by part, keeping ids and tells, then runs the Guard.
