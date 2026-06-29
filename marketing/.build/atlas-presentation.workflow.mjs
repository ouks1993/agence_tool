export const meta = {
  name: 'atlas-sales-presentation',
  description: 'Build a premium HTML sales deck + high-fidelity UI mockups + demo dataset for Atlas Travel Desk',
  phases: [
    { title: 'Foundation', detail: 'shared design-system CSS + canonical demo dataset' },
    { title: 'Build', detail: '11 mockups + 18-slide deck + full dataset + design doc (parallel)' },
    { title: 'Review', detail: 'creative-director + CEO value-focus critique' },
  ],
}

const ROOT = '/Users/malekouksili/Desktop/agence_tool'
const M = `${ROOT}/marketing`

const BRAND = [
  'ATLAS TRAVEL DESK — "The Operating System for Modern Travel Agencies".',
  'This is a PREMIUM B2B SaaS sales artifact for travel-agency CEOs. Reference quality:',
  'Stripe, Linear, Notion, Attio, HubSpot, Ramp, Figma. Elegant, minimal, confident,',
  'enterprise — never cluttered, never cheesy. BUSINESS-value language, not technical.',
  'Audience does NOT care about the tech stack. Banned words: revolutionary, disruptive,',
  'cutting-edge, next-generation, amazing, incredible.',
  '',
  'The real product covers: Travel CRM, Sales pipeline (Kanban), Proposal builder with',
  'e-signature + AI, integrated Flight (Duffel) & Hotel (Hotelbeds) search, Booking',
  'management (travellers, payments, suppliers, documents), Client portal, AI assistant',
  '(itinerary/email/quote/visa), Reports & analytics, automation, multi-tenant.',
  'Default currency DZD (also EUR/USD). Real destinations featured: Algiers, Paris, Dubai,',
  'Istanbul, Casablanca, Marrakesh, Cairo, Hurghada, Sharm El Sheikh, Rome, Barcelona,',
  'Madrid, Antalya, Doha, Jeddah, Tunis, London, Bangkok, Maldives.',
  'Demo agency: "Atlas Travel Demo". Reuse these REAL agent names across all screens:',
  'Yasmine Haddad (Manager), Karim Benali (Agent), Lina Cherif (Agent), Omar Said (Agent),',
  'plus Nadia Toure (Finance), Sofiane Mansouri (Support).',
].join('\n')

const FOUNDATION_CSS_INSTR = [
  `Write ${M}/assets/atlas-ui.css — a single, polished, marketing-grade design system used`,
  `by EVERY mockup and the deck. Read ${ROOT}/DESIGN.md first and adapt its tokens to a`,
  'premium SaaS marketing palette. Requirements:',
  '',
  'DESIGN TOKENS (CSS variables on :root):',
  '- Palette: --ink #0E1525 (dark sidebar/nav), --navy #1B2239, --canvas #F6F8FB,',
  '  --surface #FFFFFF, --border #E6EAF1, --text #1B2333, --muted #6B7385,',
  '  --brand #2B59C3 (primary action), --brand-soft #EAF0FC, --success #1E9E6A,',
  '  --warning #C77800, --danger #D14343, --amber #B45313, chart colors --c1..--c6.',
  '- Radii: --r-sm 6px, --r 10px, --r-lg 14px, --r-xl 20px. Soft shadows --shadow-sm/-md/-lg.',
  '- Font: load Inter from Google Fonts (@import) as the SaaS face; mono = ui-monospace.',
  '  Tight tracking on large headings.',
  '',
  'COMPONENT CLASSES (name them EXACTLY; mockups depend on these):',
  '- App shell: .app, .sidebar (dark --ink), .sidebar-logo, .nav, .nav-item (+ .active),',
  '  .nav-section-label, .topbar, .topbar-search, .main, .page, .page-header, .breadcrumb.',
  '- Surfaces: .card, .card-header, .card-title, .card-body, .panel, .section-title.',
  '- Stats/KPI: .stat-grid, .stat-card, .stat-label, .stat-value, .stat-delta (+ .up/.down).',
  '- Buttons: .btn, .btn-primary, .btn-ghost, .btn-outline, .btn-sm, .btn-icon.',
  '- Badges/pills: .badge (+ .badge-success/.warning/.danger/.info/.neutral), .pill, .tag.',
  '- Tables: .table (clean ruled, bold header, hover rows), .table-actions.',
  '- Avatars: .avatar (initials, brandable bg), .avatar-group.',
  '- Kanban: .board, .board-col, .board-col-head, .kanban-card.',
  '- Forms: .field, .label, .input, .select, .textarea, .switch.',
  '- Timeline: .timeline, .timeline-item, .timeline-dot.',
  '- Layout: .row, .col, .grid-2, .grid-3, .grid-4, .flex, .between, gaps, .muted, .strong.',
  '- Deck chrome: .browser-frame (mac traffic lights + url bar) wrapping an iframe;',
  '  .phone-frame (notch) for mobile.',
  '- Charts: .chart container + inline-SVG bar/line/donut/area styles and .legend.',
  '',
  'Must look like genuinely shipped software (Stripe/Linear-grade): generous whitespace,',
  'crisp 1px borders, soft shadows, restrained color, strong type hierarchy. Light theme.',
  'Return a concise cheat-sheet of class names + palette vars.',
].join('\n')

const FOUNDATION_DATA_INSTR = [
  `Write ${M}/assets/demo-data.js — the CANONICAL demo dataset shared by every screen, as`,
  'a single global window.ATLAS object (also valid to read as plain JS literals). This is',
  'the single source of truth so the SAME entities recur across all mockups.',
  BRAND,
  '',
  'Include (authentic, internally consistent, realistic numbers):',
  "- agency: { name:'Atlas Travel Demo', plan, since:'2019' }",
  '- kpis: monthly revenue (DZD, tens of millions), bookings count, pipeline value,',
  '  conversion %, avg margin %, deltas vs last month (believable mix of up/down).',
  '- agents: the 6 named people above with role, avatar initials, monthly sales, deals.',
  '- clients: 14 fully-detailed recurring clients (individual + corporate): name, type,',
  '  company?, email, phone, city/country, status (lead/active/vip), tags, lifetime value',
  '  (DZD), trips count, last activity, a passport (number, nationality, expiry) for the',
  '  lead traveller, preferences (seat, hotel tier, dietary). Regionally authentic names.',
  '- opportunities: 10 deals across lead/qualified/proposal/negotiation/won with client,',
  '  title, value (DZD), agent owner, destination, close date, probability.',
  '- bookings: 10 detailed bookings: reference (BKG-2026-0xx), client, destination, dates,',
  '  status (draft/awaiting_payment/confirmed/ticketed/completed), total (DZD),',
  '  paid/outstanding, travellers, flights (airline, route, dates, PNR), hotel (name,',
  '  stars, nights), supplier refs, agent.',
  '- proposals: 6 quotations (PRD-xxx): client, destination, value, status, validity, items.',
  '- suppliers: 10 (airlines Air Algerie, Emirates, Turkish, Qatar; bedbanks Hotelbeds,',
  '  Jaz, Rixos; DMCs; insurance) with type, contracts, commission %.',
  '- destinations: top 8 by revenue with bookings + revenue share (for charts).',
  '- revenueSeries: 12 months of revenue (DZD); bookingsSeries likewise.',
  '- activity: 8 recent feed items. notifications: 5. tasks: 6 follow-ups with due dates.',
  '- upcomingDepartures: 5 trips departing soon (client, destination, date, status).',
  '',
  'Return a compact summary listing the exact ids/names of the 14 clients, 10 bookings,',
  '6 agents and headline KPI numbers, so downstream agents feature the SAME entities.',
].join('\n')

const SCREENS = [
  { file: 'dashboard.html', title: 'Dashboard', spec:
    'Agency command center. Top: KPI stat-grid (Revenue this month, Confirmed bookings, '
    + 'Pipeline value, Conversion) with deltas. Main grid: a large Revenue area-chart card '
    + '(12-mo inline SVG), a Bookings-by-status donut, a Pipeline mini-funnel, an Upcoming '
    + 'departures list, a Recent activity timeline, a Tasks/Follow-ups card, and an "Atlas '
    + 'suggests" card with 2 value-focused recommendations. Sidebar nav (Dashboard active), '
    + 'topbar with search + agency switcher + Yasmine avatar.' },
  { file: 'crm.html', title: 'CRM — Client profile', spec:
    'Full client profile for a recurring VIP client. Left: identity card (avatar, name, '
    + 'company, VIP status, contact, lifetime value, trips count, tags). Tabs: Overview, '
    + 'Trips, Documents, Passport, Preferences, Family, Notes. Show a communication TIMELINE '
    + '(emails, calls, proposals, payments), a Trips list matching canonical bookings, a '
    + 'Documents list (passport, visa, invoices), Passport card, Preferences. Right rail: '
    + 'quick actions + owner (Karim).' },
  { file: 'opportunities.html', title: 'Sales pipeline (Kanban)', spec:
    'Beautiful Kanban .board with columns Lead, Qualified, Proposal, Negotiation, Won. '
    + 'Populate with the 10 canonical opportunities as .kanban-card (client avatar, title, '
    + 'destination, value DZD, owner avatar, close date, probability bar). Column headers '
    + 'show count + total value. Top bar: pipeline total, filters, New-opportunity button.' },
  { file: 'proposal-builder.html', title: 'Proposal builder', spec:
    'Professional quotation editor (split layout). Left = builder: client selector, trip '
    + 'header (destination, dates, pax), line-item sections Flights / Hotels / Activities / '
    + 'Transfers / Insurance each with rows (supplier, detail, cost, markup, sell), an AI '
    + 'itinerary assist chip, running totals (cost, margin %, total DZD). Right = live CLIENT '
    + 'PREVIEW of the branded proposal (cover, day-by-day itinerary snippet, price summary, '
    + 'e-signature block "Awaiting signature"). Header actions: Save, Send, Convert to booking.' },
  { file: 'flight-search.html', title: 'Flight search', spec:
    'Integrated flight results. Search bar (Algiers ALG to Dubai DXB, dates, 2 pax, economy). '
    + 'Left filters (stops, airlines, departure window, price, baggage). Results = comparison '
    + 'cards: airline logo block, times, duration, stops, cabin, price DZD, Select + Add to '
    + 'proposal. Show 5 options (Air Algerie, Emirates, Turkish, Qatar) with a best-value tag.' },
  { file: 'hotel-search.html', title: 'Hotel search', spec:
    'Beautiful hotel results for Dubai. Left filters (stars, price, board, amenities, '
    + 'district). Grid of hotel cards: colored cover with hotel name, stars, location, review '
    + 'score, amenities pills, from-price/night DZD, refundable badge, View rooms / Add. '
    + 'Include a small map panel placeholder with pins. 6 hotels.' },
  { file: 'booking-details.html', title: 'Booking details', spec:
    'One canonical confirmed booking (BKG-2026-014, Dubai). Header: reference, client, status '
    + 'stepper (Draft, Awaiting payment, Confirmed, Ticketed, Completed) with current state. '
    + 'Main: Travellers (passport chips), Flights card (route, PNR, times), Hotel card (name, '
    + 'stars, nights, board), Documents (voucher, ticket, invoice), Activity timeline. Right '
    + 'rail: Payment summary (total, paid, outstanding DZD, Record payment), Supplier refs, '
    + 'Assigned agent, Notes.' },
  { file: 'customer-portal.html', title: 'Customer portal (traveller)', spec:
    'Client-facing portal — warmer, simpler, branded. Welcome back, <client>. Upcoming trip '
    + 'hero card (destination, dates, countdown, status). Sections: My trips (timeline), '
    + 'Documents (download tickets/vouchers/visa), Payments (paid + Pay-balance CTA with DZD '
    + 'amount), Proposal awaiting your signature (e-sign CTA), Support. Clean, trust-building.' },
  { file: 'ai-assistant.html', title: 'AI assistant', spec:
    'Modern chat interface (Linear/Notion-AI grade). Left: conversation — agent asks "Draft a '
    + '5-day Istanbul itinerary for the Benali family", assistant returns a structured '
    + 'day-by-day itinerary card; another turn drafts a client email in a preview card with '
    + 'Send/Edit. Right: context panel (current client, booking, suggested actions: Generate '
    + 'quote, Draft follow-up, Check visa). Bottom: composer with suggestion chips.' },
  { file: 'reports.html', title: 'Reports & analytics', spec:
    'Executive analytics dashboard. KPI row (Revenue, Profit, Bookings, Conversion, Avg '
    + 'margin, Repeat rate) with deltas. Charts (inline SVG): Revenue trend (12-mo area), '
    + 'Bookings by destination (horizontal bars, top 8), Sales by agent (bars), Pipeline '
    + 'funnel, Margin by product type (donut). A forecast callout. Date-range + export in '
    + 'header. Polished, data-dense but legible.' },
  { file: 'mobile.html', title: 'Mobile', spec:
    'A presentation board on --canvas showing FOUR .phone-frame devices side by side: '
    + '(1) Dashboard (KPIs + revenue sparkline + upcoming departure), (2) Booking detail '
    + '(status stepper + pay balance), (3) Client portal (upcoming trip + documents), '
    + '(4) AI assistant (chat). Faithful condensed mobile versions reusing the same data + '
    + 'tokens. Title above: "Atlas in your pocket".' },
]

phase('Foundation')
log('Locking the shared design system + canonical demo dataset...')
const [styleGuide, dataSummary] = await parallel([
  () => agent(
    `${BRAND}\n\n${FOUNDATION_CSS_INSTR}`,
    { label: 'foundation:css', phase: 'Foundation', schema: {
      type: 'object', additionalProperties: false,
      required: ['classes', 'palette', 'notes'],
      properties: {
        classes: { type: 'array', items: { type: 'string' } },
        palette: { type: 'array', items: { type: 'string' } },
        notes: { type: 'string' },
      } } }),
  () => agent(
    FOUNDATION_DATA_INSTR,
    { label: 'foundation:data', phase: 'Foundation', schema: {
      type: 'object', additionalProperties: false,
      required: ['clients', 'bookings', 'agents', 'kpis'],
      properties: {
        clients: { type: 'array', items: { type: 'string' } },
        bookings: { type: 'array', items: { type: 'string' } },
        agents: { type: 'array', items: { type: 'string' } },
        kpis: { type: 'string' },
      } } }),
])
log(`Foundation ready — ${(styleGuide && styleGuide.classes ? styleGuide.classes.length : 0)} classes, ${(dataSummary && dataSummary.clients ? dataSummary.clients.length : 0)} canonical clients.`)

const clientsList = (dataSummary && dataSummary.clients ? dataSummary.clients : []).join(', ')
const bookingsList = (dataSummary && dataSummary.bookings ? dataSummary.bookings : []).join(', ')
const agentsList = (dataSummary && dataSummary.agents ? dataSummary.agents : []).join(', ')
const kpisLine = (dataSummary && dataSummary.kpis) ? dataSummary.kpis : ''

const SHARED = [
  'You MUST read these two foundation files and use them verbatim (same classes, same data):',
  `  - ${M}/assets/atlas-ui.css   (link it: <link rel="stylesheet" href="../assets/atlas-ui.css">)`,
  `  - ${M}/assets/demo-data.js   (canonical entities — feature the SAME clients/bookings/agents)`,
  `Canonical clients: ${clientsList}.`,
  `Canonical bookings: ${bookingsList}.  Agents: ${agentsList}.`,
  `KPIs: ${kpisLine}`,
  BRAND,
  'Output a COMPLETE standalone HTML file (full doctype..</html>), linking the shared CSS.',
  'Charts = inline SVG (no external libs). No empty states — populate everything with the',
  'canonical data. Make it look like shipped software a real agency has used for years.',
].join('\n')

phase('Build')
log('Fanning out 11 mockups + deck + dataset + design doc...')

const buildThunks = [
  ...SCREENS.map(s => () => agent(
    `${SHARED}\n\nSCREEN: ${s.title}\nWrite ${M}/mockups/${s.file}.\n${s.spec}`,
    { label: `mockup:${s.file.replace('.html', '')}`, phase: 'Build', schema: {
      type: 'object', additionalProperties: false, required: ['file', 'summary'],
      properties: { file: { type: 'string' }, summary: { type: 'string' },
        usesEntities: { type: 'array', items: { type: 'string' } } } } })),

  () => agent(
    [SHARED, '',
      `Write ${M}/index.html — the flagship 18-slide SALES DECK (Apple/Stripe/Linear-grade).`,
      'A single self-contained HTML deck with keyboard arrow-key + dot navigation + smooth',
      'fade/slide transitions (vanilla JS, no libs). Full-bleed 16:9 slides, large type,',
      'generous whitespace, restrained color, the shared palette. Each product slide shows the',
      'REAL UI by embedding the matching mockup inside a .browser-frame, e.g.',
      '  <div class="browser-frame"><iframe src="mockups/dashboard.html"></iframe></div>',
      'scaled with transform:scale so the full screen shows cleanly.',
      '',
      'The 18 slides — make EVERY slide VALUE-focused (answer "Why should I buy Atlas?"):',
      ' 1 Hero — Atlas Travel Desk / The Operating System for Modern Travel Agencies.',
      ' 2 The problem — fragmented tools (Excel, WhatsApp, email, supplier sites, PDFs,',
      '   separate CRM/accounting) and the cost of disconnected work (lost time, margin, errors).',
      ' 3 Run your entire agency from one platform — the Lead, Client, Opportunity, Proposal,',
      '   Booking, Payment, Travel, Loyal-customer journey as an elegant horizontal flow.',
      ' 4 Meet Atlas — the operating-system overview (one place, every workflow).',
      ' 5 Travel CRM — embed mockups/crm.html. Value: never lose a client detail; sell more',
      '   to the clients you already have.',
      ' 6 Sales pipeline — embed opportunities.html. Value: see every deal + forecast revenue.',
      ' 7 Professional quotations — embed proposal-builder.html. Value: win more proposals,',
      '   complete itineraries in minutes instead of hours, one click to booking.',
      ' 8 Flight & hotel search — embed flight-search.html. Value: source and sell without',
      '   leaving Atlas.',
      ' 9 Booking management — embed booking-details.html. Value: every booking under control.',
      ' 10 Customer portal — embed customer-portal.html. Value: a premium traveller experience',
      '    that gets you paid faster and referred more.',
      ' 11 Artificial intelligence — embed ai-assistant.html. Value: your team time back.',
      ' 12 Reports & analytics — embed reports.html. Value: decisions backed by numbers.',
      ' 13 Automation — follow-ups, reminders, documents, lifecycle. Value: nothing slips.',
      ' 14 Why agencies choose Atlas — a clean comparison table Traditional vs Atlas (time to',
      '    quote, tools used, errors, client experience, visibility, scalability).',
      ' 15 Security & trust — cloud, permissions/roles, agency isolation, reliable infra,',
      '    online payments, support. Business framing (trust), not technical.',
      ' 16 Designed to grow — single office, branches, corporate travel, scalable ops; also',
      '    reference mockups/mobile.html here.',
      ' 17 Roadmap — continuous innovation: more suppliers, deeper AI, automation, integrations.',
      ' 18 Close — Atlas / The Operating System for Modern Travel Agencies + strong CTA',
      '    (Book a 30-minute walkthrough).',
      'Add a tasteful slide footer (logo + slide number). Return only a short summary.',
    ].join('\n'),
    { label: 'deck:index', phase: 'Build', schema: {
      type: 'object', additionalProperties: false, required: ['summary', 'slideCount'],
      properties: { summary: { type: 'string' }, slideCount: { type: 'number' } } } }),

  () => agent(
    [BRAND,
      `Read ${M}/assets/demo-data.js for the canonical entities, then EXPAND to a full-scale`,
      `demo dataset and write ${M}/demo-data.json (valid JSON) PLUS a human summary`,
      `${M}/DEMO-DATASET.md. Scale: 150 clients, 75 active opportunities, 45 confirmed`,
      'bookings, 30 pending proposals, 12 employees, 40 suppliers, 250 completed trips, 12',
      'months revenue history, activities, notifications, emails, documents. The 14 canonical',
      'clients / 10 bookings / 6 agents from demo-data.js MUST appear (same names/ids) as the',
      'featured subset so the dataset matches the mockups. Authentic names, destinations,',
      'BKG-/PRD- references, invoices, passports, hotels, airlines, payment history, DZD/EUR/',
      'USD. Internally consistent (totals add up, paid+outstanding=total, coherent statuses).',
      'DEMO-DATASET.md documents the schema + headline counts + how it maps to the screens.',
      'Return a summary.',
    ].join('\n'),
    { label: 'dataset:full', phase: 'Build', schema: {
      type: 'object', additionalProperties: false, required: ['summary', 'counts'],
      properties: { summary: { type: 'string' }, counts: { type: 'string' } } } }),

  () => agent(
    [BRAND,
      `Read ${M}/assets/atlas-ui.css and ${ROOT}/DESIGN.md, then write`,
      `${M}/DESIGN-RECOMMENDATIONS.md — the presentation & brand design guide: color palette`,
      '(hex + usage), typography (Inter scale + weights + tracking), icon library (Lucide),',
      'illustration & hero-graphic direction, chart style, photography style (destination',
      'imagery), motion/transition system for the deck, slide layout grid, and do/dont',
      'examples. Tie to Apple/Stripe/Notion/Linear. Premium, specific, usable. One-line return.',
    ].join('\n'),
    { label: 'design:doc', phase: 'Build', schema: {
      type: 'object', additionalProperties: false, required: ['summary'],
      properties: { summary: { type: 'string' } } } }),
]

const built = await parallel(buildThunks)
const okFiles = built.filter(Boolean).length
log(`Build complete — ${okFiles}/${buildThunks.length} artifacts produced.`)

phase('Review')
log('Creative-director + CEO value-focus review...')
const reviews = await parallel([
  () => agent(
    [`You are a CREATIVE DIRECTOR at a top product-design studio. Review the Atlas sales`,
      `artifacts for VISUAL polish + CONSISTENCY. Read ${M}/index.html and these mockups in`,
      `${M}/mockups/ : dashboard.html, crm.html, opportunities.html, proposal-builder.html,`,
      'reports.html, ai-assistant.html. Check: same design tokens everywhere, same',
      'clients/agents/bookings recur, no empty states, no lorem, spacing/hierarchy/contrast,',
      'charts legible, frames clean. Return the TOP 8 concrete, file-specific fixes (most',
      'important first) that would most raise perceived quality.',
    ].join('\n'),
    { label: 'review:creative', phase: 'Review', schema: {
      type: 'object', additionalProperties: false, required: ['fixes'],
      properties: { fixes: { type: 'array', items: { type: 'object', additionalProperties: false,
        required: ['file', 'issue', 'fix', 'severity'], properties: {
          file: { type: 'string' }, issue: { type: 'string' }, fix: { type: 'string' },
          severity: { type: 'string' } } } } } } }),
  () => agent(
    [`You are the CEO of a mid-size travel agency evaluating Atlas. Read the deck`,
      `${M}/index.html slide by slide. Flag any slide that is FEATURE-focused instead of`,
      'VALUE-focused, or that fails to answer "why should I buy this?". For each, give the',
      'slide, the problem, and a rewritten value-focused headline/subhead. Also rate overall',
      'persuasiveness out of 10 with the single biggest improvement. Be exacting.',
    ].join('\n'),
    { label: 'review:ceo', phase: 'Review', schema: {
      type: 'object', additionalProperties: false, required: ['rating', 'slideFixes', 'biggestWin'],
      properties: { rating: { type: 'number' }, biggestWin: { type: 'string' },
        slideFixes: { type: 'array', items: { type: 'object', additionalProperties: false,
          required: ['slide', 'problem', 'rewrite'], properties: {
            slide: { type: 'string' }, problem: { type: 'string' }, rewrite: { type: 'string' } } } } } } }),
])

return {
  styleClasses: (styleGuide && styleGuide.classes ? styleGuide.classes.length : 0),
  canonicalClients: (dataSummary && dataSummary.clients ? dataSummary.clients : []),
  artifacts: okFiles,
  mockups: SCREENS.map(s => s.file),
  creativeFixes: (reviews[0] && reviews[0].fixes) ? reviews[0].fixes : [],
  ceoRating: reviews[1] && reviews[1].rating,
  ceoBiggestWin: reviews[1] && reviews[1].biggestWin,
  ceoSlideFixes: (reviews[1] && reviews[1].slideFixes) ? reviews[1].slideFixes : [],
}
