# Compliance rules for Scammer Survivor

Researched 2 and 3 Oct 2026. Every quote below was fetched from the URL beside it unless it carries a label:
- **Search summary**: seen only through a search-engine summary, not the page. Treat as a lead.
- **Not verified**: could not be confirmed from a primary source.
- **Synthesis**: our reading of the rules, not a rule itself.

## Position

The app is a practice simulation for the whole JAPAC region. Players always know they are practising. Every app shown inside it is made up: layout conventions from the real apps, with invented names, original marks and colours that are not the real brand's. Nothing is typed anywhere in the app, so no field can take a credential. Nothing is sent to a real phone or inbox. Real brands are named only in plain lesson text and in the non-affiliation sentence. Scenario content is generated on the server from approved pattern notes drawn from official advisories, reviewed by a person before any player sees it, and translated only from that approved English.

**This is not legal advice.** The trade-dress question and the data-protection rules of each launch market need a lawyer before any app store launch.

## Do

| # | Rule | Why (the rule behind it) |
|---|---|---|
| 1 | Build each layout on the conventions every app of its kind shares, with an invented name, an original mark, and colours that are not the real brand's | Google's trademark rules name "look and feel" and "distinctive color combinations"; Meta and Viber regulate their names and marks; Play Impersonation; App Store 4.1 |
| 2 | Keep only generic patterns: bubbles, timestamps, read words, inbox list, balance card, sticker row, call banner | Trade dress protects a distinctive look, not functional patterns (synthesis) |
| 3 | Show "Practice. Not a real message." in the same viewport as every mock, and "Practice call" on calls | Safe Browsing lists "Insufficiently labeled third-party services"; Play Deceptive Behavior; the Gemini policy bans impersonation "without explicit disclosure" |
| 4 | Show the non-affiliation sentence on every screen: "To make scenarios realistic, we may mention real platforms or services. These references are for illustrative purposes only and do not imply any affiliation, endorsement, or criticism." | The sentence Google's own scam game uses (Be Scam Ready, built by Filament Games); "Practice" disclaims realness, this disclaims affiliation |
| 5 | Name real brands only in plain text inside lessons and the sentence above | Google allows references "in an informational context in plain text"; Apple and Meta ban logo and look-alike use |
| 6 | No typed input anywhere. The one-time code moment is a button. Numbers dot-masked in each country's local format, four digits at most, never dialable (`9••• •741`, 17 Oct 2026); links on realistic endings (`.com`, `.net`, `.top`, `.info`) with invented names, each checked unregistered over RDAP when the card is written and again before each deploy (`scripts/recheck-domains.ts`; a card that fails is never dealt), shown as plain text spans and never clickable, under the About statement "Every website and link in this game is invented. Do not visit them outside the game." (ruled by the Builder on 17 Oct 2026; it replaced `.example` and `.invalid` only) | AFASA's definition of sensitive identifying information; Safe Browsing's social engineering definition |
| 7 | A lesson after every card: the tells, what that institution or person never asks, the usual ending, the country's hotline and reporting link | KnowBe4: show the red flags the person missed |
| 8 | Draw scam patterns from the team's catalogues and each country's official advisories, with the source and date on each note | Keeps content grounded in public advisories, not invented attacks |
| 9 | Keep the API key and all generation on the server. The live voice session runs in the browser on a locked short-lived token. Generate ahead of time, review, cache; never generate while a player waits | Gemini Prohibited Use Policy; Gemini API terms (18+, no bypassing safeguards) |
| 10 | Translate only approved English cards, part by part, with a "translated by AI" note and a one-tap "this reads wrong" button | Keeps the review rule intact in every language |
| 11 | Age screen first. Under 18 plays reviewed cached cards only: no model call, no sign-in, no call | Gemini API terms: "You must be 18 years of age or older to use the APIs." |
| 12 | Say in every store listing that the app is a practice simulation, not affiliated with any brand, and that content is AI-generated and reviewed | Play Impersonation; App Store 2.3.1(a) |
| 13 | Use positive reinforcement in lessons | KnowBe4: the goal "isn't to 'catch' people" |

## Do not

| # | Rule | Why (the rule behind it) |
|---|---|---|
| 1 | Use any real logo, icon, signature colour, proprietary typeface, or near-miss name | WhatsApp lists "ZapZap" as a forbidden takeoff; Google bans imitating "distinctive color combinations, typography, graphic designs, product icons"; Apple bans imitating logos and typefaces |
| 2 | Use WhatsApp green with blue double ticks, Viber purple (#7360F2, #655CAC) or the phone-in-bubble icon, the Google palette, Google Sans, or any Gmail-only control | The viability research, below |
| 3 | Build an iMessage-style skin or use Apple emoji | App Store 5.2.5 names Messages and bans Apple emoji |
| 4 | Put any text field in the app, for any purpose | Nothing typed means nothing collected; AFASA RA 12010 definition of sensitive identifying information |
| 5 | Send simulated scams to real phones, emails or messengers | SIM Registration Act RA 11934 spoofing rule; a consumer game has no employer authorization the way enterprise tools do |
| 6 | Host standalone, indexable pages that look like a brand login, or link out to one; render a fake link as a real anchor | Safe Browsing social engineering definition; embedded deceptive content counts against the host page |
| 7 | Generate exportable fake receipts, transfer confirmations or IDs | Play Deceptive Behavior, "Enabling Dishonest Behavior" (the receipt risk is our inference) |
| 8 | Ask Gemini for the most convincing real-brand phishing, or reword a prompt to get past a refusal | Gemini API terms: you "may not attempt to bypass these protective measures" |
| 9 | Let a player request scam text, or copy, share or export scam text in any form | Gemini Prohibited Use Policy: phishing, frauds, scams |
| 10 | Put WhatsApp, Viber, Gmail or similar names in the app name or store keywords | App Store 2.3.7 and 4.1(c); Meta and Google brand rules |
| 11 | Generate in a language first and review later; translations come only from approved English | Review rule |
| 12 | Shame players | KnowBe4 practice |

## Brand rules by company

### WhatsApp and Meta
Source: https://www.meta.com/brand/resources/whatsapp/whatsapp-brand/ (whatsapp.com/brand returns 404)
- "DON'T use a variation, phonetic equivalent, foreign language equivalent, takeoff, or abbreviation of a WhatsApp trademark (or any portion of it), for any purpose, such as WhatsAp, WatsApp, WutsApp, wazapp, watapp, wutzap, watzapp, ZapZap, etc."
- "DON'T use an image confusingly similar to the WhatsApp telephone logo or any other WhatsApp Brand Resource or other variation of any WhatsApp Brand Resource for any purpose."
- "you may not modify the WhatsApp Brand Resources in any way, including changing the design or combining the WhatsApp Brand Resources with other words or images. You shouldn't modify any colors in our logos."
- "DON'T use the WhatsApp Brand Resources in a way that implies partnership, sponsorship, or endorsement by WhatsApp or any of its affiliates."
- "DON'T combine the WhatsApp name or logos...with any other logo, company name, mark, or generic terms."
- "You may not use any WhatsApp trademarks, or anything similar, in your trademark, domain name, username, or other account name."
- Mentioning WhatsApp in text is allowed if it is clear WhatsApp does not endorse the work.
- Viability finding (3 Oct): a targeted read confirmed no sentence on the page mentions screenshots, UI, interface, look and feel or trade dress. All rules concern Brand Resources (name, logos). Layout-only with no name, logo or telephone-bubble is outside what the page regulates. **Synthesis:** residual exposure is unwritten trade dress on green header plus blue double ticks, so both are avoided.

### Google (Gmail)
Sources: https://about.google/brand-resource-center/guidance/ and the trademark rules at https://partnermarketinghub.withgoogle.com/brands/google/trademarks-and-terms/trademark-guidelines-for-proper-usage/
- No permission needed to "refer to Google or our products in an informational context in plain text".
- "Don't imitate Google's logo or visual identity (distinctive color combinations, graphic designs, product icons, or imagery associated with Google)."
- Trademark rules: "Don't copy or imitate Google's trade dress, including the look and feel of Google web design properties or Google brand packaging, distinctive color combinations, typography, graphic designs, product icons, or imagery associated with Google." Also: don't "adopt marks, logos, slogans, or designs that are confusingly similar to Google Brand Features."
- Educational use covers only "unaltered static screenshots or video captures of Google products" (**search summary**; exact page not verified) and "Don't alter the way the interface looks" (https://about.google/brand-resource-center/products-and-services/search-guidelines/). A recreated mock is not an unaltered screenshot, so that permission does not help.
- Viability finding (3 Oct): Google is the only one of the three whose rules name "look and feel". Layout-only, different colours, no Google Sans, no product icons, an invented name sits outside the enumerated elements, but "look and feel" is broad enough to catch a near-pixel clone. The email layout keeps to conventions shared with every mail client: list, avatar, subject and snippet, an overflow menu with "Report spam".

### Rakuten Viber
Sources: https://www.viber.com/en/brand-center/ and the brand book https://www.viber.com/app/uploads/Brand-book-3.0_2018_web.pdf
- "Use the Viber badge as provided." "Don't alter the badge. Don't use the Viber badge for any purpose other than to promote content available on Viber."
- Core purple HEX #7360F2 (brand centre); VIBER purple HEX #655CAC (brand book). "In every design there must be use of minimum 3 colors, and maximum 4, from which one must be purple."
- Logo don'ts: "Don't make up a logo other than defined", "Don't fill with other colors", "Don't lock up the logo with copy, headlines, or other logos".
- Viability finding (3 Oct): neither document mentions UI, screenshots, interface or third-party apps; https://www.viber.com/en/terms/ has no trade dress sentence. Layout-only is outside anything Viber publishes. Stay off both purples and the phone-in-bubble icon.

### Apple (Messages)
Source: https://www.apple.com/legal/intellectual-property/guidelinesfor3rdparties.html
- "You may not use the Apple Logo or any other Apple-owned graphic symbol, logo, or icon … except pursuant to an express written trademark license from Apple."
- "You may not imitate the distinctive Apple packaging, web site design, logos, or typefaces."
- App Store guideline 5.2.5 (below) names the Messages app. We build no Messages-style look.

### Telegram
- https://core.telegram.org/api/terms: "You must not use the official Telegram logo for your app." and "The title of your app must not include the word 'Telegram'", unless prefixed with "Unofficial".
- https://telegram.org/tour/screenshots: logos may be used for illustrations, "Just make sure people understand you're not representing Telegram officially." The CC0 note there covers the screenshots' copyright only, not the trademark.
- The cloud-chat look avoids Telegram blue and the paper-plane mark.

### Other chat apps modelled (LINE, KakaoTalk, Zalo, Messenger)
- **Not verified:** their brand pages were not read on 3 Oct. The same rule applies: layout conventions only, none of their signature colours or marks (LINE green, Kakao yellow, Zalo blue, Messenger blue and its gradient).

### The general legal picture (plain terms, not legal advice)
- **Trademark and trade dress** protect names, logos and a distinctive overall look (colour plus layout plus icon) when using them could confuse people about who made or endorses something. Google Play's IP policy uses the same test: use "likely to cause confusion as to the source" (https://support.google.com/googleplay/android-developer/answer/9888072).
- **Nominative fair use (US doctrine):** you may name a brand to refer to it truthfully, using only as much of the mark as needed and implying no endorsement. **Not verified** from a primary source.
- **Parody and education (synthesis):** defences, not permissions, judged case by case and weak when the copy is realistic enough to confuse people.
- **Trade-dress outcome for layout-only skins:** **not verified**; needs counsel before any store launch.

## Inspired by versus replica

Synthesis of the rules above.

| Element | Decision | Note |
|---|---|---|
| Name | Change | Invented name per layout, no sound-alikes; a trademark check at the naming step (one earlier candidate turned out to be a real payment gateway) |
| Logo and app icon | Change | Original marks |
| Signature colour | Change | Not the real brand's, and not close to it; the hexes to avoid are listed in `docs/ux-plan.md` |
| Proprietary icons and typefaces | Change | Apple and Google say this explicitly |
| Emoji | Change | Noto or Twemoji, never Apple emoji |
| Bubbles, timestamps, read words, sticker row, call banner, inbox list, balance card | Keep | Generic and functional |
| Frame around the mock | Add | The practice label and the non-affiliation sentence in the same viewport |
| Real brands in content | Write, never draw | Plain text in lessons only; invented institutions from the brand registry for anything shown |

## App store rules

Scope: a Cloud Run web app with no store listing is not subject to Play or App Store review. The rules below apply when the app is wrapped for a store.

### Google Play
- **Impersonation** (https://support.google.com/googleplay/android-developer/answer/9888374): "We don't allow apps that mislead users by impersonating someone else (for example, another developer, company, entity) or another app." "Don't imply that your app is related to or authorized by someone that it isn't. Be careful not to use app icons, descriptions, titles, or **in-app elements** that could mislead users about your app's relationship to someone else or another app." Listed violation: "The app is copying the logo of a business entity to falsely suggest it is an official app of the business."
- **Deceptive Behavior** (https://support.google.com/googleplay/android-developer/answer/9888077): "Don't impersonate other apps, brands, or government entities." Bans apps that generate fake documents under "Enabling Dishonest Behavior". Inference: a screenshot-ready fake receipt could fall under this.
- **Intellectual Property** (https://support.google.com/googleplay/android-developer/answer/9888072): "We don't allow apps that infringe on others' trademarks."
- Precedent: the only verified removal for impersonation (2017 "Update WhatsApp Messenger", https://www.theregister.com/2017/11/03/fake_whatsapp_app/) turned on the developer name and the WhatsApp name and icon, not on layout. **Not verified:** any removal for layout alone.

### Apple App Store Review Guidelines
Source: https://developer.apple.com/app-store/review/guidelines/

| Guideline | Quote | What it means here |
|---|---|---|
| 4.1(a) | "Don't simply copy the latest popular app … or make some minor changes to another app's name or UI and pass it off as your own." | No near-copies of a real chat or wallet app |
| 4.1(b) | "Submitting apps which impersonate other apps or services is considered a violation of the Developer Code of Conduct and may result in removal from the Apple Developer Program." | Impersonation risks the whole developer account |
| 4.1(c) | "You cannot use another developer's icon, brand, or product name in your app's icon or name, without approval from the developer." | No real brand in the app name or icon |
| 5.2.1 | "Don't use protected third-party material such as trademarks, copyrighted works, or patented ideas in your app without permission". | No real marks in mock screens |
| 5.2.5 | "Don't create an app that appears confusingly similar to an existing Apple product, interface (e.g. Finder), app (such as the App Store, iTunes Store, or **Messages**) or advertising theme." Also: "Apps … may not include Apple emoji." | Apple's own products only; no Messages-style look is built |
| 2.3.1(a) | No hidden features and no misleading marketing | The listing describes the simulation honestly |
| 2.3.7 | "don't try to pack any of your metadata with trademarked terms, popular app names". | Inference: a truthful description is fine, brand names stuffed into keywords are not |

## Gemini rules

- **Generative AI Prohibited Use Policy** (https://policies.google.com/terms/generative-ai/use-policy, last modified Dec 17, 2024). It prohibits content facilitating "Spam, phishing, or malware", "Frauds, scams, or other deceptive actions", and "Impersonating an individual (living or dead) without explicit disclosure, in order to deceive".
- **Education exception** (same page): "We may make exceptions to these policies based on educational, documentary, scientific, or artistic considerations, or where harms are outweighed by substantial benefits to the public." Google decides ("may"). **Not verified:** no application process was found.
- **Gemini API Additional Terms** (https://ai.google.dev/gemini-api/terms): "You must be 18 years of age or older to use the APIs." You "may not attempt to bypass these protective measures".
- **Safety settings** (https://ai.google.dev/gemini-api/docs/safety-settings): four adjustable categories (Harassment, Hate speech, Sexually explicit, Dangerous), default **Off** for Gemini 2.5 and 3 models; "built-in protections against core harms … cannot be adjusted." Fraud and phishing are not a named filter category.
- **Google Cloud Acceptable Use Policy** (https://cloud.google.com/terms/aup) prohibits use "for any unlawful, invasive, infringing, defamatory, or fraudulent purpose including ... violating intellectual property rights of others, phishing" and distributing "hoaxes or other items of a destructive or deceptive nature". **Synthesis:** a labelled practice mock with no data capture is outside "phishing"; "infringing" is the trade-dress exposure again.
- Kill test A2 (2 Oct): two completed runs returned correct packs with no refusal; the real-message run did not complete on a free-tier key. Kill test A (voice) is still open.

What the product does about it:

| Product rule | Where it shows up |
|---|---|
| Disclosed simulation in every prompt and on every screen | System prompts; the practice label; the non-affiliation sentence |
| Approved pattern notes only; no typed input | Buttons and taps only. Speech on a practice call is heard, never stored, never scored; the transcript is deleted once the lesson is shown |
| Server-side generation with invented institutions, masked numbers, dead links as plain text | Director prompt with constrained fields plus the code Guard |
| Generate ahead of time, review, cache; a refusal or error serves a cached card or the scripted call | No rephrase-and-retry path exists |
| Under 18 never reaches a model | Cache-only day endpoint for that age group; sign-in and call routes reject it |
| Translations only from approved English, part by part | Translator step reads the cache, never a pattern note |
| Logs record card ids and tell ids, never message text or who played. The public repo holds pattern notes and the tell taxonomy, not ready-to-send scam text; docs, fixtures and wireframes use bracketed placeholders | Repo layout; the policy check |

## Hosting risk: Safe Browsing

Sources: https://developers.google.com/search/docs/monitor-debug/security/social-engineering and https://safebrowsing.google.com/
- "A social engineering attack is when a web user is tricked into doing something dangerous online." Pages qualify when they "Pretend to act, or look and feel, like a trusted entity, like your own device or browser" or "Try to trick you into doing something you'd only do for a trusted entity, like sharing a password, or calling a tech support number, or downloading software."
- "Social engineering can also show up in content that is embedded in otherwise benign websites" and "Embedded social engineering content is a policy violation for the host page." So "it is behind a click" is not a defence.
- Listed examples include fake login pages and "Insufficiently labeled third-party services".

What the app does (**synthesis**): no inputs, no working links (fake links are plain text spans), nothing sent, so the "tricked into doing something" prongs cannot be met; invented names plus the practice label in the same viewport answer the "look and feel" prong. **Not verified:** how Safe Browsing crawls content inside a JavaScript app behind a click; any whitelist for training simulations.

## Laws in launch markets

The app serves the whole region. The Philippine statutes below are examples, read because they were the first to hand; they are not a home-market rule. Before launch in any market, that market's equivalents (fraud, telecom spoofing, data protection, child protection) are listed here with a lawyer's read. Known so far:

| Law | What the source says | What it means for the app |
|---|---|---|
| Philippines AFASA, RA 12010 (https://lawphil.net/statutes/repacts/ra2024/ra_12010_2024.html) | Social engineering scheme: obtaining "sensitive identifying information of another person, through deception or fraud". Sensitive identifying information: "usernames, passwords, bank account details, credit card, and e-wallet information among other electronic credentials" | Nothing typed, so nothing that looks like a credential can be taken in |
| Philippines SIM Registration Act, RA 11934 (https://lawphil.net/statutes/repacts/ra2022/ra_11934_2022.html) | Spoofing a registered SIM: at least 6 years and/or P200,000 | Never send simulated scam SMS from or to real numbers |
| Data-protection laws (Philippines RA 10173, Singapore PDPA, Australia Privacy Act, Japan APPI, India DPDP and others) | **Not verified:** none fetched | Collect as little as possible: device id or Google id and email, actions and scores; days kept 30 days; progress until deleted; no location, audio, contacts or free text |
| Child-protection rules (Philippines NPC Advisory 2024-03, https://privacy.gov.ph/wp-content/uploads/2024/12/FAQs-Advisory-on-Guidelines-on-Child-Oriented-Transparency.pdf, **search summary**) | Age-appropriate privacy notices; no deceptive design affecting children | Under-18 mode stores nothing beyond the device and calls no model |

## If minors use it

- **Gemini API is 18+.** Under-18 players never reach a model: they play reviewed cached cards only, with no sign-in and no call.
- **Apple 1.3 and 5.1.4:** Kids Category apps have no third-party ads or analytics, need a parental gate, and must comply with COPPA and GDPR. Terms like "For Kids" in metadata are reserved for the Kids Category.
- **Google Play Families** (https://support.google.com/googleplay/android-developer/answer/9893335): COPPA compliance, Families self-certified ad SDKs only, a neutral age screen for mixed audiences, no AAID or IMEI for child-only apps.
- The app has no ads, no analytics kit and a neutral age screen. **Synthesis:** a store listing for a mixed audience is possible under these rules; that reading is ours, not a ruling.

## Safe-practice norms and precedents

- **Be Scam Ready** (https://bescamready.withgoogle.com/, built by Filament Games for Google): its disclaimer reads "For Educational Use Only: The names, characters, entities and events in this game are fictional. Any resemblance to actual persons, entities or events is purely coincidental. To make scenarios realistic, we may mention real platforms or services. These references are for illustrative purposes only and do not imply any affiliation, endorsement, or criticism." The strongest third-party-built, Google-published precedent; we adopt its non-affiliation sentence.
- **Jigsaw Phishing Quiz** (https://phishingquiz.withgoogle.com/, read from its Angular bundle): generic Gmail-flavoured chrome with neutral grey headers, no Gmail logo, real third-party logos only inside email bodies as the spoofed brand, fake links as a component that opens a dialog instead of navigating. First-party, so it shows Google's own posture, not third-party rights.
- **KnowBe4** (https://blog.knowbe4.com/phishing-simulation-how-it-works): the goal "isn't to 'catch' people". Show the red flags the person missed; positive reinforcement.
- **GoPhish** (https://docs.getgophish.com/user-guide/): a toolkit "meant to help pentesters and businesses conduct real-world phishing simulations". **Not verified:** official ethics guidance.
- Norm for a consumer game: players always know it is practice, nothing goes to a real phone or inbox, no credentials, a lesson after every card.

## Scenario content sources

| Source | What it gives | Status |
|---|---|---|
| The team's catalogues in `docs/sources/` (October 2026) | 16 common patterns with per-country channels and confidence; 67 variants in ten categories; nine cross-cutting mechanics | Built from Singapore Police Force briefs, Scamwatch Australia, India's I4C advisories and Philippine agency advisories (NBI, PSA, SEC, GSIS, NFA); the figures inside are **not verified** by us until re-read at the source |
| Each country's official advisories, read weekly by the Scout | New patterns, matched to a catalogue entry, with source and date | A person approves every note |

Any number from a search summary or a catalogue must be re-read on the source page before it goes on a slide or into the app.

## Pre-release checklist

Tick every line before each deploy. One "no" blocks the deploy.

| # | Question | Yes / No |
|---|---|---|
| 1 | Does every screen, including the call screen, show the practice label in the same viewport as the mock? | |
| 2 | Does every screen show the non-affiliation sentence? | |
| 3 | Is every layout built on generic conventions with an invented name, an original mark, and none of the real brand's colours, typeface or icons? | |
| 4 | Is every layout name free of sound-alikes of a real brand, with a trademark check recorded? | |
| 5 | Is the app free of any Messages-style look and of Apple emoji? | |
| 6 | Do real brand names appear only as plain text in lessons and the non-affiliation sentence? | |
| 7 | Is the app free of every text field and keyboard? | |
| 8 | Is every link host in generated content invented, RDAP-checked unregistered when written and again before this deploy (`scripts/recheck-domains.ts` ran, held cards counted), rendered as plain text and never clickable, with the About statement in place; and is every number dot-masked with four digits at most? | |
| 9 | Is the app free of anything that sends to a real phone, email or messenger? | |
| 10 | Is it impossible for a player to request scam content, or to copy, share or export scam text or a fake receipt? | |
| 11 | Do the API key and all generation stay on the server, with the live voice session on a locked short-lived token and no key in the client or the repo? | |
| 12 | Does every card a player can see come from the reviewed cache, with a model refusal or error serving a cached card or the scripted call, never a reworded retry? | |
| 13 | Does every card end in a lesson with the tells, what a real institution never asks, the usual ending, and the country hotline? | |
| 14 | Is the age screen first, and does the under-18 path reach no model, no sign-in and no call? | |
| 15 | Are translations produced only from approved English cards, with the "translated by AI" note and the "this reads wrong" button? | |
| 16 | Does the public repo, docs and fixtures included, hold only pattern notes and the tell taxonomy, with no ready-to-send scam text and no call transcripts? | |
| 17 | Are mock screens unreachable outside the game's frame, on a URL that resembles no real brand's domain? | |
| 18 | Is call audio never stored, and is the transcript deleted once the lesson is shown? | |

## Not verified: check before the Cup deadline

- Kill test A: whether the live caller holds the persona in English. Kill test A2's real-message run on the Tier 1 key.
- Any process for getting Gemini's education exception.
- How Safe Browsing crawls content inside a JavaScript app; any whitelist for training simulations.
- The exact page for Google's "unaltered static screenshots" educational rule (search summary only).
- Brand pages for LINE, KakaoTalk, Zalo and Messenger (not read).
- The Singapore figures in the catalogues (S$170 million investment losses in the first half of 2026; 41% of digital-arrest victims aged 65 or older): re-read at the Singapore Police mid-year brief of 26 Aug 2026 before any slide.
- Whether the Cup's "English only" rule covers in-app content (an organizer question); the app opens in English.
- Each invented layout name: no trademark register has been searched yet.
- The Cup terms' IP clause (the hack2skill page rendered empty on 3 Oct).

## Not verified: check with a lawyer before any app store launch

- The trade-dress question for layout-only skins, in each launch market.
- Nominative fair use case law.
- Data-protection law in each launch market (Philippines RA 10173, Singapore PDPA, Australia Privacy Act, Japan APPI, India DPDP, others), and the full NPC Advisory 2024-03 PDF.
- BSP's AFASA booklet with implementing rules (not read).
- Any Google rule on showing AI-generated content to minors.
- A Google Play policy specifically covering phishing-training apps.
- Proofpoint's ethics guidance and official GoPhish ethics guidance.
