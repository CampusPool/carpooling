# Service costs and launch checklist

Research date: 20 October 2026, Asia/Kolkata. Budget confirmed by user: **INR 3,000–7,000/month**, excluding existing ChatGPT subscriptions. Audience: college community, with Bengaluru-wide commutes. Web delivery is acceptable. This is a proposal, not purchased infrastructure or a release-readiness claim.

The user previously reported an active UPI collection account, but now says the provider is **not decided**. Therefore API-enabled merchant onboarding, marketplace payouts and fees are NOT verified. A working personal/business QR is not evidence of these facilities.

## Recommendation

Start with the existing Laravel/MySQL system and a mobile-friendly web client. Use Google Maps under eligible India pricing after a route-quality and data-use review. Use college email verification, app notifications, and a domestic SMS provider where phone verification is required. Keep payment integration behind provider approval. Avoid another backend migration, dedicated navigation infrastructure, paid AI matching, and multiple map providers in the first deployed slice.

The complete scheduled/recurring + on-demand goal remains. The estimates below cover a small supervised cohort, not population-scale operations or a promise that all features are built.

## Cost basis

- Published USD rates are authoritative list prices; INR examples use **INR 90/USD as a planning assumption**, not a live exchange rate.
- Unless stated otherwise, rates exclude taxes, card foreign-exchange markup and negotiated account terms. Add a 20% planning reserve to overseas infrastructure until checkout tax treatment is known. This reserve is not a tax opinion.
- Free allowances depend on account, SKU, volume and terms. Do not count temporary credits, promotions or unverified student benefits as permanent savings.
- User count does not determine cost on its own. Count map loads, API billable events, SMS attempts, payment volume, storage and traffic.

## Maps: what we need and actual list prices

Maps display, address search, address-to-coordinate lookup and road directions are separately billed products. Google India pricing requires eligible Indian billing and primarily Indian usage.

| Google component | Monthly free allowance | First paid tier, USD per 1,000 events |
| --- | ---: | ---: |
| Dynamic Maps: web map loads | 70,000 | 2.10 |
| Autocomplete Requests | 70,000 | 0.85 |
| Place Details Essentials | 70,000 | 1.50 |
| Geocoding | 70,000 | 1.50 |
| Compute Routes Essentials | 70,000 | 1.50 |
| Compute Routes Pro | 35,000 | 3.00 |
| Compute Routes Enterprise | 7,000 | 4.50 |

Each row has its own allowance, not one combined pool. Feature/field selection determines the actual SKU. Traffic-aware routing triggers Pro; motorcycle routing triggers Enterprise. Matrix requests are billed by origin–destination elements, not just HTTP calls. Sources: [India price sheet](https://developers.google.com/maps/billing-and-pricing/pricing-india), [route billing](https://developers.google.com/maps/documentation/routes/usage-and-billing), [India eligibility](https://mapsplatform.google.com/intl/en_in/pricing/).

### Alternatives

- **Ola Maps:** current public pricing shows 100,000 free events for the listed APIs, then Autocomplete INR 0.056/request, Directions Basic INR 0.099/request and Directions INR 0.199/request in the next tier. Confirm allowance scope in the account. Prepaid credits apply beyond free usage under the September 2026 change. Evaluate Bengaluru addresses and road restrictions before choosing it. [Prices](https://maps.olakrutrim.com/pricing), [billing update](https://maps.olakrutrim.com/pricing/update-2026).
- **Geoapify:** 3,000 credits/day, up to 5 requests/second on Free; commercial use allowed with attribution and limits. Paid entry is USD 59/month for 10,000 credits/day, about INR 5,310 before tax. Tile/API credits differ, so credits are not equivalent to rides. [Prices and terms](https://www.geoapify.com/pricing/).
- **Self-hosted OSM routing:** may become useful for persistent route geometry and bulk calculations, but requires map data, updates, memory and operational work. It is not zero-cost hosting. Do not base production on public demo servers. Public OSM tiles have best-effort availability; public Nominatim prohibits autocomplete. [Tile policy](https://operations.osmfoundation.org/policies/tiles/), [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/).

Recommendation: Google first as a candidate, not a claim of measured superiority. Test 20 representative Bengaluru commutes, campus gates, pickup points and motorcycle restrictions against Ola before final selection. Keep a provider adapter so route calls can change later. Google content has storage/display restrictions: the existing permanent RouteCache must be audited before connecting it. Do not assume returned polylines can be stored forever or mixed with another provider's map. [Google usage guidance](https://developers.google.com/maps/optimize-web-services).

Buying a maps API does NOT provide rider matching or recurring bookings. We still build those rules in our server. First filter candidates by date, time, membership and location using our database; make road-distance calls only for a bounded shortlist. Do not route every user against every other user.

## Other services

| Need | Proposed service | Published price / cost treatment |
| --- | --- | --- |
| Server for API, web client, workers and initial MySQL | DigitalOcean Basic 2 vCPU / 4 GiB | USD 24/month, about INR 2,160. Bangalore region exists; confirm chosen resources there. This is a starting configuration to load-test, not a capacity guarantee. |
| Daily server backup | DigitalOcean basic daily backup | 30% of server price: USD 7.20/month, about INR 648. Also take encrypted SQL dumps off the server and test restore. |
| Optional separate managed MySQL | DigitalOcean MySQL | Published starting plan USD 15.15/month; confirm storage configuration and regional availability. Do not add until the budget and operating needs justify it. Entry single-node is not high availability. |
| Email verification/reset | Resend | Free: 3,000 emails/month and 100/day. Pro: USD 20/month for 50,000, about INR 1,800. Configure a verified sending domain. |
| Push notifications | Firebase Cloud Messaging | No per-message charge for FCM. Delivery/background behavior still needs device testing; do not use as the only urgent safety contact. |
| SMS OTP | MSG91 domestic OTP plan | Published 5,000-SMS tier: INR 0.25/SMS; INR 1,250 + 18% GST = INR 1,475 pack. Confirm sender/template onboarding, registration fees, expiry and applicable plan. |
| Alternative phone authentication | Google Identity Platform | India SMS: USD 0.07 per sent SMS, about INR 6.30 before tax; first ten/day not billed. Much more expensive than the quoted domestic OTP plan. |
| Private uploads and off-server backups | Cloudflare R2 Standard | Free: 10 GB-month, 1 million writes and 10 million reads/month. Beyond: USD 0.015/GB-month, USD 4.50/million writes and USD 0.36/million reads. Egress is free. Review storage location before using for sensitive records. |
| HTTPS certificates | Let's Encrypt | Free. Renewal must be automated. |
| Domain | Registrar to choose | Allow INR 1,000–2,000/year, an estimate rather than a quote; verify renewal as well as first-year price. |
| In-app chat, location updates and matching | Existing app/server | No separate vendor fee in this proposal; consumes server/storage/bandwidth and requires implementation. Continuous background location needs separate device validation. |
| Error logs / health monitoring | Initial server logs, scheduled checks and human alerts | No paid monitoring subscription assumed. Prove external outage alerts before rides; purchase managed monitoring only if needed. |

Sources: [server](https://www.digitalocean.com/pricing/droplets), [Bangalore region](https://docs.digitalocean.com/platform/regional-availability/), [backups](https://docs.digitalocean.com/products/backups/details/pricing/), [managed MySQL](https://www.digitalocean.com/pricing/managed-databases), [Resend](https://resend.com/pricing), [FCM](https://firebase.google.com/pricing), [MSG91](https://msg91.com/in/pricing/otp), [Google phone auth](https://cloud.google.com/identity-platform/pricing), [R2](https://developers.cloudflare.com/r2/pricing/), [TLS](https://letsencrypt.org/).

## Payments: fees remain conditional on selected provider

Razorpay is a benchmark, not a selected provider. Its pricing FAQ lists standard bank-UPI gateway technology fees of 2% plus GST, equivalent to **2.36% of collected value** where 18% GST applies to the fee. Credit-card-on-UPI is separately marked 2.15% plus GST. Ignore temporary promotions for recurring budgets; use the signed merchant rate. [Gateway pricing](https://razorpay.com/pricing/).

At the 2.36% benchmark:

- INR 100 received: INR 2.36 collection cost.
- INR 50,000/month collected: INR 1,180 collection cost.
- INR 1,00,000/month collected: INR 2,360 collection cost.

These exclude driver transfer/split-settlement fees, instant settlement, provider-specific refunds and other optional fees. Collect-first/release-after-completion needs a provider-approved marketplace settlement flow, linked driver accounts and reconciliation. An active QR alone does not establish that capability. Request a written Route/equivalent quote before enabling it. [Razorpay Route](https://razorpay.com/route/).

Cash has no payment-gateway collection fee but needs receipts, disputes, operator review and policy; these are work, not free verified settlement. No money moved as part of this research.

## Worked monthly budget

Assumption: 100 active college members; 1,000 ride bookings/month; average fare INR 80; 70% of bookings paid through the gateway. This is a costing workload, not verified capacity or a demand forecast.

Map budget example: 5,000 web map loads, 20,000 autocomplete requests, 3,000 essential details requests, 5,000 car routes and 2,000 motorcycle routes. All fit the listed India allowances if those exact SKUs apply and no other linked project consumes the allowances. Thus modeled map bill is INR 0, not an unconditional promise.

Email stays below 3,000/month AND 100/day by using push/in-app for ordinary ride events; if delivery needs exceed that, add the paid email plan rather than silently dropping alerts.

| Item | INR/month, planning value |
| --- | ---: |
| USD 24 server | 2,160 |
| USD 7.20 daily backup | 648 |
| Domain allowance, INR 1,200/year amortized | 100 |
| Email, map and R2 within stated free limits | 0 |
| Infrastructure tax/FX reserve, rounded | 600 |
| 1,000 domestic OTPs consumed at INR 0.25 + GST | 295 |
| Gateway volume INR 56,000 at 2.36% | 1,321.60 |
| **Modeled monthly subtotal** | **5,124.60** |

Round to **INR 5,500–6,500/month** as a pilot operating envelope, leaving room for small variance. Driver transfer fees and refunds still need a quote and a separate cash reserve. A separate managed database adds roughly INR 1,400+ before tax/configuration; paid email adds INR 1,800 before tax. Both together take this example beyond INR 7,000. A single-server design has a shared failure point and requires hands-on operation; no high-availability claim.

**Upfront cash differs:** annual domain is paid in full, and a 5,000-SMS pack costs INR 1,475 even if only 1,000 are used initially. With the INR 1,200 domain example, replace INR 100 amortization with INR 1,200, and INR 295 SMS consumption with INR 1,475: modeled first-month cash is INR 7,404.60 before the unquoted payment extras. Spread activation or revise the plan if INR 7,000 is a hard first-month cap. Do not assume credit expiry or refunds without the provider's terms.

Growth traps: 10,000 motorcycle route calculations produce 3,000 paid Enterprise events = USD 13.50, about INR 1,215 before tax. A 100-origin by 100-destination matrix can produce 10,000 billed elements in one request. Continuous route recomputation and SMS on every login can overwhelm this budget.

## Implementation and account checklist

All boxes are intentionally unchecked: this document plans the work, it does not prove completion.

### 1. Before spending

- [ ] Confirm monthly cap INR 7,000 and whether first-month setup is a separate allowance.
- [ ] Select payment provider and obtain written collection, linked-account transfer, refund and settlement terms. Verify the intended driver-release timing is supported.
- [ ] Validate the 100-user workload with named hosts/riders; define operating hours and incident owner.
- [ ] Compare Google and Ola on 20 real commutes, campus gate entrances and car/motorcycle restrictions. Check retained route-data requirements.
- [ ] Confirm required phone-verification plan and registration/onboarding charges; keep college eligibility verification separate.

### 2. Service setup

- [ ] Prepare reproducible Laravel/MySQL production packaging; remove testing-only flags, seed accounts and synthetic route-cache reliance.
- [ ] Configure one India-region server, private DB port, worker/scheduler, HTTPS and secret storage.
- [ ] Configure daily backup plus off-server SQL dumps; restore to a separate database and verify a sample booking.
- [ ] Restrict Maps keys by API and browser origin/server as appropriate; separate testing and production keys. Backend owns routing calls used for trusted fares/matching.
- [ ] Enable budget alerts plus supported API quotas and app-level daily counters. Alerts-only budgets are NOT a hard spending cap. [Google budgets](https://docs.cloud.google.com/billing/docs/how-to/budgets).
- [ ] Configure sending-domain verification, email queue/rate limits and SMS retry/abuse controls.
- [ ] Implement push plus visible in-app notifications and a fallback for denied permission/offline devices.
- [ ] Keep uploaded documents private and time-limit access; define retention and deletion.

### 3. Engineering before actual rides

- [ ] Real account activation, verified college membership and reviewed host/vehicle eligibility.
- [ ] Real routing adapter and trusted quotes; no client-supplied authoritative distance/fare.
- [ ] Database-backed date/time/route matching with bounded road-distance calls.
- [ ] Independently dated recurring occurrences, cancellation exceptions and atomic last-seat acceptance.
- [ ] Complete two-device publish/search/request/accept/cancel/start/board/alight/complete journeys.
- [ ] Payment test environment: signed callbacks, duplicates, delayed success, failure, refund, disputed completion and payout reconciliation.
- [ ] Cash receipt, no-show, cancellation/refund policy and operator audit.
- [ ] Tested support/report/block workflow, external outage alert and restore/rollback procedure.
- [ ] Load-test the actual chosen server and derive admission limits; user count alone is not evidence.
- [ ] On-demand availability/dispatch/timeouts/reassignment remains a separate required delivery phase, funded and sized after a working journey.

### 4. First month controls

- [ ] Start with a supervised small cohort and expand within measured limits.
- [ ] Review daily API usage, payment ledger and failed notifications during launch week.
- [ ] Measure cost per completed ride and compare actual invoices to this model after seven days.
- [ ] Reforecast before reaching 70% of the applicable free allowance or monthly cap.

## What this budget excludes

Student development time, existing subscriptions, insurance/operating/legal review, staffed emergency response, driver incentives, losses/refund working capital, paid call masking, automated document verification, continuous navigation SDKs and app-store accounts. These need separate quotes when required; a zero line here means not procured, not that the capability is delivered. Student cloud credits may reduce invoices if verified, but are not part of the baseline. Buying the services does not finish matching, recurring rides or on-demand software.
