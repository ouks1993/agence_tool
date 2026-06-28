# Strategy Off-Site: Executive Debate Transcript
**Session:** Challenge of the Strategic Audit
**Format:** Structured debate — no artificial consensus
**Date:** 2026-06-28

---

## Opening Statement

**MODERATOR:** The strategic audit made ten major recommendations. We are going to stress-test each one. I want disagreement. I want people to say things that are uncomfortable. Every claim that comes out of this room having survived genuine challenge is worth more than ten claims that survived only polite nodding.

We will debate seven topics where the audit's conclusions are most likely to be wrong. After each topic, I will note what sharpened, what weakened, and what is still unresolved.

The ground rule: if you agree with something, say so in one sentence and move on. We are here for the disagreements.

---

## TOPIC 1: The Accounting Decision

**Audit claim:** Never build an accounting module. Build a QuickBooks/Xero integration instead.

---

**MAYA (Founder/CEO):** The audit is right for the wrong reason. The right reason is not that accounting is too hard. It's that accounting is a solved problem with entrenched players. Building it competes with QuickBooks on their home ground. We would lose. The better argument is that the agencies who need Atlas most are in markets where accounting software choices vary enormously. An Algerian agency is not using QuickBooks. A Moroccan DMC is not using Xero. The integration-first strategy assumes a mature accounting software market, which is false in our most natural early markets.

**JAMES (CPO):** I push back on "never." I've seen this mistake before. A B2B platform that tells every customer "go use X for that" eventually loses to the competitor who took the pain away. The question is not accounting vs integration — it is which accounting problems are unique to travel agencies. A travel agency has three accounting problems that QuickBooks handles poorly: multi-currency commission tracking, supplier net rate reconciliation, and per-booking P&L. Build those three things, not a full general ledger. That is a 6-week project, not a 12-month one.

**PRIYA (CTO):** James is right about scope and wrong about timeline. A proper multi-currency commission reconciliation engine that agencies will trust with their finances, that handles edge cases, that produces correct output under all conditions, is not 6 weeks. It is 4 months minimum. The question the audit should be asking is: do those 4 months produce more customer value than the same 4 months spent on supplier booking? My answer is no.

**RAFAEL (CRO):** The enterprise perspective reframes this entirely. Mid-to-large agencies — the customers with the largest contracts and lowest churn — have dedicated accounting teams who will never use Atlas as their accounting system. They use SAP, Oracle, or established mid-market tools. They want an export that feeds into those systems cleanly. The integration play is correct for enterprise. For small agencies, the question is whether they want accounting at all, or whether they just want their bookkeeper to stop emailing them. Different problem.

**NADIA (CS Director):** I sit with agencies every day. The accounting request I hear constantly is not "we need general ledger functionality." It is "can you automatically create an invoice when I mark a booking as paid?" and "can you export a clean CSV for my accountant?" Both of those take days to build, not months. The audit conflated "accounting module" with "the two accounting tasks agencies actually ask for." We should build the tasks, not the module.

**DAVID (CFO):** The opportunity cost argument is what matters here. If the team has 20 engineer-weeks, does accounting integration generate more lifetime value than supplier booking? No. Does it generate more than the automation engine? No. Does it reduce churn compared to fixing the navigation issues Nadia deals with? Probably not. The audit says never build it. I say: put it on the list for when engineering capacity is genuinely surplus to higher-priority items. That is probably 18 months from now.

**ELENA (VC):** From an investment perspective: accounting features are table stakes that larger players commodify. No one raises a Series B on "we have accounting." The audit recommendation to avoid it now is directionally correct. The caveat is Maya's point about non-US/EU markets. If Atlas wants to be the tool for agencies in MENA, Southeast Asia, or Latin America, the assumption that QuickBooks integration is the answer needs validation before it becomes strategy.

**OMAR (Agency Owner):** I tried three software platforms that told me to "integrate with accounting." I had three different accounting setups in three years because the integrations kept breaking. When the integration breaks at tax time, it is catastrophic. I want Atlas to own the accounting I need, not to have a dependency I cannot control.

**CATHERINE (Enterprise):** Our finance team would never accept Atlas as a financial system. That is not the question. The question is what data format Atlas produces and whether it maps cleanly to our chart of accounts. If Atlas outputs clean, structured financial data in a standard format, our existing accounting infrastructure handles the rest. Build excellent exports, not accounting.

**MARCO (Competitor CEO):** We built an accounting module two years ago. It took 8 months, costs us 2 engineers to maintain, and is the feature our customers mention least on renewal calls. The audit is right. The only thing I would add: the agencies who wanted accounting from us were the agencies who wanted everything from one provider. Those agencies are not your best customers. They are your highest maintenance ones.

**MODERATOR'S NOTE ON TOPIC 1:**
*Sharpened:* The "never build" conclusion survives but for a more nuanced reason. The integration strategy is correct for the Western market assumption but needs validation for MENA/emerging markets. The real deliverable is Nadia and James's consensus: build the two accounting tasks agencies actually ask for (invoice generation on payment, clean accountant export), not a module. This is a 2-week project that removes 80% of the friction.

*Weakened:* The audit underestimated Omar's problem — integration fragility creates support overhead. The integration-only strategy needs a reliability SLA, not just an API key.

---

## TOPIC 2: AI Strategy — The Data Moat Thesis

**Audit claim:** AI features are temporary. The real strategy is building proprietary datasets that inform AI with collective travel agency intelligence.

---

**MAYA (Founder/CEO):** This is the thesis I am most confident in and least able to prove yet. The argument is structurally sound: commodity models plus proprietary data beats commodity models plus no data. But the honest problem is timeline. The data moat requires 1,000 agencies and 3 years. The business needs to survive until then. The audit does not answer the survival question.

**JAMES (CPO):** The data moat story is right but it has to be invisible to the customer. No agency buys "we will be smarter in three years." They buy "this proposal builder is faster than what I used yesterday." The thesis is correct as an internal strategic rationale. As a product strategy, it means: build features that generate proprietary data as a side effect of making customers successful today. The itinerary AI, the conversion prediction, the supplier scoring — these are not interesting because of AI. They are interesting because they accumulate data the product gets smarter from.

**PRIYA (CTO):** I want to challenge the entire AI strategy from first principles. The audit assumes frontier AI models will be commodities in five years. That assumption deserves scrutiny. If AI models remain expensive and proprietary to specific companies, then Atlas's AI strategy is determined by which API partner is chosen. If they become commodities, then the data advantage matters. We are betting the AI thesis on a market prediction. What is our confidence interval?

**RAFAEL (CRO):** The AI conversation in enterprise sales is completely different from the AI conversation in the audit. Enterprise buyers have data governance requirements, AI hallucination liability concerns, and IT security reviews for every AI system. Selling "our AI learns from thousands of agencies" to an enterprise prospect triggers "whose data is training your model, and can we opt out?" immediately. The data moat story is a fundraising story. It is not currently an enterprise sales story.

**NADIA (CS Director):** Our agencies are not asking for smarter AI. They are asking for faster confirmation emails, fewer errors in commission calculations, and better supplier reliability data. The AI features we have shipped are used by approximately 30% of agents and discarded by the rest. The audit's AI strategy is correct as a long-term vision. As a current product priority, there are simpler problems to solve first.

**DAVID (CFO):** The data moat generates value in year 3 to 5. The cost of computing and training on that data is incurred in year 1 and 2. What is the bridge financing assumption? The audit presents a strategy that requires patience and capital without addressing either. My question: can the business reach profitability on current SaaS fees while waiting for the data moat to materialise? If the answer is no, the strategy requires continuous fundraising against an unproven thesis.

**ELENA (VC):** I have funded two companies with this exact thesis. Both failed. Not because the thesis was wrong — it was right. They failed because the data moat took 4 years to materialise and the business ran out of runway at year 2.5. The VCs who funded the next round wanted to see the moat performing, not the potential. The audit's AI strategy is the correct 5-year strategy. It is not a Series A story. At Series A, the story is: we are the best tool for agencies today, and the data we accumulate gives us compounding advantage that accelerates over time. The data moat is a Chapter 4 in the pitch, not Chapter 1.

**OMAR (Agency Owner):** I do not want my client data and my booking data used to train an AI that my competitors also benefit from. Can I opt out? Is my data isolated? This question will be asked by every agency that reads the privacy policy carefully.

**CATHERINE (Enterprise):** Omar's concern is minor compared to what I would ask. We would require: data processing agreements, geographic data residency, the ability to audit what data is used in any AI model, and the ability to request our data be excluded. The data moat strategy as described is not compatible with enterprise procurement requirements without significant legal and technical infrastructure.

**MARCO (Competitor CEO):** The data moat is the right strategy and it terrifies me. If Atlas gets to 500 agencies before I do, I cannot replicate five years of booking intelligence. My counter-strategy: target Atlas's agencies with superior sourcing integrations today, before the data moat becomes real. The audit correctly identifies the moat. It underestimates how aggressively competitors should act to prevent it from forming.

**MODERATOR'S NOTE ON TOPIC 2:**
*Sharpened:* The data moat thesis is structurally correct and genuinely defensible. Omar and Catherine's concerns about data governance are not criticisms of the strategy — they are implementation requirements. Elena's failure cases reveal the real risk: the strategy is right but requires 4+ years and the business must be capitalised to survive that long. The audit failed to connect the data strategy to the financial model.

*Key revision:* Data collected for AI must be explicitly opt-in with clear value exchange ("your data improves recommendations for you"), not a background assumption. The audit treated data collection as automatic; it is actually a product and legal decision.

*Remains unproven:* Whether sufficient data for meaningful benchmarks is achievable at the scale Atlas will realistically reach in 3 years.

---

## TOPIC 3: Supplier Booking as Top Priority

**Audit claim:** Real supplier booking (placing actual orders with Duffel/Hotelbeds) is the single biggest gap and the highest priority.

---

**MAYA (Founder/CEO):** This is the one conclusion in the audit I am certain is correct. An agency that searches in Atlas and then books in a different portal has not adopted Atlas. They are using Atlas as a preview tool. Preview tools have no switching cost.

**JAMES (CPO):** I agree it is critical and I want to add nuance. "Supplier booking" is not one feature. Booking a Duffel flight requires passengers, payment, PNR storage, and post-booking modifications. Booking a Hotelbeds hotel requires rate confirmation, cancellation policy enforcement, and voucher generation. Together, this is probably 3-4 months of engineering. The question is whether to build both simultaneously or sequence them. The data on which agencies use flights vs hotels most would determine sequencing.

**PRIYA (CTO):** The technical reality is that we already designed the right abstraction for this. The provider abstraction layer with `bookFlight` and `bookHotel` interfaces is built. Implementing Duffel order creation against that interface is a known engineering task, not a research project. I estimate 6-8 weeks for Duffel booking, 8-10 weeks for Hotelbeds booking, assuming we do not cut corners on error handling and post-booking modification.

**RAFAEL (CRO):** Every sales conversation I have about Atlas stalls at the same question: "Can you actually book, or just search?" The demo goes well until we get to that moment. It is the single highest-friction point in the buying cycle. Every week this remains unbuilt costs us sales.

**NADIA (CS Director):** I would add one nuance Rafael's sales conversations might miss: some agencies have existing portal relationships with suppliers that include negotiated rates not available through the public API. For those agencies, Atlas booking through Duffel would use public rates, which might be higher than their private rates. We need to understand what percentage of our agencies this affects before shipping.

**DAVID (CFO):** From a financial model perspective: supplier booking changes the nature of the product. Once Atlas places real orders with suppliers, we have a transaction flow going through the system. That creates potential for transaction fee revenue as an additional line item on top of subscription. The audit missed this revenue model implication.

**ELENA (VC):** GDS companies and OBE platforms have built moats on exactly the booking step. Amadeus, Travelport, and Sabre control the booking layer and extract fees from it. If Atlas builds the booking layer and controls it, that is genuinely strategically significant. If Atlas builds it as a pass-through with no fee and no control, it is just a convenience feature. The audit did not specify the business model for the booking layer.

**OMAR (Agency Owner):** Please build this. I have been asking for it since week two of using Atlas. The search is excellent. The fact that I then have to open a browser tab, log into the supplier portal, and manually enter the same data I just entered in Atlas is a productivity failure that happens 15 times a day.

**CATHERINE (Enterprise):** At our scale, we have direct contracts with GDS providers. We would not route bookings through Atlas's supplier connection — we would want Atlas to integrate with our GDS contract. The supplier booking feature is critical for the SMB market. For enterprise, the question is whether Atlas can connect to an agency's existing GDS relationship, not provide a new one.

**MARCO (Competitor CEO):** This is where I would attack Atlas if I wanted to kill it. We are launching real booking in Q3. If Atlas is still search-only when we go to market with full booking, we will acquire their prospect pipeline. I would accelerate this above everything else on the roadmap.

**MODERATOR'S NOTE ON TOPIC 3:**
*Unanimous:* Supplier booking is the top engineering priority. Every participant agrees.

*Sharpened:* Three important complications the audit missed: (1) private net rates not available through public APIs, (2) transaction fee revenue model opportunity David identified, (3) enterprise agencies need GDS integration, not new supplier connections. The sequencing decision (Duffel first) needs validation on which vertical generates more bookings.

*Competitive urgency:* Marco's comment is not hypothetical. Assuming no competitor is building this is dangerous.

---

## TOPIC 4: The Public API Decision

**Audit claim:** Build a public API at Stage 1. The absence of one caps Atlas at the small-agency market.

---

**MAYA (Founder/CEO):** I agree directionally and worry about the timing. A public API before the product is stable is an API that breaks and creates angry developers. Bad API experiences are worse than no API. The principle is right. The Stage 1 timing may be premature.

**JAMES (CPO):** Define Stage 1. If Stage 1 is 10 agencies, no. If Stage 1 is 50 agencies and a stable product, yes. The product team's concern is not the API itself — it is what the API implies. Once external developers depend on your API, you cannot change endpoint shapes without a deprecation process. That forces premature API stability on a product that should still be changing fast.

**PRIYA (CTO):** The technical argument for an early API is strong. Building server actions and a REST/GraphQL API simultaneously costs 20-30% more engineering time but produces an architecture that is inherently more modular, more testable, and more prepared for future integrations. The cost is lowest at the beginning. It increases every month as server actions proliferate. The later we add the API, the more retrofit work exists. I would recommend a private beta API at 30 agencies — stable enough to be useful, small enough audience that breaking changes are manageable.

**RAFAEL (CRO):** I cannot close enterprise deals without an API. Period. "API coming in Q3" has killed three deals in the last month. An enterprise agency needs to connect Atlas to their internal reporting, their client intake forms, their existing CRM for some data, and their finance system. Without API access, Atlas is a standalone tool that creates a data silo. Enterprise IT departments have been burned by data silos before. They reject standalone tools.

**NADIA (CS Director):** From a CS perspective, agencies with API access have dramatically higher retention than agencies using only the UI. I have data on this from my previous company. It is not because the API is better — it is because an agency that has invested in integrating your API has embedded your product in their operations. The switching cost is real. Build the API for retention, not just for features.

**DAVID (CFO):** The API is not free. An API requires documentation, support for API-related tickets, versioning management, and security review. At 20 agencies, the incremental support cost of an API is low. At 2,000 agencies, API support becomes a team. Model the support cost before committing to an early public API.

**ELENA (VC):** A public API is a platform signal. It tells the market: we are confident enough in our product stability and direction to let developers build on top of us. That signal has fundraising value. Atlas should ship a documented API not just for the functionality but for what it communicates about product maturity.

**OMAR (Agency Owner):** I have no idea what an API is and I do not care. I care that my accounting software talks to Atlas. Whether that happens through an API or a pre-built integration is irrelevant to me. Build the integrations I need, by whatever technical means is required.

**CATHERINE (Enterprise):** An API is the entry ticket for enterprise procurement. Without it, we cannot even begin a vendor evaluation. The integration requirement is not negotiable. The format of the integration — REST, GraphQL, webhook-based — is less important than its existence, its documentation, and its SLA guarantees.

**MARCO (Competitor CEO):** We delayed our API for 18 months. It was the biggest mistake we made. When we finally shipped it, we discovered that 40% of the integrations agencies wanted were things we had never considered. The API taught us more about customer needs than any interview or survey. I would build it earlier than feels comfortable.

**MODERATOR'S NOTE ON TOPIC 4:**
*Consensus direction:* Build it earlier than the audit suggested, with Priya's modification: private beta API at 30-50 agencies, not a public API with unknown stability.

*Key tension:* James's concern about premature API stability vs Rafael's deal-blocking concern. Resolution: define a small set of stable endpoints (bookings, proposals, clients) as the initial API surface, explicitly versioned, with everything else as "experimental."

---

## TOPIC 5: Vertical Focus — Who Is the Target Customer?

**Audit claim:** Atlas should pick one agency type (mid-market leisure agencies) and dominate it before expanding.

---

**MAYA (Founder/CEO):** I wrote this recommendation and I am not sure it is right. Vertical focus is correct strategy for an underfunded team. The risk is that leisure agencies, while numerous, have lower average contract values than corporate agencies and higher churn when travel volume drops (they are cyclical). Focusing on leisure to survive may limit the ceiling.

**JAMES (CPO):** The audit's implicit recommendation to focus on leisure is based on the current feature set, not a deliberate market choice. The product happens to serve leisure agencies better because it was built without corporate travel specific requirements. That is not a strategy — it is a default. The question is whether to deliberately serve leisure agencies or to deliberately add the features needed to serve corporate agencies. These are very different roadmaps.

**RAFAEL (CRO):** Corporate travel is the high-ACV segment. A corporate travel management company (TMC) pays 5-10x what a leisure agency pays, has longer contracts, and has structured procurement that creates switching friction. The audit's recommendation to focus on leisure is a revenue ceiling recommendation. I understand the logic but I want the team to be explicit about what they are trading away.

**NADIA (CS Director):** I want to flag a dangerous assumption in the audit. The "mid-market leisure agency" is not a homogeneous customer. A 5-person ski holiday agency in France has completely different operations from a 30-person adventure travel agency in South Africa. Their workflows, supplier relationships, and client expectations are fundamentally different. Saying "mid-market leisure" as if it is one segment is imprecise in a way that will create product confusion.

**DAVID (CFO):** The unit economics by segment: small leisure agencies have high customer acquisition cost relative to ACV, high churn in bad travel years, and limited expansion revenue. Corporate travel agencies have lower churn, more predictable revenue, and expand naturally as the agency grows. The CFO perspective: corporate travel is the better financial profile. The CPO perspective: it requires more features. The CRO perspective: it requires a different sales motion. This is the most important strategic tension in the room.

**ELENA (VC):** Market size matters for fundraising. "We serve all travel agencies globally" has a theoretical TAM of $20 billion. "We serve mid-market leisure agencies in North Africa and Southern Europe" has a TAM of $300 million. Both could be investable businesses, but the latter requires a very different fundraising story. The vertical focus recommendation in the audit is correct for the business but limits the venture narrative. That is a trade-off the founders need to make explicitly.

**OMAR (Agency Owner):** I am a leisure agency in a market that most software ignores. I have had to adapt US-designed tools to my operations for a decade. If Atlas is specifically built for agencies like mine — including my regional specifics, my currency, my regulatory context — I would pay significantly more than I would for a generic tool. The vertical focus is the right strategy. The question is whether the vertical chosen includes me.

**CATHERINE (Enterprise):** I represent a segment the audit wrote off as "requires too many features." I would like to challenge that. Enterprise travel management is not about more features — it is about different features: policy enforcement, duty of care tracking, consolidated billing, approval workflows. These are not more complex than what Atlas already builds. They are differently complex. An enterprise sales motion is slower but the retention is 5x better. Do not write off the segment until you have talked to ten enterprise prospects about what they actually need.

**MARCO (Competitor CEO):** I would attack the vertical focus directly. While Atlas focuses on leisure mid-market, I would own the DMC segment — destination management companies. They have the highest supplier integration requirements, the most complex multi-supplier packages, and the least good software options available. DMCs will tell their leisure agency clients about us. DMCs connect to the most interesting network effects. Atlas's audit did not mention DMCs at all.

**MODERATOR'S NOTE ON TOPIC 5:**
*Sharpened:* The audit was imprecise. "Mid-market leisure agency" is not a segment — it is a description of the current product's default fit. The debate reveals three genuinely different strategic paths: (1) leisure SMB — higher volume, lower ACV, higher churn; (2) corporate TMC — lower volume, higher ACV, different feature requirements; (3) DMC specialist — Marco's attack vector, highest differentiation opportunity.

*Key unresolved question:* Which segment makes Atlas more defensible against well-funded competitors? This requires market validation, not strategy room debate.

*Remains unproven:* Whether Atlas's current product serves any single segment well enough to justify claiming ownership of it.

---

## TOPIC 6: Pricing Model

**Audit claim:** Consider a transaction-based pricing model where Atlas charges per booking managed.

---

**MAYA (Founder/CEO):** I floated this as a "worth considering" alternative. The more I think about it, the more I think it is wrong. Travel agencies are in a volatile business. Transaction-based pricing means Atlas's revenue fluctuates with travel demand. Covid would have destroyed Atlas's revenue if we had been on transaction pricing. Subscription pricing decouples Atlas's stability from the volatility of travel.

**JAMES (CPO):** The product argument for transaction pricing: agencies feel good when they're winning. If Atlas is expensive in a slow month, it feels like a burden. If Atlas is free in a slow month and expensive in a good month, it feels like a business partner. Psychologically, the alignment of incentives matters. But Maya's Covid point is dispositive. Transaction pricing creates unacceptable business risk.

**RAFAEL (CRO):** Subscription pricing, with a tiered model based on agency size or features, is the correct model for a B2B SaaS at this stage. Transaction pricing requires a different financial infrastructure, different investor metrics, and a different conversation with every prospect. The complexity is not worth it. The simplest model that closes deals is the right model at this stage.

**PRIYA (CTO):** From an engineering perspective: transaction pricing requires reliable transaction counting, dispute resolution, and financial-grade accuracy in billing data. That is a significant engineering investment beyond the product itself. Unless transaction pricing creates a material competitive advantage, the engineering cost is not justified.

**NADIA (CS Director):** Agencies are already paying transaction fees everywhere — to GDSes, to bedbanks, to payment processors. Adding another transaction fee from their software creates resentment. They feel nickel-and-dimed. Subscription pricing feels like a business investment; transaction pricing feels like a tax on success.

**DAVID (CFO):** The hybrid model deserves consideration: base subscription that covers core operations, plus an optional transaction fee for specific high-value features like Stripe Connect payment processing (Atlas already earns a platform fee here) or the future data intelligence features. The subscription provides stable revenue. The transaction layer creates upside on high-value actions. This is how Shopify and Stripe structure their pricing.

**ELENA (VC):** Transaction-based revenue is more valuable at exit than subscription revenue in some acquirer categories. Payment processors and GDSes value GMV multiples. SaaS investors value ARR multiples. The choice of pricing model signals which type of investor and acquirer you are targeting. This should be an explicit decision.

**OMAR (Agency Owner):** I want to know my monthly cost before the month starts. Transaction pricing means I cannot budget. In my market, predictable costs are essential. Please do not change to transaction pricing.

**CATHERINE (Enterprise):** Enterprise procurement requires fixed, predictable costs. Transaction pricing fails standard procurement requirements at most large companies. For enterprise, subscription pricing is mandatory.

**MARCO (Competitor CEO):** We tried transaction pricing in year two. It was a disaster. Revenue swung 40% month to month. We could not plan engineering or hiring. We moved back to subscription in year three. Do not make our mistake.

**MODERATOR'S NOTE ON TOPIC 6:**
*Near-unanimous:* Pure transaction pricing is wrong. Subscription remains the foundation. David's hybrid model is the interesting evolution: subscription base plus transaction layer on specific value-added features.

*Survives:* The idea that Atlas should explore charging a platform fee on Stripe Connect transactions (already partially in place) and potentially on future data intelligence features.

---

## TOPIC 7: The Enterprise Strategy — Should Atlas Go Up-Market?

**Audit claim:** Focused on small-to-mid agencies. Enterprise has "too many requirements."

---

**MAYA (Founder/CEO):** The audit undersells the complexity of going up-market. Enterprise deals require procurement processes, security reviews, SLA negotiation, custom data residency, and dedicated support capacity that a small team cannot sustain. The enterprise tax — time spent on enterprise requirements that do not benefit SMB customers — can consume a company's roadmap. I am not saying never. I am saying not yet.

**JAMES (CPO):** The product risk of enterprise is specific: enterprise customers define requirements that reflect their existing processes, not best practices. Building for enterprise early means building for how one large company happens to work, not for how travel agencies should work. That produces a product that is perfect for one enterprise customer and mediocre for everyone else.

**RAFAEL (CRO):** I want to challenge both of you with data. Our pipeline has three corporate travel agencies with 100-500 employees that have expressed interest. Their contract values are 15-25x our average deal. Two of those agencies would close tomorrow if we had SSO, SAML authentication, and a documented API. That is not a 12-month roadmap item — that is a 6-week engineering task. The enterprise revenue ceiling argument assumes enterprises require hundreds of features. The reality is that SSO and API unlock a disproportionate share of enterprise value.

**PRIYA (CTO):** Rafael is right about SSO. SAML/OIDC SSO is not a complex engineering task and it signals enterprise readiness disproportionately. I would add: SOC 2 Type II certification is the other enterprise gate. Not a feature — a process audit. We should start the SOC 2 process now because it takes 12 months and there is no shortcut. Every month we delay is a month that enterprise prospects are blocked.

**NADIA (CS Director):** Enterprise customers have enterprise support requirements. Every enterprise customer we onboard multiplies our support overhead. At our current team size, one enterprise customer with problems can consume the entire CS team. I am not saying do not pursue enterprise. I am saying: enterprise sales should not outpace enterprise support capacity.

**DAVID (CFO):** Three enterprise contracts at 20x average ACV would cover significant additional engineering headcount. The math on one large enterprise customer vs fifty small customers often favors the large customer — lower CAC per dollar, longer retention, more predictable expansion. The risk is concentration — one enterprise customer leaving creates a step-function revenue decline. The right model is: pursue a small number of enterprise customers to fund the infrastructure that then makes the product better for everyone.

**ELENA (VC):** Enterprise is where venture returns come from. Consumer SaaS needs millions of users. B2B SMB SaaS needs thousands. Enterprise SaaS needs dozens of the right customers. The Atlas audit is correct that enterprise requirements are real, but the VC perspective is: the fastest path to Series B valuation is a small number of large contracts that signal enterprise readiness, not a large number of small contracts that signal SMB traction.

**OMAR (Agency Owner):** If Atlas starts building for large enterprises, will they stop building for me? I have seen this happen with software I rely on. They get acquired by an enterprise, the roadmap shifts, and the small agency features I need stop being a priority. I trust Atlas now because they are building for agencies like mine.

**CATHERINE (Enterprise):** I want to correct a misperception in this room. Enterprise travel agencies are not asking for fundamentally different features. They are asking for operational maturity: auditability, role-based access controls, data export, SSO, documented API, and support SLAs. Many of these make the product better for everyone. The narrative that enterprise requirements are poison to a product roadmap is often used to avoid investing in product quality.

**MARCO (Competitor CEO):** While Atlas debates enterprise, we are signing enterprise contracts. We added SSO and API documentation six months ago. That is the entire up-market move. The enterprise premium is real and the requirements are achievable. Atlas is overthinking the enterprise question by imagining requirements they have not heard from actual enterprise prospects.

**MODERATOR'S NOTE ON TOPIC 7:**
*Sharpened:* The "too many requirements" characterisation in the audit is wrong. Rafael, Priya, and Catherine identified the real enterprise gate: SSO, documented API, SOC 2 certification. These are quality investments that benefit all customers, not enterprise-specific features. Start SOC 2 process now. Build SSO within 6 weeks. The up-market debate then becomes a sales motion question, not a product question.

*Omar's concern is the real risk:* Enterprise roadmap capture is a genuine failure mode. Maintain SMB-first product principles while adding enterprise quality layers. These are not mutually exclusive.

---

## MODERATOR'S FINAL ASSESSMENT

### What survived criticism

**1. Supplier booking as top priority.** Every participant agreed. No dissent. The urgency was amplified by Marco's competitive threat.

**2. The data moat thesis as long-term strategy.** Survived Rafael's sales objection and Catherine's legal concerns because both were implementation issues, not strategic challenges. The thesis is sound. Elena's failure cases reveal the real risk: timeline and funding, not strategic direction.

**3. No full accounting module.** Survived but was refined: build two specific tasks (invoice generation, accountant export) rather than a module. Nadia and James' consensus is more actionable than the audit's "never build."

**4. Public API as critical gap.** Survived unanimously. Rafael's deal-blocking evidence and Nadia's retention data are complementary arguments. Priya's modification (private beta at 30-50 agencies, not immediate public launch) is the right refinement.

**5. Subscription pricing as foundation.** Survived. Transaction pricing rejected unanimously.

### What became stronger

**SSO and SOC 2 as near-term investments.** The audit did not mention these. Catherine and Priya revealed them as the enterprise gate with disproportionate return per engineering effort. These should be added to the immediate roadmap.

**DMC segment as potential wedge.** Marco's unprompted observation about DMC agencies was the most interesting competitive insight in the session. The audit did not address DMCs. This requires market validation.

**Transaction layer on specific high-value features.** David's hybrid pricing model is more sophisticated than the audit's binary choice. Stripe Connect platform fees are already in place. Expanding this selectively is worth exploring.

### What should be abandoned from the audit

**"Mid-market leisure agencies" as the stated target segment.** This is a description of current product fit, not a deliberate strategic choice. The debate revealed three real options (leisure SMB, corporate TMC, DMC specialist) that require deliberate evaluation, not default drift.

**The implied assumption that enterprise is too hard.** Catherine corrected this. Enterprise is not harder — it requires SSO, API, and SOC 2, all of which make the product better for everyone. The "enterprise tax" is real but the threshold is much lower than assumed.

### What remains unproven

1. Whether the data moat is achievable at the agency scale Atlas will realistically reach before needing Series B
2. Whether any single vertical segment is underserved enough to provide a true wedge
3. Whether the pricing structure needs evolution (David's hybrid model is worth testing)
4. Whether the DMC segment is the right attack surface (requires market research)
5. Whether private net rates prevent full adoption of supplier booking for a meaningful subset of agencies

### Experiments before major commitments

1. **Talk to 10 DMC agencies before dismissing or pursuing the segment.** 2 weeks, no engineering cost.
2. **Run a private API beta with 5 agencies before building a full public API.** Validates what integrations agencies actually need.
3. **Price test with 3 enterprise prospects.** Ask what SSO + API would be worth. Rafael's pipeline makes this possible today.
4. **Validate net rate concern on supplier booking.** Survey current agencies: what % of their bookings use net rates not available through public APIs? If <20%, proceed with Duffel booking. If >50%, the strategy must change.

---

## THE EXECUTIVE DECISION MEMO

**To:** Atlas founding team and board
**From:** Strategy off-site, June 2026
**Subject:** Two-year operational priorities

This memo represents the conclusions of the strategy debate, incorporating positions from product, revenue, engineering, finance, customers, investors, and competitive perspective. It supersedes individual opinions, including the preceding strategic audit where the two conflict.

---

### Top 10 Priorities

1. **Ship real supplier booking (Duffel flights, then Hotelbeds hotels).** This is the single highest priority above everything else. Every week this remains unbuilt costs sales cycles and leaves agencies stranded between two systems. Start immediately, complete within 4 months.

2. **Start SOC 2 Type II certification process.** Begin now. It takes 12 months with no shortcut. Enterprise revenue is blocked until this exists. The cost is process discipline, not feature engineering.

3. **Ship SSO (SAML/OIDC).** 6-week engineering project that unlocks enterprise deal flow and signals product maturity to all prospects. Build before the next enterprise pipeline conversation.

4. **Build the two accounting tasks agencies actually need:** (a) auto-generate invoice on payment received, (b) clean CSV/structured export for external accounting systems. 2 weeks. Removes the accounting complaint without building a module.

5. **Ship a private API beta.** Stable read/write endpoints for bookings, proposals, and clients. Private access for 5 agencies. Validates integration needs before committing to a public API surface. Begin at 30 agencies.

6. **Define the target vertical explicitly.** Run structured discovery conversations with 10 leisure agencies, 10 corporate TMCs, and 10 DMCs. Determine which segment underserves most acutely and where Atlas's current product advantage is clearest. Commit to a primary segment within 60 days.

7. **Build the automation engine.** Not a future initiative — the operating system claim requires it. Start with 3 trigger-action pairs: booking confirmed → invoice generated → welcome email sent. This is the feature that changes the category of value Atlas provides.

8. **Instrument the product analytics foundation.** The 57 events from the product analytics strategy. PostHog for client-side. `analytics_events` table for server-side. Before the next major feature ship, not after.

9. **Establish the Zapier integration.** One week of engineering, immediate access to every tool any agency already uses. This is the cheapest ecosystem move available and it is not on the roadmap.

10. **Run the competitor response analysis monthly.** Specifically: what is Marco doing? What is he building? Where is he signing customers that Atlas should be closing? Competitive intelligence should be a standing agenda item, not a reaction to losing a deal.

---

### Top 10 Risks

1. **Competitor builds supplier booking before Atlas.** Marco stated this explicitly. The window may be months.
2. **Data moat thesis requires longer runway than current funding supports.** The strategy works on a 4-year timeline. The business may not have 4 years without additional funding.
3. **Product is built for an implicit segment, not a deliberate one.** Default drift into leisure agencies may leave Atlas in the most commodified and most cyclically volatile part of the market.
4. **Private net rate problem may prevent meaningful supplier booking adoption.** Unvalidated assumption. Requires immediate research.
5. **Enterprise roadmap capture.** Adding enterprise features that make the SMB product worse. Mitigated by maintaining explicit SMB-first product principles.
6. **AI features become commodity faster than the data moat forms.** The 18-month window for AI differentiation is optimistic.
7. **Mutable financial records create compliance exposure in regulated markets.** Append-only financial data is not optional at enterprise scale and in EU markets.
8. **Technical debt from synchronous architecture.** PDF generation, email sending, and commission calculation running in request lifecycle will fail under concurrent load.
9. **Founding team builds what they understand, not what the market needs.** The vertical definition gap is the most concrete expression of this risk.
10. **Underinvestment in client portal.** The portal is potentially the highest-differentiation feature and is currently underfunded relative to its strategic importance.

---

### What We Will Not Build (for 24 months)

- Full accounting module (general ledger, chart of accounts)
- Marketing campaigns platform
- Proprietary WhatsApp messaging threading system
- Custom event bus or message queue before volume requires it
- Full A/B testing infrastructure before 500+ agencies
- App marketplace before a stable public API exists
- Supplier marketplace before 500+ agency customers

---

### Biggest Unknowns

1. **What percentage of agencies use private net rates that are not available via public APIs?** This determines the real addressable market for supplier booking.
2. **Which segment — leisure, corporate, DMC — is most underserved and most willing to pay?**
3. **Does the data moat materialise at 500 agencies or does it require 5,000?**
4. **What is the enterprise deal size available if Atlas ships SSO + API + SOC 2?** Rafael's pipeline provides partial signal. Requires 3-5 structured enterprise conversations.
5. **What does a world where AI booking assistants disintermediate both OTAs and agencies look like?** Not in 5 years — in 2. This is the strategic risk nobody in the room addressed adequately.

---

### Required Experiments Before Major Investments

| Question | Experiment | Cost | Timeline |
|---|---|---|---|
| Which vertical? | Structured interviews: 10 leisure + 10 corporate + 10 DMC | 2 weeks, no engineering | Immediate |
| Net rate problem size? | Survey: "What % of your bookings use net rates not on public platforms?" | 1 week | Immediate |
| Enterprise price point? | Sales conversations with 3 enterprise prospects: "What would SSO + API be worth to you?" | 2 weeks | Immediate |
| API integration needs? | Private API beta with 5 agencies | 6 weeks engineering | After product stabilisation |
| Automation engine value? | Build 3 trigger-action pairs, measure agency adoption at 30 days | 4 weeks engineering | Priority queue |

---

### What Success Looks Like in 24 Months

**Product:** Real supplier booking is live for both flights and hotels. Agencies can go from search to confirmed booking without leaving Atlas. The automation engine supports at least 10 configurable trigger-action pairs. The client portal is the best-designed part of the product.

**Market:** A defined primary segment where Atlas has defensible market position. At minimum 150 agencies. At least 3 enterprise contracts. SOC 2 Type II certified.

**Data:** Enough anonymised booking data to surface the first generation of meaningful benchmarks and supplier intelligence to customers. Not the full moat — the first proof that the moat is real.

**Business:** Subscription revenue covers operating costs. A portion of enterprise and transaction layer revenue funds the team to build toward the data moat thesis. Series A has been raised with a clear narrative: we are the best tool for [defined segment] today, and we have data assets accumulating that compound our advantage.

**The measure that matters most:** An agency that has been using Atlas for 12 months should say: *"I could not go back to what I was using before."* Not "this is better." Not "this saves me time." *Cannot go back.* That is what Atlas looks like when it is working.

---

*This memo expires in 90 days. It should be reviewed at the next board meeting with data from the five required experiments. Any priority in the top 10 that has not started within 30 days should be discussed explicitly, not quietly deferred.*

---

## References

- [Strategic Audit](strategic-audit.md) — the document this debate challenged
- [Roadmap](roadmap.md) — priorities updated by this debate's conclusions
- [Product Analytics Architecture](product-analytics-architecture.md) — instrumentation for Priority 8
- [API Integrations](api-integrations.md) — supplier booking architecture (Priority 1)
- [Business Rules](business-rules.md) — automation engine (Priority 7)
