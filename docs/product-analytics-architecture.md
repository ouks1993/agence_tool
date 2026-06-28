# Product Analytics Architecture
**Authors:** CPO + Chief Software Architect
**Date:** 2026-06-28
**Status:** Design specification — not yet implemented
**Horizon:** 10-year architecture; staged implementation

---

## Before the architecture: the four hardest questions

Every analytics system eventually fails at one of these. Answer them first.

**1. Build vs Buy?**
The instinct is to reach for PostHog or Mixpanel immediately. The instinct is wrong — not because those tools are bad, but because Atlas has a structural constraint that off-the-shelf analytics tools are not designed for: **multi-tenancy with per-agency data isolation**.

PostHog and Mixpanel are user-centric. They can filter by `agency_id` as a property, but they were not designed to give each agency their own clean analytics view, to benchmark agencies against each other without exposing individual data, or to compute agency-level health scores as a first-class concept. Atlas will eventually need all three.

The architecture below uses PostHog for what it is genuinely better at (client-side collection, session replay, feature flags), and builds a thin internal analytics layer for what only Atlas can do (per-agency business intelligence, cross-agency benchmarking, health scores).

**2. What data should never leave the customer's database?**
Travel agencies handle PII: client names, passport numbers, nationalities, payment methods. The analytics system must never transmit these to a third-party platform. The rule: analytics events carry IDs, counts, durations, and boolean flags — never names, emails, document numbers, or amounts with client context.

**3. Real-time vs nightly?**
Real-time analytics is expensive and almost never necessary for product decisions. The question is not "can we do this in real time?" but "would a decision be different if we had this data in 15 minutes vs 8 hours?" For 95% of product metrics, the answer is no. Only error monitoring and SLA tracking need near-real-time. Everything else runs nightly.

**4. Is the `activity_log` table the foundation or a parallel system?**
Atlas already has an `activity_log` table that records server-side business events. Building a second event store from scratch would duplicate it. The correct architecture uses `activity_log` as the **server-side event backbone** and adds only what it cannot cover: client-side UI behaviour (navigation clicks, form abandonment, dwell time).

This means the analytics stack is smaller and cheaper than it looks.

---

## Architecture overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Collection Layer                                               │
│                                                                 │
│  Client-side events          Server-side events                │
│  (PostHog JS SDK)            (existing activity_log +           │
│  nav clicks, form abandon,   new analytics_events table)        │
│  rage clicks, dwell time     booking.created, proposal.sent,   │
│                              ai.itinerary.generated             │
└────────────────┬───────────────────────┬────────────────────────┘
                 │                       │
                 ▼                       ▼
┌─────────────────────┐    ┌─────────────────────────────────────┐
│  PostHog Cloud      │    │  Neon Postgres (existing)           │
│  (EU region)        │    │  schema: analytics                  │
│                     │    │                                     │
│  Session replay     │    │  analytics_events   (raw, 12mo)     │
│  Feature flags      │    │  analytics_daily    (aggregated)    │
│  A/B testing        │    │  analytics_health   (health scores) │
│  Basic funnels      │    │  analytics_cohorts  (benchmarks)    │
│  Heatmaps           │    │                                     │
└─────────────────────┘    └─────────────┬───────────────────────┘
                                         │
                           ┌─────────────▼───────────────────────┐
                           │  Nightly computation jobs            │
                           │                                      │
                           │  aggregate_daily_metrics.ts          │
                           │  compute_health_scores.ts            │
                           │  compute_cohort_benchmarks.ts        │
                           └─────────────┬───────────────────────┘
                                         │
                           ┌─────────────▼───────────────────────┐
                           │  Dashboards                          │
                           │                                      │
                           │  Internal: Metabase / custom         │
                           │  Agency-facing: built into Atlas UI  │
                           └─────────────────────────────────────┘
```

**Why this split?**
PostHog handles what it is best at: client-side instrumentation, session replay, and feature flags. These would take months to build and are not Atlas's competitive advantage. The Neon analytics schema handles what only Atlas can do: multi-tenant business intelligence, agency-level health scores, and privacy-safe benchmarking. The split is intentional and permanent.

---

## 1. Event Collection

### The three sources

**Source A: Client-side events (PostHog JS SDK)**
Only UI-behaviour events that cannot be inferred from server actions:
- Navigation clicks (which sidebar item, from which page)
- Form abandonment (which field, completion percentage)
- Dwell time on pages
- Rage clicks
- Navigation back (page viewed < 5 seconds, then back)

These events never contain PII. They contain page names, field names, duration, counts.

**Source B: Server-side business events (Neon analytics schema)**
Every significant business action is already captured in `activity_log`. The analytics layer extends this with a typed `analytics_events` table that adds structure the activity log lacks: duration, success/failure, source, and computed properties.

Server-side events are emitted from server actions after the business operation completes. They are fire-and-forget and must never block the user action.

**Source C: Scheduled job events**
Background jobs (nightly commission generation, subscription reconciliation) emit events to the same `analytics_events` table. These track system reliability, not user behaviour.

### Should Atlas use an event bus?

Challenge: Event buses (Kafka, SQS, Inngest) are infrastructure that must be operated. They add latency, cost, and complexity. The question is whether the problem requires them.

At 10,000 agencies with 500 daily events each, that is 5 million events per day — 60 per second peak. A Postgres insert with async fire-and-forget handles 60 writes per second without difficulty. An event bus is not required at this scale.

The exception: if real-time streaming to external systems (a future webhook marketplace, a data warehouse for enterprise customers) becomes a requirement, an event bus becomes necessary. Design for it but do not build it.

**Decision threshold:** Build an event bus when Atlas needs to stream events to more than two downstream systems, or when event volume exceeds 1,000 per second. Not before.

### Where are the boundaries?

Track: Outcomes (booking created), navigation behaviour (item clicked), friction (form abandoned).
Do not track: Intermediate state (field filled), internal component renders, API response latency (that is infrastructure monitoring), content of user-generated text.

The guiding question: "If I see this event, will I take a product action?" If the answer is "maybe eventually" — do not instrument it.

---

## 2. Event Taxonomy

### Naming convention: `{domain}.{entity}.{action}`

```
nav.sidebar.item_clicked
workflow.booking.status_advanced
sourcing.hotel.search_completed
ai.itinerary.generated
portal.proposal.signed
friction.form.abandoned
adoption.feature.first_used
```

**Why this convention?**

The `{domain}.{entity}.{action}` pattern groups events for querying (`WHERE event LIKE 'workflow.%'`), makes the origin readable in logs, and avoids the flat namespace explosion that happens with snake_case event names at scale.

Challenge: dot notation breaks some SQL string matching patterns and creates verbosity. The alternative is a `domain` column instead of encoding it in the event name. Both work; the column approach is more queryable in Postgres. The naming convention approach is more readable in a third-party tool like PostHog.

**Recommendation:** Use dot notation in PostHog (client-side). Use separate `domain`, `entity`, `action` columns in the Neon analytics schema (server-side). The two sources are queried differently anyway.

### Event categories

| Category | Prefix | Examples |
|---|---|---|
| Navigation | `nav.*` | `nav.sidebar.item_clicked`, `nav.page.viewed` |
| Workflow | `workflow.*` | `workflow.booking.created`, `workflow.proposal.accepted` |
| Sourcing | `sourcing.*` | `sourcing.flight.search_completed`, `sourcing.hotel.added_to_booking` |
| AI | `ai.*` | `ai.itinerary.generated`, `ai.quote.accepted` |
| Portal | `portal.*` | `portal.client.logged_in`, `portal.payment.initiated` |
| Friction | `friction.*` | `friction.form.abandoned`, `friction.page.dead_end` |
| Adoption | `adoption.*` | `adoption.feature.first_used`, `adoption.module.lapsed` |
| Admin | `admin.*` | `admin.member.invited`, `admin.agency.suspended` |

---

## 3. Event Properties

### Universal properties (every event, no exceptions)

```typescript
interface BaseEvent {
  // Tenant and user context
  agency_id: string;         // UUID — tenant scoping for all queries
  user_id: string;           // UUID — anonymised in aggregate exports
  user_role: UserRole;       // agent | manager | finance | admin
  session_id: string;        // groups events within a work session

  // Event identity
  event: string;             // dot-notation name
  domain: string;            // nav | workflow | sourcing | ai | portal | ...
  timestamp: string;         // ISO 8601 UTC

  // Context
  page_path: string;         // current route when event fired
  source: 'client' | 'server' | 'job';
}
```

**Why `user_role` on every event?**
Without role on every event, all downstream analysis requires a join to the users table. At 500 million events (Stage 4), that join is expensive. Denormalize role at write time.

**Why `session_id`?**
Without sessions, navigation path analysis (which pages do users visit in sequence?) requires complex time-window queries. A session ID makes path analysis trivial.

### Domain-specific properties (only where relevant)

```typescript
// Navigation events
interface NavEvent extends BaseEvent {
  nav_item: string;          // 'clients' | 'bookings' | 'sourcing.flights' | ...
  from_page: string;         // previous route
  time_on_previous_page_ms: number;
}

// Workflow events
interface WorkflowEvent extends BaseEvent {
  entity_id: string;         // booking_id, proposal_id, etc.
  entity_type: string;       // 'booking' | 'proposal' | 'client'
  from_status?: string;      // lifecycle transitions
  to_status?: string;
  duration_ms?: number;      // time to complete action
  method?: string;           // 'manual' | 'ai' | 'from_proposal'
  success: boolean;
}

// Sourcing events
interface SourcingEvent extends BaseEvent {
  search_type: 'flight' | 'hotel';
  result_count: number;
  zero_results: boolean;
  added_to_booking: boolean;
  time_to_add_ms?: number;   // time from search to add
}

// Friction events
interface FrictionEvent extends BaseEvent {
  form_name: string;
  completion_percent: number; // 0–100
  last_field?: string;        // field where user stopped
  error_type?: string;
}

// Adoption events
interface AdoptionEvent extends BaseEvent {
  feature_name: string;
  is_first_use: boolean;
  days_since_agency_created: number;  // time-to-discover
}
```

**What to keep off the payload:**
- Client names, emails, booking references → PII
- Monetary amounts with client context → financial PII
- Free-text content (booking notes, proposal summaries) → PII
- IP addresses → GDPR concern

---

## 4. Data Pipeline

```
[Browser]
    │  PostHog JS SDK (client events only)
    │  Non-blocking, batched every 30s or 10 events
    ▼
[PostHog Cloud EU]
    │  Stores: session replays, feature flag evaluations,
    │          client-side events (nav, friction, adoption)
    │  Retention: 12 months
    │  Webhook: forwards enriched events to Neon on a schedule
    ▼
[Neon Postgres — analytics schema]
    │  Tables: analytics_events, analytics_daily,
    │          analytics_health, analytics_cohorts
    │
    ├── [Realtime path] → error_events monitored by alerting
    │
    └── [Nightly batch] at 02:00 UTC
            │
            ├─ aggregate_daily_metrics.ts
            │    Rolls up yesterday's raw events into analytics_daily
            │    per (agency_id, date, metric_name)
            │
            ├─ compute_health_scores.ts
            │    Reads analytics_daily for last 30 days
            │    Writes to analytics_health per agency
            │
            └─ compute_cohort_benchmarks.ts
                 Reads analytics_daily for all agencies
                 Computes percentile distributions
                 Writes to analytics_cohorts (no agency-level data)
```

### Server-side event emission (implementation boundary)

Server actions emit events using a fire-and-forget pattern that never blocks the response:

```typescript
// Pattern — not production code
// In a server action, after the business operation succeeds:
void emitAnalyticsEvent({
  event: 'workflow.booking.created',
  domain: 'workflow',
  agency_id: user.agencyId,
  user_id: user.id,
  user_role: user.role,
  session_id: sessionId,
  entity_id: booking.id,
  entity_type: 'booking',
  method: input.fromProposal ? 'from_proposal' : 'manual',
  success: true,
});
```

The `emitAnalyticsEvent` function inserts into `analytics_events` asynchronously. If it fails, it logs but does not throw. Analytics failures must never affect product functionality.

### What is computed in real time?

Only three things justify real-time computation:
1. **Error rates** — `friction.server_action.error_shown` events are monitored in near-real time for alerting. A spike in errors should page an engineer, not wait until morning.
2. **Stripe webhook outcomes** — payment failures are surfaced immediately.
3. **Agency suspension events** — security-relevant, must not be delayed.

Everything else — navigation patterns, adoption rates, health scores, workflow funnels — runs nightly. The product team does not need hourly data. Weekly data is sufficient for most decisions.

---

## 5. Storage Strategy

### Schema: `analytics` (separate from product schema)

```sql
-- Raw events: partitioned by month for cheap deletion
analytics_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   uuid NOT NULL,
  user_id     text,
  user_role   text NOT NULL,
  session_id  text,
  event       text NOT NULL,        -- dot notation
  domain      text NOT NULL,
  properties  jsonb,                -- domain-specific payload
  source      text NOT NULL,        -- client | server | job
  page_path   text,
  created_at  timestamptz NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

-- Pre-aggregated daily: the primary query target
analytics_daily (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   uuid NOT NULL,
  date        date NOT NULL,
  metric      text NOT NULL,        -- 'bookings_created', 'proposals_sent', etc.
  value       numeric NOT NULL,
  dimensions  jsonb,               -- {'user_role': 'agent', 'method': 'manual'}
  UNIQUE (agency_id, date, metric, dimensions)
);

-- Health scores: one row per agency per week
analytics_health (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid NOT NULL,
  week_start      date NOT NULL,
  agency_score    smallint,         -- 0-100
  workflow_score  smallint,
  adoption_score  smallint,
  nav_score       smallint,
  risk_level      text,             -- 'healthy' | 'at_risk' | 'critical'
  signals         jsonb,
  UNIQUE (agency_id, week_start)
);

-- Cohort benchmarks: NO agency-level data
analytics_cohorts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  computed_at   date NOT NULL,
  metric        text NOT NULL,
  cohort        text NOT NULL,      -- 'small_leisure' | 'medium_corporate'
  p10           numeric,
  p25           numeric,
  p50           numeric,
  p75           numeric,
  p90           numeric,
  sample_size   integer             -- how many agencies in this percentile
);
```

### Retention policy

| Table | Retention | Reason |
|---|---|---|
| `analytics_events` (raw) | 12 months, then archive | Queries older than 12 months are rare; raw events are large |
| `analytics_daily` (aggregates) | Indefinitely | Small rows, permanent business record |
| `analytics_health` | Indefinitely | Historical health score trends are valuable for churn prediction |
| `analytics_cohorts` | 24 months | Benchmark history for trend analysis |
| PostHog session replays | 3 months | Storage-intensive; older replays rarely needed |

### What becomes expensive?

At 10,000 agencies × 500 events/day = 5 million rows/day in `analytics_events`. At 500 bytes per row average (jsonb properties), that is 2.5 GB/day, 900 GB/year. This is expensive in Neon (billed by storage).

**Mitigation:** Monthly partitions allow cheap deletion of `analytics_events` older than 12 months. The aggregated `analytics_daily` table is tiny by comparison — 10,000 agencies × 50 metrics/day × 365 days = 182 million rows at ~100 bytes each = 18 GB/year. Permanently affordable.

**Challenge to this design:** An alternative is to skip raw event storage entirely and only store aggregates. This is cheaper but loses the ability to recompute metrics with new definitions later. Given that Atlas is early-stage and metric definitions will change, raw storage for 12 months is worth the cost.

---

## 6. Multi-tenancy, Privacy, and Benchmarking

### Tenant isolation in analytics

Every query in the analytics layer is scoped by `agency_id`. There is no global view that mixes raw events across agencies. The `analytics_events` table has `agency_id` as a partition key (in the composite index); no query pattern requires cross-tenant raw event access.

The platform admin (`isPlatformAdmin = true`) can aggregate across agencies but only through pre-computed views — never through raw cross-tenant event access.

### GDPR compliance

Analytics events carry `user_id` (a UUID) and `agency_id`, never names or emails. The `properties` jsonb column must never contain PII — this is enforced by code review convention, not at the schema level.

When an agency requests data deletion under GDPR, `analytics_events` rows for their `agency_id` are deleted. `analytics_daily` aggregates derived from their data remain (they are statistical and not personally identifiable). `analytics_cohorts` data derived from their metrics remains (percentile distributions with no per-agency rows).

For PostHog: user IDs sent to PostHog are the same UUIDs used in Atlas, not email addresses. PostHog's EU data residency is mandatory.

### Benchmarking: "You are 28% faster than similar agencies"

This is the most architecturally interesting problem. The solution:

1. **Agency cohorts** are defined by size (bookings/month), market segment (leisure/corporate/DMC), and region. Cohorts are computed from product data, not analytics.

2. The nightly job `compute_cohort_benchmarks.ts` computes percentile distributions **per metric, per cohort**. It writes to `analytics_cohorts` with only percentile values and a sample size — no per-agency values.

3. An agency's dashboard query: compute their own metric value from `analytics_daily`, then join against `analytics_cohorts` to find their percentile rank.

```sql
-- Example: where does this agency rank for workflow velocity?
SELECT
  a.value AS agency_velocity_days,
  c.p50   AS median_velocity_days,
  PERCENT_RANK() WITHIN GROUP (ORDER BY a.value)
    OVER (PARTITION BY c.cohort) AS agency_percentile
FROM analytics_daily a
JOIN analytics_cohorts c
  ON c.metric = 'workflow_velocity_days'
  AND c.cohort = agency_cohort(a.agency_id)
  AND c.computed_at = current_date - 1
WHERE a.agency_id = $1
  AND a.metric = 'workflow_velocity_days'
  AND a.date >= current_date - 30;
```

**No individual agency data is exposed.** The agency sees their value and the distribution. They cannot infer another agency's value from the percentile data.

**When is benchmarking meaningful?** Not before 50 agencies in a cohort. Percentile distributions from 5 agencies are meaningless and potentially misleading. The `sample_size` column gates this — if `sample_size < 50`, the benchmark UI shows "Not enough data yet."

---

## 7. Product Dashboards

### Internal dashboard: CEO

**Audience:** Weekly business review.
**Questions:** Is the business growing? Are customers healthy? Are we at risk?

| Metric | Source | Frequency |
|---|---|---|
| Active agencies (30-day) | analytics_health | Daily |
| Agencies at risk (health score < 40) | analytics_health | Daily |
| New bookings created platform-wide | analytics_daily | Daily |
| Golden Workflow Completion Rate (platform) | analytics_daily | Weekly |
| MoM revenue growth | Stripe data | Monthly |
| Churn signals (health score trending down 3+ weeks) | analytics_health | Weekly |

**What to exclude:** Feature-level data, navigation metrics. These are noise at the CEO level.

---

### Internal dashboard: Product

**Audience:** Weekly product review; inputs to prioritisation.
**Questions:** What are users actually doing? Where is the funnel breaking? Which features work?

| Metric | Source | Frequency |
|---|---|---|
| Golden Workflow Funnel (all steps, conversion %) | analytics_daily | Weekly |
| Navigation heatmap (most → least clicked items) | PostHog / analytics_events | Weekly |
| Feature Adoption Matrix (% adoption by role, by cohort) | analytics_daily | Weekly |
| Form abandonment by form name | analytics_events | Weekly |
| Zero-result search queries | analytics_events | Weekly |
| Workflow velocity (median days to booking) | analytics_daily | Weekly |
| Time-to-first-feature by cohort | analytics_events | Monthly |

---

### Internal dashboard: Customer Success

**Audience:** Daily review; proactive outreach.
**Questions:** Which agencies need help? Who is at risk of churning?

| Metric | Source | Frequency |
|---|---|---|
| Agency health score ranking (sorted ascending) | analytics_health | Daily |
| Agencies with health score declining 2+ weeks | analytics_health | Daily |
| Feature adoption gaps per agency | analytics_daily | Weekly |
| Last active date per agency | analytics_daily | Daily |
| Agencies stuck in a workflow step > 7 days | analytics_daily | Daily |
| New agencies in first 30 days (onboarding watch list) | analytics_health | Daily |

**The CS dashboard triggers outreach, not data curiosity.** Every row visible to CS should have an associated action: call, email, in-product nudge.

---

### Internal dashboard: Sales

**Audience:** Account review and expansion conversations.
**Questions:** Who should we upsell? Which feature gaps are blocking growth?

| Metric | Source | Frequency |
|---|---|---|
| Feature adoption by agency (which modules do they use?) | analytics_daily | Weekly |
| Modules never used (upsell opportunities) | analytics_daily | Monthly |
| Sourcing product distribution (flights only? hotels? both?) | analytics_daily | Monthly |
| Agency size growth (bookings MoM) | analytics_daily | Monthly |

---

### Internal dashboard: Support

**Audience:** Daily operational use.
**Questions:** What is breaking? Where are users getting stuck?

| Metric | Source | Frequency |
|---|---|---|
| Server action error rate (by action, by agency) | analytics_events | Near-realtime |
| Top form abandonment fields (this week) | analytics_events | Daily |
| Dead-end pages (high exit rate, low task completion) | analytics_events | Daily |
| Rage click hotspots | PostHog | Daily |
| Search zero-results (what did users search for?) | analytics_events | Daily |

---

### Agency-facing dashboard: Agency Owner

**What they can see:** Only their own data. No cross-agency raw data. Benchmarks from `analytics_cohorts` (percentile position only).

| Metric | What it means |
|---|---|
| Bookings created this month vs last month | Growth signal |
| Average days from proposal to booking | Sales efficiency |
| Proposal accept rate | Sales effectiveness |
| Your workflow velocity vs similar agencies | Benchmarked efficiency |
| Top performing agents (bookings completed) | Team management |
| Revenue pipeline (opportunities × probability) | Forward-looking |

**Challenge:** Showing this data to agency owners raises privacy questions about their own agents' performance data. An agent should not see colleague performance comparisons. Role-gate accordingly: owner/admin sees agent breakdown; agents see only their own metrics.

---

### Agency-facing dashboard: Travel Agent

| Metric | What it means |
|---|---|
| My open bookings by status | Daily task awareness |
| My proposals awaiting client response | Follow-up queue |
| My booking completion rate (this month) | Personal performance |
| Clients with no activity in 30 days | Re-engagement opportunities |

This is not a reporting view — it is a **personal work surface**. Keep it actionable, not statistical.

---

### Agency-facing dashboard: Finance Manager

| Metric | What it means |
|---|---|
| Outstanding payments by booking | AR management |
| Commission earned vs commission paid | Cash flow |
| Revenue by month (current year) | Business performance |
| Supplier commission summary | Reconciliation |

This overlaps with the existing Finance page in Atlas. The analytics layer feeds it; it does not replace it.

---

## 8. Feature Flags and Experimentation

### Tool: PostHog Feature Flags

PostHog's feature flag system is used over building custom flags. Reasons:
- Targeting by agency, user role, subscription tier, and date are built-in.
- Gradual percentage rollouts require no custom code.
- PostHog links feature flag exposure to analytics events automatically, enabling impact analysis without separate instrumentation.
- The API is available server-side (Next.js server components can check flags).

Building a custom feature flag system is approximately 3 months of engineering for equivalent functionality. It is not Atlas's competitive advantage.

### Flag taxonomy

```
// Naming convention: {scope}.{feature}
// Scopes: agency, role, global

agency.supplier_portal_beta          // specific agencies in beta
role.accounting_module               // only finance role
global.cmd_k_palette                 // gradual percentage rollout
agency.new_booking_form              // A/B test on specific agency cohort
```

### Gradual rollout process

1. **Internal** (0%): Atlas team only via `agency.INTERNAL` flag.
2. **Beta** (specific agencies): Named agencies in the beta program.
3. **Canary** (5%): 5% of agencies, monitored for 2 weeks.
4. **Staged** (25% → 50% → 100%): One step per week if health scores hold.
5. **GA**: Flag removed from code; feature is always-on.

**The rule for rollback:** If a canary or staged rollout causes a health score drop > 10 points for the exposed group vs control group in the same cohort, the rollout is paused. This is the primary rollback signal, not error rate (which is a lagging indicator).

### A/B testing constraints

Atlas is a B2B SaaS serving agencies, not a consumer product serving millions of users. At 100 agencies, an A/B test with 50/50 split has 50 agencies per variant. For most UI changes, this produces insufficient statistical power for reliable results.

**Honest constraint:** Atlas cannot run rigorous A/B tests at current scale. What it can do:
- Before/after cohort comparison (change for all agencies, compare against pre-change baseline in the same cohort).
- Sequential testing (one version for 4 weeks, then new version for 4 weeks, compare).
- Qualitative validation with 5–10 agencies before broader rollout.

Treat PostHog's experimentation as a rollout control mechanism, not a statistical testing platform, until Atlas reaches 500+ agencies per variant.

---

## 9. Health Scores

### Agency Health Score (0–100)

**Purpose:** Early warning for customer success, churn prediction, prioritisation of support attention.

**Inputs and weights:**

| Signal | Weight | Description |
|---|---|---|
| Active users in last 14 days / total team members | 25% | Are people actually using it? |
| Golden Workflow Completion Rate (last 30 days) | 25% | Is the core workflow working? |
| Feature breadth score (distinct modules used) | 20% | Are they adopting the product broadly? |
| Bookings created (trend: up/flat/down vs prior period) | 15% | Business volume signal |
| Error rate experienced (errors per session) | 10% | Product reliability for this agency |
| Days since any booking created | 5% | Recency signal |

**Thresholds:**

| Score | Status | Action |
|---|---|---|
| 70–100 | Healthy | Monitor monthly |
| 40–69 | Stable | Review quarterly; check for adoption gaps |
| 20–39 | At risk | CS outreach within 7 days |
| 0–19 | Critical | CS contact within 48 hours; offer assisted onboarding |

**Challenge to this design:** Health scores are opinions encoded as numbers. A health score of 45 sounds precise but depends entirely on the weights assigned. These weights should be validated against actual churn data — an agency that churned should have had a declining health score 60 days prior. If the score doesn't predict churn in retrospect, the weights are wrong.

---

### Feature Health Score (per feature, 0–100)

**Purpose:** Identifies features to invest in, redesign, or retire.

**Inputs:**

| Signal | Weight |
|---|---|
| 30-day adoption rate (% of target role users who used it) | 35% |
| 30-day retention rate (% who used it last month and again this month) | 35% |
| Error rate when feature is used | 20% |
| Time-to-first-use (lower = better discoverability) | 10% |

**Interpretation:**

| Adoption | Retention | Diagnosis |
|---|---|---|
| Low | Low | Feature is not discovered or not valuable |
| Low | High | Feature is useful but hidden — discoverability problem |
| High | Low | Feature is tried and abandoned — value promise not delivered |
| High | High | Healthy feature |

---

### Navigation Health Score (per nav item)

**Purpose:** Drives decisions about nav item promotion, demotion, or removal.

**Inputs:**

| Signal | Weight |
|---|---|
| Click frequency (sessions where item is clicked / total sessions for role) | 40% |
| Navigation back rate (users who clicked, immediately returned) | -30% |
| Position in session path (earlier = more intentional) | 20% |
| Dead-end rate (item clicked, no subsequent action) | -10% |

---

### Workflow Health Score (per workflow step)

**Purpose:** Identifies bottlenecks in the golden workflow.

**Inputs per step:** Completion rate, average dwell time, error rate, abandonment rate.

A step with high dwell time and high abandonment is the friction point. A step with high dwell time and normal completion is appropriate complexity.

---

## 10. Product Decision Framework

This is the most important section. Analytics without a decision framework is noise collection.

### When should a sidebar nav item be removed?

**Trigger (all three must be true):**
1. Navigation Health Score < 25 for 3 consecutive weeks
2. Click frequency < 5% of target role sessions in 90-day window
3. Feature Health Score < 30 (confirming the feature, not just the nav item, is underused)

**Why all three?** A nav item might have low clicks because the feature is accessed from within another flow (proposals are created from clients, so the Proposals nav item may not be clicked directly). The Feature Health Score confirms whether the underlying feature is used, regardless of navigation path.

**Action:** Move the feature to a secondary surface (inside a related module) rather than removing it entirely. Removal is irreversible; demotion is not.

---

### When should a workflow step be changed?

**Trigger:** `workflow.abandoned` at that step > 20% of workflows reaching that step for 2 consecutive months.

**Investigation before action:** Cross-reference with `friction.form.abandoned` to identify if a specific field is causing the drop. If the field is optional, make it optional. If mandatory, consider whether it is truly required at that point.

**Challenge:** Abandonment might mean "this step is too hard" or "users found a faster path." Check whether the agencies with high abandonment at step N have completed bookings anyway (they found an alternate path) or have genuinely abandoned (no subsequent progress).

---

### When should a feature be redesigned?

**Trigger:** Feature Health Score < 40 AND the score has been stable (not improving) for 60 days AND adoption > 20% (confirming users are reaching it, not just failing to discover it).

Low adoption + stable low score + users are reaching the feature = the feature's UX does not deliver its value promise.

**Action sequence:**
1. Session replay review (PostHog) for users who tried and abandoned the feature.
2. Qualitative interviews with 5 agencies.
3. Hypothesis-driven redesign.
4. Staged rollout via feature flag to beta cohort.

**Do not redesign based on analytics alone.** Analytics locates the problem; user research diagnoses it.

---

### When should a feature be retired?

**Trigger (all three must be true for 90 days):**
1. Adoption rate < 5% of target role population
2. Retention rate < 10% (users who tried it do not return)
3. Feature Health Score < 20

**Process:** Announce deprecation 60 days before removal. Check support tickets for dependency. Offer migration path if any agency uses the feature in their primary workflow.

**Challenge this:** Low adoption does not mean low value. An insurance module might have 3% adoption but represent 100% of the revenue for the agencies using it. Check revenue impact before retiring any feature.

---

### When should a new module be promoted into the navigation?

**Trigger:** A feature lives inside another module and meets:
1. Feature Health Score > 70 for 8 consecutive weeks
2. Adoption > 30% of target role users
3. Average of 3+ times per session for users who adopt it (habitual use)

**Additional condition:** The navigation has room. If adding the module exceeds the visible-without-scroll threshold for the median screen size (currently ~10 visible items for agent role), evaluate collapsing an existing section before adding.

---

### When should a feature move from beta to GA?

**Trigger (all must be met):**
1. Beta adoption rate > 70% of invited beta agencies
2. 30-day retention rate > 60% of beta adopters
3. Error rate < 2% of feature invocations
4. No open P0/P1 bugs
5. Health score of beta agencies held steady or improved during beta

**Disqualifying signals:**
- Any beta agency whose health score declined > 15 points after feature exposure
- Error spike not yet resolved
- Negative qualitative feedback from > 2 beta agencies

---

### When should navigation architecture change (the meta-decision)?

The navigation architecture audit established decision thresholds. Analytics operationalises them:

**Threshold 1 — Collapsible sections:**
`nav.sidebar.scroll_required` events exceed 30% of sessions for manager or admin role for 3 consecutive weeks.

**Threshold 2 — Cmd+K:**
Average `nav_item_click` count per session exceeds 8 (users are navigating heavily rather than working) OR `navigation_back_immediate` rate exceeds 15% of page views.

**Threshold 3 — Second navigation level (hub-and-spoke):**
Agent role `analytics_daily.session_unique_domains` shows > 60% of agent sessions remain within a single domain (WORK) for 60 days. This confirms agents do not need cross-domain nav and can tolerate a hub switch.

**The hard rule:** No navigation architecture change is made without 90 days of data supporting the trigger and a user research session with at least 5 agencies. Data triggers the investigation; research validates the diagnosis.

---

## Implementation phasing

### Phase 0 — Foundation (before first paying customer)

1. Add PostHog JS SDK. Track only: `nav.sidebar.item_clicked`, `nav.page.viewed`, `nav.page.back_immediate`.
2. Create `analytics` schema with `analytics_events` table.
3. Extend `logActivity` to also write to `analytics_events` for business events.
4. Fire-and-forget emitter function that never throws.

Cost: 3 days of engineering. Non-negotiable before launch.

### Phase 1 — 10 agencies

Add: workflow funnel events, form abandonment, search events, onboarding events.
Build: Golden Workflow Funnel dashboard (internal).
Deploy: PostHog feature flags for staged rollouts.

### Phase 2 — 100 agencies

Build: `analytics_daily` aggregation job.
Build: Agency Health Score computation.
Build: Agency-facing insights page (their own data only).
Add: Cohort definition logic (agency type/size segmentation).

### Phase 3 — 500+ agencies

Build: `analytics_cohorts` benchmarking computation.
Enable: "You are X% faster than similar agencies" benchmarks.
Build: Full internal dashboard suite (CEO, Product, CS, Sales).
Evaluate: Event bus if event volume exceeds 1,000/second.

---

## The recommendation that challenges itself

This architecture has a hidden cost: **it requires discipline in every server action and every client component to not skip instrumentation.** A single server action that does not call `emitAnalyticsEvent` creates a gap in the funnel. At 20 action files, this is manageable. At 80 action files, it is not.

The mitigation is to treat `emitAnalyticsEvent` as part of the action contract — the same way every action calls `requireAgencyUser()` before doing anything, it calls `emitAnalyticsEvent()` after. Make it a code review checklist item and eventually a lint rule.

The deeper challenge: **analytics is a maintenance burden that accumulates.** Every renamed route, every removed form field, every new workflow step requires an analytics update. If the team does not treat analytics debt as real technical debt, the event schema will diverge from the product within 6 months.

The solution is ruthless schema minimalism. Track fewer events, track them well, and resist the temptation to instrument everything that might someday be interesting. The 57-event schema in the product analytics strategy document is the ceiling, not the floor.

---

## References

- [Product Analytics Strategy](product-analytics-strategy.md) — the event schema and KPI definitions this architecture implements
- [CTO Review](cto-review.md) — performance and scale constraints that bound the architecture
- [docs/decisions/](decisions/) — architecture decisions log
