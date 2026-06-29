export const meta = {
  name: 'atlas-presentation-finish',
  description: 'Finish remaining Atlas deliverables: full demo dataset, design guide, and final review',
  phases: [
    { title: 'Build', detail: 'full-scale demo-data.json + DEMO-DATASET.md + DESIGN-RECOMMENDATIONS.md' },
    { title: 'Review', detail: 'creative-director consistency + CEO value-focus critique' },
  ],
}

const ROOT = '/Users/malekouksili/Desktop/agence_tool'
const M = `${ROOT}/marketing`

const BRAND = [
  'ATLAS TRAVEL DESK — "The Operating System for Modern Travel Agencies".',
  'Premium B2B SaaS sales artifact for travel-agency CEOs (Stripe/Linear/Notion quality).',
  'Business-value language, not technical. Demo agency: "Atlas Travel Demo".',
  'Agents: Yasmine Haddad (Manager), Karim Benali, Lina Cherif, Omar Said (Agents),',
  'Nadia Toure (Finance), Sofiane Mansouri (Support). Currency DZD (also EUR/USD).',
  'Destinations: Algiers, Paris, Dubai, Istanbul, Casablanca, Marrakesh, Cairo, Hurghada,',
  'Sharm El Sheikh, Rome, Barcelona, Madrid, Antalya, Doha, Jeddah, Tunis, Maldives.',
].join('\n')

phase('Build')
log('Generating full-scale demo dataset + design recommendations...')

const built = await parallel([
  () => agent(
    [BRAND,
      `Read ${M}/assets/demo-data.js for the canonical entities, then EXPAND to a full-scale`,
      `demo dataset. Write ${M}/demo-data.json (valid JSON) and a human summary`,
      `${M}/DEMO-DATASET.md. Scale: 150 clients, 75 active opportunities, 45 confirmed`,
      'bookings, 30 pending proposals, 12 employees, 40 suppliers, 250 completed trips, 12',
      'months revenue history, plus activities, notifications, emails, and documents. The 14',
      'canonical clients, 10 bookings and 6 agents from demo-data.js MUST appear (same',
      'names/ids) as the featured subset so the dataset matches the mockups exactly.',
      'Authentic names, destinations, BKG-/PRD- references, invoices, passports, hotels,',
      'airlines, payment history, DZD/EUR/USD. Internally consistent: totals add up,',
      'paid+outstanding=total, statuses coherent, dates sensible. DEMO-DATASET.md documents',
      'the JSON schema, headline counts, and how each collection maps to the screens.',
      'Return a short summary + the final counts.',
    ].join('\n'),
    { label: 'dataset:full', phase: 'Build', schema: {
      type: 'object', additionalProperties: false, required: ['summary', 'counts'],
      properties: { summary: { type: 'string' }, counts: { type: 'string' } } } }),

  () => agent(
    [BRAND,
      `Read ${M}/assets/atlas-ui.css and ${ROOT}/DESIGN.md, then write`,
      `${M}/DESIGN-RECOMMENDATIONS.md — the presentation & brand design guide (Deliverable 4).`,
      'Cover: color palette (hex + usage), typography (Inter scale, weights, tracking), icon',
      'library (Lucide) with usage rules, illustration & hero-graphic direction, chart style,',
      'photography style (destination imagery guidance), the deck motion/transition system,',
      'the slide layout grid, and clear do/dont examples. Tie to Apple/Stripe/Notion/Linear.',
      'Premium, specific and immediately usable by a designer. Return a one-line summary.',
    ].join('\n'),
    { label: 'design:doc', phase: 'Build', schema: {
      type: 'object', additionalProperties: false, required: ['summary'],
      properties: { summary: { type: 'string' } } } }),
])
log(`Build complete — ${built.filter(Boolean).length}/2 artifacts written.`)

phase('Review')
log('Final review: creative-director consistency + CEO value-focus...')

const reviews = await parallel([
  () => agent(
    [`You are a CREATIVE DIRECTOR at a top product-design studio. Review the Atlas sales`,
      `artifacts for VISUAL polish and CONSISTENCY. Read ${M}/index.html (the deck) and these`,
      `mockups in ${M}/mockups/ : dashboard.html, crm.html, opportunities.html,`,
      'proposal-builder.html, reports.html, ai-assistant.html, booking-details.html.',
      'Check: shared design tokens used everywhere, the SAME clients/agents/bookings recur,',
      'no empty states, no lorem, spacing/hierarchy/contrast, charts legible, frames clean,',
      'deck copy is value-focused. Return the TOP 8 concrete, file-specific fixes (most',
      'important first) that would most raise perceived quality, each with a severity.',
    ].join('\n'),
    { label: 'review:creative', phase: 'Review', schema: {
      type: 'object', additionalProperties: false, required: ['fixes'],
      properties: { fixes: { type: 'array', items: { type: 'object', additionalProperties: false,
        required: ['file', 'issue', 'fix', 'severity'], properties: {
          file: { type: 'string' }, issue: { type: 'string' }, fix: { type: 'string' },
          severity: { type: 'string' } } } } } } }),

  () => agent(
    [`You are the CEO of a mid-size travel agency evaluating Atlas. Read the deck`,
      `${M}/index.html slide by slide (it is an HTML deck; read the slide copy). Flag any`,
      'slide that is FEATURE-focused instead of VALUE-focused, or that fails to answer "why',
      'should I buy this?". For each, give the slide, the problem, and a rewritten',
      'value-focused headline/subhead. Rate overall persuasiveness out of 10 and name the',
      'single biggest improvement. Be exacting and concrete.',
    ].join('\n'),
    { label: 'review:ceo', phase: 'Review', schema: {
      type: 'object', additionalProperties: false, required: ['rating', 'biggestWin', 'slideFixes'],
      properties: { rating: { type: 'number' }, biggestWin: { type: 'string' },
        slideFixes: { type: 'array', items: { type: 'object', additionalProperties: false,
          required: ['slide', 'problem', 'rewrite'], properties: {
            slide: { type: 'string' }, problem: { type: 'string' }, rewrite: { type: 'string' } } } } } } }),
])

return {
  artifacts: built.filter(Boolean).length,
  datasetCounts: (built[0] && built[0].counts) ? built[0].counts : 'n/a',
  creativeFixes: (reviews[0] && reviews[0].fixes) ? reviews[0].fixes : [],
  ceoRating: reviews[1] && reviews[1].rating,
  ceoBiggestWin: reviews[1] && reviews[1].biggestWin,
  ceoSlideFixes: (reviews[1] && reviews[1].slideFixes) ? reviews[1].slideFixes : [],
}
