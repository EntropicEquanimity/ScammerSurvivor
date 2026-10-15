# Hotlines: what the official pages say

Read on 2026-10-16. Only police, government anti-scam centre, central bank or national regulator pages count. Pages were read directly (WebFetch, or the page rendered in Chrome where the server blocked plain fetches); no search snippets, no third-party sites. A pack is `hotlineVerified: true` only when the page below states the number the pack shows. Where a page could not be opened, the pack shows no digit string.

## Australia (AU)

| Field | Value |
| --- | --- |
| Official URL | https://www.scamwatch.gov.au/report-a-scam |
| Owner | Scamwatch, run by the Australian Competition and Consumer Commission |
| What it says | Reporting is by online form ("Start the Scamwatch form"). "If you or someone else is in immediate danger, call 000." Cybercrime victims are pointed to a police report. IDCARE is mentioned as a support referral but no IDCARE number appears on the page. |
| Date read | 2026-10-16 (rendered in Chrome; the server returns 403 to plain fetches) |
| Verified | Yes, as an online report with no phone number. The pack keeps `number` empty and `reportUrl` set to the form page. The old IDCARE number 1800 595 160 was removed because no government page read today states it. |

## Hong Kong (HK)

| Field | Value |
| --- | --- |
| Official URL | https://www.adcc.gov.hk/en-hk/home.html |
| Owner | Anti-Deception Coordination Centre, Hong Kong Police Force |
| What it says | Site navigation lists "Anti-Scam Helpline 18222". No separate reporting URL on the page. |
| Date read | 2026-10-16 |
| Verified | Yes. `number` 18222. `reportUrl` now points at the ADCC page; cyberdefender.hk could not be opened (Cloudflare block) so it was not kept. |

## Indonesia (ID)

| Field | Value |
| --- | --- |
| Official URL | https://iasc.ojk.go.id/ |
| Owner | Indonesia Anti-Scam Centre, Otoritas Jasa Keuangan (financial services regulator) |
| What it says | Contact section lists "Call Center OJK: 157" (the regulator's contact centre, not a line branded as IASC). Report button links to /Guest/LaporanV2 ("Report now" and "Report a scam" in Indonesian). |
| Date read | 2026-10-16 |
| Verified | Yes. `number` 157, label reworded to say it is the OJK contact centre. `reportUrl` https://iasc.ojk.go.id/Guest/LaporanV2. |

## India (IN)

| Field | Value |
| --- | --- |
| Official URL | https://www.cybercrime.gov.in/home |
| Owner | National Cyber Crime Reporting Portal, Ministry of Home Affairs, Government of India |
| What it says | "Any victim of financial cyber fraud can dial helpline number 1930". "Register a Complaint" is on the same portal. |
| Date read | 2026-10-16 (rendered in Chrome; the portal is a script-only shell to plain fetches) |
| Verified | Yes. `number` 1930. `reportUrl` https://www.cybercrime.gov.in/. |

## Japan (JP)

| Field | Value |
| --- | --- |
| Official URL | https://www.npa.go.jp/goiken/index.html |
| Owner | National Police Agency |
| What it says | For non-emergency consultations about everyday safety concerns, contact the nearest police station or use the #9110 number (translated from the Japanese on the page). |
| Date read | 2026-10-16 |
| Verified | Yes. `number` #9110. `reportUrl` set to this page; the NPA has no dedicated #9110 page at the paths tried (all 404). |

## Malaysia (MY)

| Field | Value |
| --- | --- |
| Official URL | https://www.malaysia.gov.my/en/topics/nsrc-997-hotline |
| Owner | Official Malaysia Government portal (MyGovernment); the centre is run by Bank Negara Malaysia, the Royal Malaysia Police and partners |
| What it says | "NSRC Hotline: 997", operating "Daily (24 hours)". No separate reporting URL. |
| Date read | 2026-10-16 |
| Verified | Yes. `number` 997. `reportUrl` set to this page because nsrc.gov.my does not resolve in DNS and bnm.gov.my/nsrc redirects to a 404. |

## Philippines (PH)

| Field | Value |
| --- | --- |
| Official URL | https://www.cicc.gov.ph/ (also tried https://acg.pnp.gov.ph/, https://www.pnp.gov.ph/, https://www.dict.gov.ph/) |
| Owner | Cybercrime Investigation and Coordinating Center; PNP Anti-Cybercrime Group |
| What it says | Not readable. Every page returned 403 or sat on a bot-verification challenge, which this process does not bypass. |
| Date read | 2026-10-16 (attempted) |
| Verified | No. `number` cleared, label set to "Report to your national police anti-scam line". The 1326 figure stays out of the pack until an official page is read. |

## Singapore (SG)

| Field | Value |
| --- | --- |
| Official URL | https://www.scamshield.gov.sg/ |
| Owner | ScamShield, Government of Singapore |
| What it says | "Call the 24/7 ScamShield Helpline at 1799 if you are unsure if something is a scam." Report a Scam links to https://go.gov.sg/scamreport. |
| Date read | 2026-10-16 |
| Verified | Yes. `number` 1799. `reportUrl` https://go.gov.sg/scamreport. |

## Follow-ups

- PH: re-read cicc.gov.ph from a normal browser session and, if it states 1326, set the pack and add the source.
- AU: `hotline.number` is empty by design. Any text that prints "on {number}" (for example the coach fallback line in server/agents/coach.ts) should handle an empty number.
