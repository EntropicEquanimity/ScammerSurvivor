# Guard

The Guard is plain code. It never calls a model; it reads a Director draft and returns the rule ids that failed, in a fixed order, so the Director gets one repair turn with `reasonText` lines and the trace drawer gets the ids.

What `guardDraft(draft, { noteTells, allowedNames, allowedReplies })` checks:

- Tells: every note tell is tagged on an ask part, `plantedTells` equals the tells used across setup and ask, every tell id is one of the nine, the ask is not empty.
- Numbers: no run of five or more digits in any text field, both masked numbers match `+<code> <X groups> <last four>`, and the scam sender and real twin differ in the last four.
- Twin and replies: twin parts carry no tells, the twin has an acceptable reply, every reply id is on the allowed list.
- Text: every link, with or without `http://` or `www.`, sits on a host ending in `.example`; no real brand from the short denylist as a whole word; a capitalised word in name position (after hi, hello, dear, this is, regards, a title such as Officer or Mr) must be an allowed first name, a people role, an institution label or a made-up app name from `shared/brands.ts`. Title-case nouns elsewhere are left alone so they never burn the repair turn. Bracketed placeholders are ignored.

Known gaps:

- The policy grep bans the messaging-app and bank names it lists from this folder too, so that list is not duplicated in the denylist and those words pass the Guard. The fix is outside this folder: let `scripts/check-policy.sh` exclude one `server/guard/denylist.ts`, then move `BRAND_DENYLIST` there and merge the grep's list in.
- The repair line for `name_not_allowed` cannot name the offending word: the Director builds the repair message from reason ids only (`reasons.map(reasonText)` in `server/agents/director.ts`). Naming the word needs the Director to read a details field.
