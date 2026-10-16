# Five new scams, for the Content lead

Approved by the Content lead, relayed by the Builder in chat, 2026-10-17.

Drafted 16 Oct 2026. Each note is in `content/notes/` with `"approved": false`, so none of them deals yet. Read each one, then tell the Builder "approve", "change" (with what), or "drop". Approving flips `approved` to `true` in that one file; the next cache run then writes its cards.

The notes describe tactics only. There is no message text in them. Every note is country-neutral: the pack supplies the app, the currency and the hotline.

## Wrong number (`wrong_number.json`)

- What happens: a text meant for "someone else" arrives. You say wrong number. They apologise, stay friendly, chat a bit, then mention an investment app or a crypto plan that went well for them and suggest a small first deposit.
- Tells on the card: building trust first, a made-up identity, an unusual way to pay.
- Safe: ignore, block and report, tell someone. Unsafe: send money, install, open the link.
- The real one: a genuine wrong number says sorry and does not write again.
- Source: the scam catalogue, entry 35 ("wrong-number or accidental-message scam"); ScamShield's investment scams page, updated 2 Jun 2026 (investments recommended by online friends or strangers, small profits first, then no withdrawals). The wrong-number opener itself is **not verified** at a police or regulator page; every official site I tried blocked scripts or had no page for it.

## Toll or parking fine (`toll_fine.json`)

- What happens: a text that looks like the toll operator or a parking office says a small charge is unpaid. It links to a page to pay today before a late fee. The page asks for card details.
- Tells: posing as official, rushing you, asking for a card or code.
- Safe: ignore, block and report, check on the number you know. Unsafe: open the link, pay.
- The page: a "pay the fine" page (new kind `fine_payment`). The real twin's page only says to open the official app.
- The real one: a toll statement that names the operator's own site and says to view and pay it in the official app you already use. (Every page trick's real twin names its own site, so the toll twin carries a plain-text address too.)
- Source: Hong Kong Transport Department press release, 28 Oct 2024, https://www.info.gov.hk/gia/general/202410/28/P2024102800253.htm (fake toll texts link to pages that take card details; the real service sends no payment links; pay in its app or site). Catalogue entry 42 is the nearest row, not an exact one.

## Pre-order deposit (`preorder_deposit.json`)

- What happens: a seller has concert tickets or a sold-out gadget at a fair price, with good reviews. Only a few left. They ask for a deposit now, to a personal account or a checkout link, not the marketplace's own checkout. Delivery is weeks away.
- Tells: building trust first, rushing you, an unusual way to pay, moving you to another app.
- Safe: ignore, block and report, ask for a reference. Unsafe: pay, send money, open the link.
- The page: a deposit checkout (new kind `deposit_checkout`). The real twin's page only shows the meetup or the listing.
- The real one: a seller who meets in a public place so you can see the item, or sells through the marketplace checkout.
- Sources: ScamShield e-commerce scams page, updated 26 May 2026 (paying outside the platform, a limited-time price, links sent by the seller); SPF Mid-Year Scam and Cybercrime Brief 2026 (pre-order deposits lead e-commerce cases); HK Government 2025 law and order release, 11 Feb 2026 (concert-ticket fraud up 61.8%). The last two are already in `docs/scam-realism-2026.md`. Catalogue entry 52.

## SIM swap (`sim_swap.json`)

- What happens: a text that looks like your mobile network says your number is moving to a new SIM within the hour. If it was not you, reply with the code just sent to you to cancel.
- Tells: posing as official, rushing you, asking for a code.
- Safe: ignore, block and report, check on the number you know. Unsafe: share the code.
- No page: the code ask is the whole trick.
- The real one: a telco notice that a SIM change was asked for, with no code and no reply asked, pointing to a store or the official app.
- Source: Scamwatch alert "Watch out for mobile fraud", 7 Apr 2026 (number takeover; codes you did not ask for, account change alerts, the phone dropping to SOS only). It was opened in a browser for `docs/scam-realism-2026.md`; Scamwatch blocks scripts, so it was not re-opened today. Catalogue entry 22. The "reply with the code" step is **not verified** at a primary source.

## The slow add (`slow_add.json`)

- What happens: a new contact adds you after a group chat, a hobby group or a class. They chat normally about the day or the group. Nothing is asked. Later, as if it just came up, they ask a small favour (a little money until payday, a gift card) or share an investment tip.
- The card's opening is ordinary small talk with no tells on it. The tells sit on the later ask. In the chat, the scammer stays friendly on your first reply and turns to the ask from your second.
- Tells: building trust first, a made-up identity, asking for more each time.
- Safe: ignore, block and report, tell someone. Unsafe: send money, pay, open the link.
- The real one: a genuine classmate or neighbour who keeps it ordinary and says hello next time.
- Sources: ScamShield internet love scams page, updated 28 May 2026 (weeks of contact to build trust, then money asks or a fake investment); Scamwatch investment alert, 28 Sep 2026 (added to a friendly hobby group before the pitch), in `docs/scam-realism-2026.md`. Catalogue entry 35 is the nearest row.

## Things to decide with these

- The invented names "Westbay Mobile" (the telco) and "Meridian Market" (the marketplace) are proposals until the trademark glance in `docs/ux-plan.md`.
- No practice-call script exists for these five yet. Once approved, `tts-beats` writes and voices them.
