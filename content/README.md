# Content: packs, fixtures and pattern notes

This folder holds what the app deals from before the Director generates cards.
It never holds a ready-to-send scam message. The repo rule (AGENTS.md, rule 6)
applies to every file here.

## The placeholder rule

A scam message part in a fixture is a bracketed description of the move, not
the message itself:

- `[a courier says a parcel is held until a small fee is paid today]`
- `[a link to a payment page]`
- `[the sender asks you to keep this between you]`

One bracket per part, nothing outside the brackets. The Director later turns
the description into a card; the fixture only has to be playable and scorable.
Real twins are ordinary real text (a real parcel update, a real "which gate?").

No real brand, app, bank, wallet or courier name anywhere, not even in a
comment. Senders are roles from `INSTITUTIONS` in `shared/brands.ts`
("Courier", "Your bank"). Links, when a real twin needs one, use `.example`.

## A fixture card (`content/fixtures/<cc>.json`)

An array of `Card` objects (`shared/types.ts`). Per card:

| Field | Rule |
|---|---|
| `id` | `<cc>-<trick>` in kebab case, unique |
| `trickId` | one of the 16 ids in `TRICKS` (`shared/taxonomy.ts`) |
| `layout` | one of the pack's layouts |
| `difficulty` | 1 easy, 3 subtle |
| `setup` | zero to two placeholder parts, ids `s1`, `s2` |
| `ask` | one or two placeholder parts, ids `a1`, `a2`; every ask part carries at least one tell id |
| `plantedTells` | the union of every part's `tellIds`, in order of first appearance |
| `sender` | `displayName` is the role name, `institutionId` is the key in `INSTITUTIONS`, `maskedNumber` follows the pack's `numberMask` |
| `safeReplies` | the actions that count as handling it (refuse, check on a known number, report) |
| `unsafeReplies` | the actions the scam wants; the ones outside the standard four become extra buttons |
| `usualEnding` | one or two plain sentences: what happens if the player complies |
| `neverAsks` | one sentence: "A courier never asks for ..." |
| `stake` | a number in the pack's currency, no symbol, at most the pack's `walletStart` |
| `realTwin` | a real message of the same kind: `sender`, `parts` (ids `r1`...), `acceptable` actions |
| `language`, `approved` | `"en"` and `true` once the Content lead has read it |

Rules the tests enforce: the twin has exactly as many parts as setup plus ask
(the browser sees the same shape either way); twin parts carry no tells and are
not bracketed; every tell id is one of the nine; every fixture file with cards
has at least six tricks including `family_trouble`.

## A country pack (`content/packs/<cc>.json`)

One `CountryPack`: `layouts` (three, in the order scams arrive), `confidence`
(`high` shows "from police statistics", else "based on usage"), `deckOrder`
(tricks major in that country first), `hotline` with `hotlineVerified: false`
until the Content lead confirms it, `numberMask` (X hides a digit, d keeps
one), `currency`, `walletStart`, `sources`.

## A pattern note (`content/notes/<cc>.json`, from slice 10)

The `PatternNote` shape: one row per advisory, drafted by the scenario-author
agent, approved by a person. `setup` and `ask` describe the move in the same
bracket style as a fixture; `realTwin` describes the real message; `tells` are
tell ids only; `source` is the advisory URL and date. A note is never a
message, and `approved` stays `false` until a person has read it.
