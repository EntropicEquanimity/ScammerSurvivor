# Guard

The Guard is plain code. It never calls a model; it reads a Director draft and returns the rule ids that failed, in a fixed order, so the Director gets one repair turn with `reasonText` lines and the trace drawer gets the ids.

What `guardDraft(draft, { noteTells, allowedNames, allowedReplies })` checks:

- Tells: every note tell is tagged on an ask part, `plantedTells` equals the tells used across setup and ask, every tell id is one of the nine, the ask is not empty.
- Numbers: no run of five or more digits in any text field, both masked numbers match `+<code> <X groups> <last four>`, and the scam sender and real twin differ in the last four.
- Twin and replies: twin parts carry no tells, the twin has an acceptable reply, every reply id is on the allowed list.
- Text: every link, with or without `http://` or `www.`, sits on an invented host, on a realistic ending or a reserved one (`shared/links.ts`); each registrable name is checked unregistered over RDAP when the card is written (`domains.ts`) and again before each deploy (`scripts/recheck-domains.ts`, which holds back a failing card through `readCards`); links are never clickable and the About page says every site is invented (ruled by the Builder on 17 Oct 2026); no real brand from the short denylist as a whole word; a capitalised word in name position (after hi, hello, dear, this is, regards, a title such as Officer or Mr) must be an allowed first name, a people role, an institution label or a made-up app name from `shared/brands.ts`. Title-case nouns elsewhere are left alone so they never burn the repair turn. Bracketed placeholders are ignored.

- Clues (`shared/clues.ts`): the scam's clues against the setup and ask parts, the twin's clues against the twin's own parts, through `cluesReasons` (kind, part, grounding, count, text), plus the brand, link and name rules on each clue's title and detail as `clue_text`. Every clue fault is a clue id. They go into the one repair turn like any reason; if clue ids are all that is left after the repair, `writeCard` drops the clues on both sides and keeps the card. A card is never lost to a clue.

`GUARD_REASONS` is the full rule list in report order; the Judge Lab's table reads it.

Known gaps:

- The policy grep bans the messaging-app and bank names it lists from this folder too, so that list is not duplicated in the denylist and those words pass the Guard. The fix is outside this folder: let `scripts/check-policy.sh` exclude one `server/guard/denylist.ts`, then move `BRAND_DENYLIST` there and merge the grep's list in.
- The repair line for `name_not_allowed` cannot name the offending word: the Director builds the repair message from reason ids only (`reasons.map(reasonText)` in `server/agents/director.ts`). Naming the word needs the Director to read a details field.
