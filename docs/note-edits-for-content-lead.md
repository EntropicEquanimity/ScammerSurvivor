# Pattern note edits for the Content lead

Approved by the Content lead, relayed by the Builder in chat, 2026-10-16.

Status: proposed, not yet written into `content/notes/`. The approval reached the builder session through the coordinating agent, and writing the notes was held for a person to confirm. Each edit below is the exact new value of the field, so applying it is a copy.

Rules kept: tactic descriptions only, in the bracket style of `content/README.md`; no message text; no real brand; English only. Every note keeps its `tells`, `safeReplies`, `unsafeReplies`, `app`, `confidence` and `approved: true`, so the Guard checks stay as they are. Research and sources: `docs/scam-realism-2026.md`, sections 1 and 2.

Two changes run through the list:
- Real twins describe what the real sender does, never what it does not ask for. Several old twin lines ended "with no fee", "asks for no payment", "with no money involved". The Director copied that into twins that recite the lesson (realism finding 4).
- Amounts are not in the notes. The Director now gets the stake and the currency per pack (`server/agents/director.ts`), so no note edit is needed for amounts.

---

## The partly realistic notes

### family_trouble
Source: SPF Mid-Year Scam and Cybercrime Brief 2026, social media impersonation (66.6% from a contact's compromised account; repeat transfers after the first). https://www.police.gov.sg/-/media/SPF/Media-Room/Statistics/Mid-Year-Scam-and-Cybercrime-Brief-2026/Mid-Year-Scam-and-Cybercrime-Brief-2026.pdf
- setup: `[a message claims to be a close relative, either from a new number because their phone broke, or from the relative's usual account that someone else has taken over] [the sender is in a spot of trouble and cannot get into their bank app]`
- ask: `[the sender asks for money today for a bill or a loan, to a payee the player has never paid, and asks the player to keep it from the rest of the family for now] [once the first transfer goes through, a second, smaller ask follows]`
- realTwin: `A relative messages from their usual number with everyday news and a small favour, like picking something up on the way home.`
- Why: drops the "cannot take calls" beat that every live card repeated, adds the compromised-account variant and the follow-up ask.

### digital_arrest
Source: ScamShield, government official impersonation, updated 24 Jun 2026 (desk call first, then transfer to an officer; safe account, cash, gold or card handover; scammers know name and ID number). https://www.scamshield.gov.sg/i-want-protection-from-scams/learn-to-recognise-scams/government-officials-impersonation-scams/ ; JP NPA confirmed 2025 figures (fake police fraud, gold bars). https://www.npa.go.jp/bureau/criminal/souni/tokusyusagi/sagi_keihatsu2025.pdf
- setup: `[a service desk at a bank, telco or courier contacts the player about a card charge, a new phone line or a parcel in their name that they do not recognise, and already knows the player's name and ID number] [when the player denies it, the desk transfers them to an officer who says the account is linked to money laundering and a warrant is open]`
- ask: `[the officer tells the player to move their savings to a safe account for checking, or to hand cash, gold or their bank card and PIN to a courier, before tonight, and to tell no one in the family while the case is open]`
- realTwin: `A real notice from [institution] about a court or police matter arrives by letter or through the agency's own app, with a case reference and an office to visit in person.`
- Open item: the note's `app` is `green-chat`, so the twin also arrives on a chat app (finding 9). Changing `app` to `sms` or `email` is the fix; that is a Content lead call, not made here.

### parcel_fee
Source: SPF Mid-Year Brief 2026, phishing (random email sender or overseas number, invalid address, small re-delivery fee, card and bank token approval). URL as above. HK Secretary for Security, first half 2026 (small amounts, many times). https://www.info.gov.hk/gia/general/202607/31/P2026073100870.htm
- setup: `[a text from an unknown email address or an overseas number, not a courier name, says a parcel is held because the delivery address is invalid]`
- ask: `[the message asks the player to open a link today, pay a tiny re-delivery fee, then enter card details and approve the code just sent to them]`
- realTwin: `A real delivery update from [institution] names an order the player placed and gives a delivery time window and a tracking page.`

### bank_check
Source: HK Secretary for Security, first half 2026 (same-day cancellation threat, free rebate needing identity verification). URL as above. Scamwatch fake purchase callback alert, 14 Jul 2026 (receipt, number to call, no link). https://www.scamwatch.gov.au/about-us/news-and-alerts/scam-alert-fake-purchase-callback-scams
- setup: `[a message in the bank's or wallet's name says the account will be cancelled today unless identity details are updated] [another version offers a free rebate that needs identity verification first] [a third version shows a receipt for a charge the player did not make, with a number to call and no link]`
- ask: `[the message asks the player to open a link and log in, or to call the printed number, and then to read back the code just sent to them before the account is cancelled tonight]`
- realTwin: `A real alert from [institution] confirms a purchase the player just made, with the amount and the shop, and points to the official app for details.`

### listing_leaver
Source: SPF Mid-Year Brief 2026, e-commerce (seller-side fake payment screenshots verified). URL as above.
- No field change. The note matches the verified seller-side pattern. The larger buyer-side pattern needs its own trick id (see the end of this file).

### fast_romance
Source: JP NPA confirmed 2025 figures, SNS romance (92.8% start by direct message, dating apps 32.7%, crypto transfers up 177%). URL as above.
- setup: `[a match from a dating app, or a direct message on social media, moves to [chat app name] and turns friendly, then affectionate, over a few weeks of small messages] [the person always has a reason not to meet or video call]`
- ask: `[the person, who still will not meet, offers to show the player the trading app that made them money, or asks for a crypto transfer for a shared plan, a little more than last time]`
- realTwin: `A friend the player already knows messages after a date to say they got home safe and suggests a place for next time.`
- Why: drops the hospital bill and the repeated broken camera (finding 6), adds the romance-to-investment turn.

### video_threat
Source: no primary opened describes 2026 mechanics. Confidence stays medium.
- realTwin only: `A friend sends a clip from a group call everyone was on and asks if it is fine to share it with the group.`

### app_in_chat
Source: PIB, I4C "Boss Scam" alert, 7 Aug 2026 (file named like a statement or regulator notice, short compliance deadline, opened on a computer, spreads to contacts). https://www.pib.gov.in/PressReleasePage.aspx?PRID=2295889
- setup: `[a file named like an account statement or a notice from a regulator arrives in the chat, sometimes from a contact's own account, with a short compliance deadline] [another version sends a security tool or a job app as a file to install]`
- ask: `[the sender, in the name of [institution], asks the player to open the file on a computer or install it before today's deadline, and to grant it screen and message access so it can open]`
- realTwin: `A colleague sends a plain agenda file through the chat for a meeting already in the player's calendar.`

### payment_change
Source: SPF Mid-Year Brief 2026, business email compromise (supplier account change with real letterhead; CEO email moves to chat and asks for gift card codes). URL as above. PIB I4C alert, 7 Aug 2026 (hacked executive account asks finance for urgent transfers). URL as above.
- setup: `[an email from a known supplier, on their usual letterhead with a signature, says their bank details have changed] [another version: the boss's own chat account, or a number saved as the boss, asks for help with something confidential] [a level 3 version adds a short video call that keeps the camera low]`
- ask: `[the supplier asks for the next invoice to go to the updated account, or the boss asks the player to buy gift cards in a shop and send the codes, or to make an urgent transfer, skipping the usual approval and keeping it from colleagues]`
- realTwin: unchanged.
- Note: the deepfake video stays level 3 only; it is not verified at any primary opened.

### prize_fee
Source: HK Secretary for Security, first half 2026 (free rebate needing identity verification on a site). URL as above.
- setup: `[a text says points or a rebate from a service the player uses will expire this week, or that the player won a draw they never entered]`
- ask: `[the message, in the name of [institution], asks the player to verify their identity on a site, then pay a small processing fee and share the code just sent to them before the reward is released]`
- realTwin: `A real reward notice from a loyalty programme the player signed up for appears inside that programme's own app and shows the points balance.`

### loan_threat
Source: Bernama quoting PDRM CCID, 8 Dec 2025 (non-existent loans, 8,029 cases). https://bernama.com/en/news.php?id=2500014 . Mechanic not described at a primary.
- realTwin only: `A real statement from [institution] for a loan the player took out shows the due date and the amount in the official app.`

### overseas_job
Source: catalogue only; no 2025 to 2026 primary opened.
- realTwin only: `A real recruiter from an agency the player applied to confirms an interview at a listed office and gives a licence the player can check.`

### refund_payment
Source: Scamwatch fake purchase callback alert, 14 Jul 2026 (an "overpayment" to send back on the call). URL as above.
- setup: `[a message says a refund or a buyer's payment is waiting and expires soon] [another version: a caller says a refund was sent by mistake and is too large]`
- ask: `[the message asks the player to scan a code or approve a request in the wallet app before it expires to receive the money, or the caller asks the player to send back the overpayment today]`
- realTwin: `A real refund notice from the shop the player bought from appears in the wallet app as money received, with the order it belongs to.`

## The realistic notes that still gain from an edit

### paid_task
Source: SPF Mid-Year Brief 2026, job scams (rating hotels, reviewing apps, boosting posts, advance purchases). URL as above. HK Government, law and order 2025 (click farming as advance payments to boost sales). https://www.info.gov.hk/gia/general/202602/11/P2026021100763.htm
- setup: `[a stranger who found the player through a job ad moves the chat to [chat app name] and offers home-based tasks with no interview: rating hotels, reviewing apps or boosting posts] [a first small commission arrives and a group shares screenshots of earnings]`
- ask: `[after the first commission, the next task is an advance purchase from the player's own money to a personal account, which the sender says comes back with commission, and a group screenshot shows someone who just withdrew]`
- realTwin: `A real hiring team confirms an interview time through [chat app name] after an application the player made themselves, and asks for the player's availability.`

### investment_group
Source: SPF Mid-Year Brief 2026, investment (free-tips ads posing as a university or brokerage, learning-community groups, apps from official stores, withdrawal fees). URL as above. Scamwatch investment alert, 28 Sep 2026 (hobby groups, fake news pages, small early withdrawals). https://www.scamwatch.gov.au/about-us/news-and-alerts/scam-alert-investment-scams-hiding-in-plain-sight
- setup: `[the player joins a group after an ad offering free stock tips in the name of a university or broker, a fake news story, or a friendly hobby group] [a mentor shares tips, members post profit screenshots, and an early small withdrawal goes through]`
- ask: `[the mentor asks the player to install a trading app from the normal app store and deposit a starting amount by bank transfer or crypto, then more to reach the next tier, saying the window closes today and the group should stay private from family]`
- realTwin: `A friend shares a link to a public talk about saving in a group the player joined themselves.`

### code_or_account
- No field change. The earnings-site framing for the linking scan rests on an I4C advisory that was not opened: not verified.

## Major 2026 types with no trick id yet

The deck loads one note per trick id, and all 16 ids already have a note, so these need a new id in `shared/taxonomy.ts` first. That is a taxonomy change, not a note edit, so none was added.

| Proposed trick | What it teaches | Source |
|---|---|---|
| purchase_callback | a receipt for a charge you did not make, no link, a number to call, then remote access or card details "for the refund" | Scamwatch, 14 Jul 2026 (URL above); ACCC, remote access losses AUD 69.9m in 2025, https://www.accc.gov.au/media-release/continued-action-critical-to-combat-fraud-as-annual-scam-losses-exceed-2-billion |
| preorder_deposit | buyer side: a deposit or full payment now for collectibles or concert tickets that never arrive | SPF Mid-Year Brief 2026, e-commerce; HK law and order 2025 (concert tickets up 61.8%) |
| number_takeover | codes you did not ask for, telco change alerts, the phone dropping to SOS only | Scamwatch mobile fraud alert, 7 Apr 2026, https://www.scamwatch.gov.au/about-us/news-and-alerts/scam-alert-watch-out-for-mobile-fraud |
| betting_tips | sports or betting "investment" groups | ACCC, 30 Mar 2026 (losses nearly tripled) |

Covered by the edits above instead of new ids: investment ads and fake news (investment_group), the two-stage authority call (digital_arrest), the supplier account change (payment_change).
