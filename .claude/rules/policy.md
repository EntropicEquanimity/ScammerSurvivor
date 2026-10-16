---
paths:
  - "content/**"
  - "server/agents/**"
  - "server/guard/**"
  - "shared/taxonomy.ts"
  - "shared/brands.ts"
---

# Policy rules for notes, prompts and guard code

These files decide whether the live URL is a practice tool or a scam-writing tool. Source for every rule: `docs/compliance.md` and the spec in `docs/superpowers/specs/`.

- A pattern note describes a card: category (A to J), the catalogue entry it matches, the app it arrives on, the tells in play, safe and unsafe replies, the usual ending, source and date. It is never a finished message someone could send.
- Prompts ask for practice cards with the planted tells attached to message parts as data. They never ask for "the most convincing" anything.
- Prompts state the practice setting plainly. They never use role-play framing, hypotheticals or rewording to get past a refusal.
- Names and institutions are constrained fields from `shared/brands.ts`, never free text. Links in generated text use invented names on realistic endings, RDAP-checked unregistered when written and again before each deploy (`scripts/recheck-domains.ts`), never clickable, under the About statement that every site is invented (17 Oct 2026). Phone numbers on play screens are dot-masked in the pack's local format (`shared/mask.ts` localNumber), four digits at most, never dialable (17 Oct 2026).
- The Guard's brand denylist matches whole words only ("grabbed" contains "Grab" and must pass).
- Hard stops override every persuasion tactic. The caller never asks for a real one-time code, PIN or account detail, refers only to "the practice code on screen", ends the call when the player says they will call the official number, stays inside the exercise if asked for anything else, stops at three minutes.
- Real (non-scam) messages carry zero tells. Every scam card ships with its real twin.
- The nine tell ids in `shared/taxonomy.ts` are the whole taxonomy: trust_building, urgency, isolation, escalation, authority, payment_substitution, credential_theft, platform_migration, synthetic_identity. A note never invents an id.
- The Translator reads only approved English cards from the cache and translates part by part; it never reads a note or generates a card.
- Under-18 requests never reach a model: the day endpoint serves the cache only for that age group, with no sign-in, no call, and nothing written server-side.
