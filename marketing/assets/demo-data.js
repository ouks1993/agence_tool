/**
 * ATLAS TRAVEL DESK — CANONICAL DEMO DATASET
 * "The Operating System for Modern Travel Agencies"
 *
 * Single source of truth for every marketing mockup, screenshot and demo screen.
 * The SAME entities (clients, bookings, agents, deals) recur across all surfaces so
 * the product feels real and internally consistent.
 *
 * Usage:
 *   - In a browser/mockup:  <script src="demo-data.js"></script>  then read window.ATLAS
 *   - As a module shim:     the object is also exposed on globalThis.ATLAS
 *
 * Conventions:
 *   - Default currency is DZD (Algerian Dinar). EUR/USD shown where relevant.
 *   - Money values are plain integers in the smallest sensible whole unit (DZD),
 *     so charts and tables can format them however they like.
 *   - Dates are ISO (YYYY-MM-DD). "Today" for this dataset is 2026-06-29.
 *   - Deltas are percentage points vs. the previous month.
 */

(function () {
  'use strict';

  const fmt = {
    // Lightweight helpers mockups can reuse so formatting stays consistent.
    dzd: (n) => new Intl.NumberFormat('en-US').format(n) + ' DZD',
    eur: (n) => '€' + new Intl.NumberFormat('en-US').format(n),
    usd: (n) => '$' + new Intl.NumberFormat('en-US').format(n),
    compactDZD: (n) => {
      if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B DZD';
      if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M DZD';
      if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K DZD';
      return n + ' DZD';
    },
    pct: (n) => (n > 0 ? '+' : '') + n + '%',
  };

  const ATLAS = {
    meta: {
      generatedFor: 'marketing-mockups',
      asOf: '2026-06-29',
      currencyDefault: 'DZD',
      fx: { DZD_per_EUR: 145, DZD_per_USD: 134 }, // indicative, for any EUR/USD display
      version: '1.0.0',
    },

    // -----------------------------------------------------------------------
    // AGENCY
    // -----------------------------------------------------------------------
    agency: {
      name: 'Atlas Travel Demo',
      plan: 'Scale',
      since: '2019',
      seats: 18,
      timezone: 'Africa/Algiers',
      baseCurrency: 'DZD',
      website: 'atlastravel.dz',
      hq: 'Algiers, Algeria',
    },

    // -----------------------------------------------------------------------
    // KPIs — headline numbers for dashboard hero
    // delta = pp change vs. last month
    // -----------------------------------------------------------------------
    kpis: {
      monthlyRevenue: { value: 42_800_000, currency: 'DZD', delta: 12.4, trend: 'up', label: 'Monthly revenue' },
      bookings:        { value: 168, delta: 8.0, trend: 'up', label: 'Bookings this month' },
      pipelineValue:   { value: 96_500_000, currency: 'DZD', delta: 5.1, trend: 'up', label: 'Open pipeline' },
      conversion:      { value: 34.2, unit: '%', delta: 2.3, trend: 'up', label: 'Search → booking' },
      avgMargin:       { value: 18.6, unit: '%', delta: -1.2, trend: 'down', label: 'Average margin' },
      avgBookingValue: { value: 254_800, currency: 'DZD', delta: 3.7, trend: 'up', label: 'Avg booking value' },
      proposalWinRate: { value: 41.0, unit: '%', delta: 4.0, trend: 'up', label: 'Proposal win rate' },
      outstanding:     { value: 7_240_000, currency: 'DZD', delta: -9.5, trend: 'down', label: 'Outstanding balance' },
    },

    // -----------------------------------------------------------------------
    // AGENTS — the recurring team. Reuse these exact people everywhere.
    // -----------------------------------------------------------------------
    agents: [
      { id: 'agt-yasmine', name: 'Yasmine Haddad',  role: 'Manager', initials: 'YH', email: 'yasmine@atlastravel.dz',  monthlySales: 11_900_000, deals: 9,  target: 12_000_000, color: '#6366f1' },
      { id: 'agt-karim',   name: 'Karim Benali',    role: 'Agent',   initials: 'KB', email: 'karim@atlastravel.dz',    monthlySales: 9_640_000,  deals: 14, target: 8_000_000,  color: '#0ea5e9' },
      { id: 'agt-lina',    name: 'Lina Cherif',     role: 'Agent',   initials: 'LC', email: 'lina@atlastravel.dz',     monthlySales: 8_210_000,  deals: 11, target: 8_000_000,  color: '#ec4899' },
      { id: 'agt-omar',    name: 'Omar Said',       role: 'Agent',   initials: 'OS', email: 'omar@atlastravel.dz',     monthlySales: 7_350_000,  deals: 10, target: 8_000_000,  color: '#f59e0b' },
      { id: 'agt-nadia',   name: 'Nadia Toure',     role: 'Finance', initials: 'NT', email: 'nadia@atlastravel.dz',    monthlySales: 0,          deals: 0,  target: 0,          color: '#10b981' },
      { id: 'agt-sofiane', name: 'Sofiane Mansouri',role: 'Support', initials: 'SM', email: 'sofiane@atlastravel.dz',  monthlySales: 0,          deals: 0,  target: 0,          color: '#8b5cf6' },
    ],

    // -----------------------------------------------------------------------
    // CLIENTS — 14 recurring clients (mix of individual + corporate)
    // -----------------------------------------------------------------------
    clients: [
      {
        id: 'cli-001', name: 'Amine Belkacem', type: 'individual', company: null,
        email: 'amine.belkacem@gmail.com', phone: '+213 661 23 45 67',
        city: 'Algiers', country: 'Algeria', status: 'vip',
        tags: ['frequent flyer', 'business class', 'Gulf routes'],
        lifetimeValue: 4_280_000, trips: 11, lastActivity: '2026-06-26',
        passport: { number: 'AG7841239', nationality: 'Algerian', expiry: '2029-04-12' },
        preferences: { seat: 'Aisle, front cabin', hotelTier: '5★', dietary: 'Halal' },
        owner: 'agt-karim',
      },
      {
        id: 'cli-002', name: 'Sonatrach Corporate Travel', type: 'corporate', company: 'Sonatrach SPA',
        email: 'travel.desk@sonatrach.dz', phone: '+213 21 54 70 00',
        city: 'Algiers', country: 'Algeria', status: 'vip',
        tags: ['corporate account', 'volume', 'NET rates'],
        lifetimeValue: 18_900_000, trips: 64, lastActivity: '2026-06-28',
        passport: { number: '—', nationality: 'Algerian', expiry: '—' },
        preferences: { seat: 'Per traveller', hotelTier: '4★–5★', dietary: 'Per traveller' },
        owner: 'agt-yasmine',
      },
      {
        id: 'cli-003', name: 'Yacine Brahimi', type: 'individual', company: null,
        email: 'y.brahimi@outlook.com', phone: '+213 770 88 12 34',
        city: 'Oran', country: 'Algeria', status: 'active',
        tags: ['family travel', 'school holidays'],
        lifetimeValue: 2_140_000, trips: 6, lastActivity: '2026-06-22',
        passport: { number: 'AG5520981', nationality: 'Algerian', expiry: '2028-09-30' },
        preferences: { seat: 'Window', hotelTier: '4★', dietary: 'No restrictions' },
        owner: 'agt-lina',
      },
      {
        id: 'cli-004', name: 'Fatima Zohra Saidi', type: 'individual', company: null,
        email: 'fz.saidi@gmail.com', phone: '+213 555 41 09 76',
        city: 'Constantine', country: 'Algeria', status: 'active',
        tags: ['Umrah', 'group leader'],
        lifetimeValue: 3_010_000, trips: 9, lastActivity: '2026-06-25',
        passport: { number: 'AG6712045', nationality: 'Algerian', expiry: '2027-12-18' },
        preferences: { seat: 'Aisle', hotelTier: '4★ near Haram', dietary: 'Halal' },
        owner: 'agt-omar',
      },
      {
        id: 'cli-005', name: 'GreenField Pharma', type: 'corporate', company: 'GreenField Pharma EURL',
        email: 'events@greenfieldpharma.dz', phone: '+213 23 80 14 22',
        city: 'Algiers', country: 'Algeria', status: 'active',
        tags: ['MICE', 'conference', 'quarterly'],
        lifetimeValue: 6_450_000, trips: 17, lastActivity: '2026-06-27',
        passport: { number: '—', nationality: 'Algerian', expiry: '—' },
        preferences: { seat: 'Per traveller', hotelTier: '5★ + meeting rooms', dietary: 'Buffet' },
        owner: 'agt-yasmine',
      },
      {
        id: 'cli-006', name: 'Leïla Mansour', type: 'individual', company: null,
        email: 'leila.mansour@icloud.com', phone: '+213 698 30 55 11',
        city: 'Algiers', country: 'Algeria', status: 'vip',
        tags: ['honeymoon', 'luxury', 'leisure'],
        lifetimeValue: 3_870_000, trips: 7, lastActivity: '2026-06-24',
        passport: { number: 'AG9003117', nationality: 'Algerian', expiry: '2030-02-05' },
        preferences: { seat: 'Window, lie-flat', hotelTier: '5★ resort', dietary: 'Pescatarian' },
        owner: 'agt-lina',
      },
      {
        id: 'cli-007', name: 'Mehdi Cherkaoui', type: 'individual', company: null,
        email: 'mehdi.cherkaoui@gmail.com', phone: '+212 661 44 23 90',
        city: 'Casablanca', country: 'Morocco', status: 'active',
        tags: ['cross-border', 'business'],
        lifetimeValue: 1_980_000, trips: 5, lastActivity: '2026-06-20',
        passport: { number: 'MA1284560', nationality: 'Moroccan', expiry: '2028-06-14' },
        preferences: { seat: 'Aisle', hotelTier: '4★ city centre', dietary: 'Halal' },
        owner: 'agt-karim',
      },
      {
        id: 'cli-008', name: 'Ines Hamidi', type: 'individual', company: null,
        email: 'ines.hamidi@gmail.com', phone: '+213 771 62 88 04',
        city: 'Annaba', country: 'Algeria', status: 'lead',
        tags: ['first enquiry', 'Europe', 'solo'],
        lifetimeValue: 0, trips: 0, lastActivity: '2026-06-28',
        passport: { number: 'AG4471902', nationality: 'Algerian', expiry: '2031-01-22' },
        preferences: { seat: 'No preference', hotelTier: '3★–4★', dietary: 'Vegetarian' },
        owner: 'agt-omar',
      },
      {
        id: 'cli-009', name: 'Khaled Bouazza', type: 'individual', company: null,
        email: 'k.bouazza@yahoo.fr', phone: '+213 660 19 77 23',
        city: 'Algiers', country: 'Algeria', status: 'active',
        tags: ['Gulf', 'shopping', 'repeat'],
        lifetimeValue: 2_560_000, trips: 8, lastActivity: '2026-06-23',
        passport: { number: 'AG7790338', nationality: 'Algerian', expiry: '2029-08-11' },
        preferences: { seat: 'Window', hotelTier: '5★ Downtown Dubai', dietary: 'Halal' },
        owner: 'agt-karim',
      },
      {
        id: 'cli-010', name: 'Atlas Engineering Group', type: 'corporate', company: 'Atlas Engineering Group SARL',
        email: 'admin@atlas-eng.dz', phone: '+213 31 92 40 18',
        city: 'Constantine', country: 'Algeria', status: 'active',
        tags: ['corporate account', 'site visits', 'Europe + Gulf'],
        lifetimeValue: 5_120_000, trips: 21, lastActivity: '2026-06-26',
        passport: { number: '—', nationality: 'Algerian', expiry: '—' },
        preferences: { seat: 'Per traveller', hotelTier: '4★', dietary: 'Per traveller' },
        owner: 'agt-yasmine',
      },
      {
        id: 'cli-011', name: 'Salma Rahmani', type: 'individual', company: null,
        email: 'salma.rahmani@gmail.com', phone: '+213 559 73 11 65',
        city: 'Algiers', country: 'Algeria', status: 'active',
        tags: ['leisure', 'family', 'beach'],
        lifetimeValue: 1_740_000, trips: 4, lastActivity: '2026-06-19',
        passport: { number: 'AG6650224', nationality: 'Algerian', expiry: '2028-03-27' },
        preferences: { seat: 'Together as family', hotelTier: '4★ all-inclusive', dietary: 'No restrictions' },
        owner: 'agt-lina',
      },
      {
        id: 'cli-012', name: 'Tarek Djebbar', type: 'individual', company: null,
        email: 'tarek.djebbar@hotmail.com', phone: '+213 668 50 32 80',
        city: 'Sétif', country: 'Algeria', status: 'lead',
        tags: ['enquiry', 'Turkey', 'medical'],
        lifetimeValue: 0, trips: 0, lastActivity: '2026-06-27',
        passport: { number: 'AG5108873', nationality: 'Algerian', expiry: '2027-07-09' },
        preferences: { seat: 'Aisle', hotelTier: '4★ near clinic', dietary: 'Halal' },
        owner: 'agt-omar',
      },
      {
        id: 'cli-013', name: 'Nour El Houda Benamar', type: 'individual', company: null,
        email: 'nour.benamar@gmail.com', phone: '+213 770 04 19 58',
        city: 'Algiers', country: 'Algeria', status: 'vip',
        tags: ['luxury', 'Maldives', 'anniversary'],
        lifetimeValue: 4_690_000, trips: 6, lastActivity: '2026-06-21',
        passport: { number: 'AG8820471', nationality: 'Algerian', expiry: '2030-11-03' },
        preferences: { seat: 'Business, lie-flat', hotelTier: '5★ overwater villa', dietary: 'Halal' },
        owner: 'agt-lina',
      },
      {
        id: 'cli-014', name: 'Riad Benchaa', type: 'individual', company: null,
        email: 'riad.benchaa@gmail.com', phone: '+213 661 77 90 14',
        city: 'Algiers', country: 'Algeria', status: 'active',
        tags: ['football', 'events', 'Europe'],
        lifetimeValue: 2_220_000, trips: 7, lastActivity: '2026-06-18',
        passport: { number: 'AG7340996', nationality: 'Algerian', expiry: '2029-05-19' },
        preferences: { seat: 'Aisle', hotelTier: '4★ near stadium', dietary: 'No restrictions' },
        owner: 'agt-karim',
      },
    ],

    // -----------------------------------------------------------------------
    // OPPORTUNITIES — 10 deals across the pipeline stages
    // stages: lead | qualified | proposal | negotiation | won
    // -----------------------------------------------------------------------
    opportunities: [
      { id: 'opp-001', title: 'Dubai shopping break — 4 pax', clientId: 'cli-009', client: 'Khaled Bouazza',
        value: 1_240_000, stage: 'won',         ownerId: 'agt-karim',   destination: 'Dubai',     closeDate: '2026-06-20', probability: 100 },
      { id: 'opp-002', title: 'Sonatrach Q3 site rotations',  clientId: 'cli-002', client: 'Sonatrach Corporate Travel',
        value: 14_600_000, stage: 'negotiation', ownerId: 'agt-yasmine', destination: 'Multi',     closeDate: '2026-07-10', probability: 70 },
      { id: 'opp-003', title: 'Maldives anniversary villa',   clientId: 'cli-013', client: 'Nour El Houda Benamar',
        value: 2_960_000, stage: 'proposal',     ownerId: 'agt-lina',    destination: 'Maldives',  closeDate: '2026-07-04', probability: 60 },
      { id: 'opp-004', title: 'GreenField sales conference',  clientId: 'cli-005', client: 'GreenField Pharma',
        value: 4_180_000, stage: 'proposal',     ownerId: 'agt-yasmine', destination: 'Istanbul',  closeDate: '2026-07-15', probability: 55 },
      { id: 'opp-005', title: 'Umrah group — 18 pilgrims',    clientId: 'cli-004', client: 'Fatima Zohra Saidi',
        value: 3_240_000, stage: 'qualified',    ownerId: 'agt-omar',    destination: 'Jeddah',    closeDate: '2026-07-22', probability: 45 },
      { id: 'opp-006', title: 'Honeymoon — Bali & Maldives',  clientId: 'cli-006', client: 'Leïla Mansour',
        value: 2_480_000, stage: 'negotiation', ownerId: 'agt-lina',    destination: 'Maldives',  closeDate: '2026-07-08', probability: 75 },
      { id: 'opp-007', title: 'Europe enquiry — Rome & Paris',clientId: 'cli-008', client: 'Ines Hamidi',
        value: 720_000,   stage: 'lead',         ownerId: 'agt-omar',    destination: 'Rome',      closeDate: '2026-07-30', probability: 20 },
      { id: 'opp-008', title: 'Istanbul medical + recovery',  clientId: 'cli-012', client: 'Tarek Djebbar',
        value: 980_000,   stage: 'lead',         ownerId: 'agt-omar',    destination: 'Istanbul',  closeDate: '2026-08-02', probability: 25 },
      { id: 'opp-009', title: 'Atlas Eng. — Barcelona expo',  clientId: 'cli-010', client: 'Atlas Engineering Group',
        value: 2_640_000, stage: 'qualified',    ownerId: 'agt-yasmine', destination: 'Barcelona', closeDate: '2026-07-18', probability: 50 },
      { id: 'opp-010', title: 'Champions League — London',    clientId: 'cli-014', client: 'Riad Benchaa',
        value: 1_080_000, stage: 'proposal',     ownerId: 'agt-karim',   destination: 'London',    closeDate: '2026-07-12', probability: 55 },
    ],

    // -----------------------------------------------------------------------
    // BOOKINGS — 10 detailed bookings
    // status: draft | awaiting_payment | confirmed | ticketed | completed
    // -----------------------------------------------------------------------
    bookings: [
      {
        reference: 'BKG-2026-001', clientId: 'cli-001', client: 'Amine Belkacem', ownerId: 'agt-karim',
        destination: 'Dubai', startDate: '2026-07-05', endDate: '2026-07-10', status: 'ticketed',
        total: 486_000, paid: 486_000, outstanding: 0, currency: 'DZD',
        travellers: ['Amine Belkacem'],
        flights: [{ airline: 'Emirates', route: 'ALG → DXB', dep: '2026-07-05', arr: '2026-07-05', pnr: 'EK7QMZ', cabin: 'Business' },
                  { airline: 'Emirates', route: 'DXB → ALG', dep: '2026-07-10', arr: '2026-07-10', pnr: 'EK7QMZ', cabin: 'Business' }],
        hotel: { name: 'Address Downtown', stars: 5, nights: 5, city: 'Dubai' },
        supplierRefs: { flight: 'DUF-9921', hotel: 'HB-DXB-44120' }, supplier: 'sup-emirates',
      },
      {
        reference: 'BKG-2026-002', clientId: 'cli-009', client: 'Khaled Bouazza', ownerId: 'agt-karim',
        destination: 'Dubai', startDate: '2026-07-14', endDate: '2026-07-19', status: 'confirmed',
        total: 1_240_000, paid: 620_000, outstanding: 620_000, currency: 'DZD',
        travellers: ['Khaled Bouazza', 'Amel Bouazza', 'Yanis Bouazza', 'Lyna Bouazza'],
        flights: [{ airline: 'Emirates', route: 'ALG → DXB', dep: '2026-07-14', arr: '2026-07-14', pnr: 'EK3TLP', cabin: 'Economy' },
                  { airline: 'Emirates', route: 'DXB → ALG', dep: '2026-07-19', arr: '2026-07-19', pnr: 'EK3TLP', cabin: 'Economy' }],
        hotel: { name: 'Rove Downtown', stars: 4, nights: 5, city: 'Dubai' },
        supplierRefs: { flight: 'DUF-9988', hotel: 'HB-DXB-44990' }, supplier: 'sup-emirates',
      },
      {
        reference: 'BKG-2026-003', clientId: 'cli-006', client: 'Leïla Mansour', ownerId: 'agt-lina',
        destination: 'Maldives', startDate: '2026-08-02', endDate: '2026-08-09', status: 'confirmed',
        total: 2_480_000, paid: 1_240_000, outstanding: 1_240_000, currency: 'DZD',
        travellers: ['Leïla Mansour', 'Sami Mansour'],
        flights: [{ airline: 'Qatar Airways', route: 'ALG → DOH → MLE', dep: '2026-08-02', arr: '2026-08-03', pnr: 'QR5WXY', cabin: 'Business' },
                  { airline: 'Qatar Airways', route: 'MLE → DOH → ALG', dep: '2026-08-09', arr: '2026-08-09', pnr: 'QR5WXY', cabin: 'Business' }],
        hotel: { name: 'Conrad Maldives Rangali', stars: 5, nights: 7, city: 'Rangali Island' },
        supplierRefs: { flight: 'DUF-10231', hotel: 'HB-MLE-7781' }, supplier: 'sup-qatar',
      },
      {
        reference: 'BKG-2026-004', clientId: 'cli-004', client: 'Fatima Zohra Saidi', ownerId: 'agt-omar',
        destination: 'Jeddah', startDate: '2026-07-26', endDate: '2026-08-04', status: 'awaiting_payment',
        total: 3_240_000, paid: 810_000, outstanding: 2_430_000, currency: 'DZD',
        travellers: ['Fatima Zohra Saidi', '+ 17 pilgrims (group)'],
        flights: [{ airline: 'Saudia', route: 'CZL → JED', dep: '2026-07-26', arr: '2026-07-26', pnr: 'SV2KMN', cabin: 'Economy' },
                  { airline: 'Saudia', route: 'JED → CZL', dep: '2026-08-04', arr: '2026-08-04', pnr: 'SV2KMN', cabin: 'Economy' }],
        hotel: { name: 'Makkah Clock Royal Tower', stars: 5, nights: 9, city: 'Makkah' },
        supplierRefs: { flight: 'DUF-10044', hotel: 'HB-MAK-3320' }, supplier: 'sup-dmc-haramain',
      },
      {
        reference: 'BKG-2026-005', clientId: 'cli-002', client: 'Sonatrach Corporate Travel', ownerId: 'agt-yasmine',
        destination: 'Paris', startDate: '2026-07-08', endDate: '2026-07-11', status: 'ticketed',
        total: 2_180_000, paid: 2_180_000, outstanding: 0, currency: 'DZD',
        travellers: ['M. Belaid', 'A. Khelifi', 'R. Ferhat'],
        flights: [{ airline: 'Air Algérie', route: 'ALG → CDG', dep: '2026-07-08', arr: '2026-07-08', pnr: 'AH9PLM', cabin: 'Business' },
                  { airline: 'Air Algérie', route: 'CDG → ALG', dep: '2026-07-11', arr: '2026-07-11', pnr: 'AH9PLM', cabin: 'Business' }],
        hotel: { name: 'Pullman Paris Tour Eiffel', stars: 4, nights: 3, city: 'Paris' },
        supplierRefs: { flight: 'DUF-9870', hotel: 'HB-PAR-2240' }, supplier: 'sup-airalgerie',
      },
      {
        reference: 'BKG-2026-006', clientId: 'cli-013', client: 'Nour El Houda Benamar', ownerId: 'agt-lina',
        destination: 'Maldives', startDate: '2026-09-12', endDate: '2026-09-19', status: 'draft',
        total: 2_960_000, paid: 0, outstanding: 2_960_000, currency: 'DZD',
        travellers: ['Nour El Houda Benamar', 'Adel Benamar'],
        flights: [{ airline: 'Emirates', route: 'ALG → DXB → MLE', dep: '2026-09-12', arr: '2026-09-13', pnr: '—', cabin: 'Business' }],
        hotel: { name: 'Soneva Jani', stars: 5, nights: 7, city: 'Noonu Atoll' },
        supplierRefs: { flight: '—', hotel: 'HB-MLE-8890' }, supplier: 'sup-emirates',
      },
      {
        reference: 'BKG-2026-007', clientId: 'cli-003', client: 'Yacine Brahimi', ownerId: 'agt-lina',
        destination: 'Antalya', startDate: '2026-07-20', endDate: '2026-07-27', status: 'confirmed',
        total: 980_000, paid: 980_000, outstanding: 0, currency: 'DZD',
        travellers: ['Yacine Brahimi', 'Sara Brahimi', 'Rayan Brahimi', 'Maya Brahimi'],
        flights: [{ airline: 'Turkish Airlines', route: 'ORN → IST → AYT', dep: '2026-07-20', arr: '2026-07-20', pnr: 'TK8RVN', cabin: 'Economy' },
                  { airline: 'Turkish Airlines', route: 'AYT → IST → ORN', dep: '2026-07-27', arr: '2026-07-27', pnr: 'TK8RVN', cabin: 'Economy' }],
        hotel: { name: 'Rixos Premium Belek', stars: 5, nights: 7, city: 'Antalya' },
        supplierRefs: { flight: 'DUF-10110', hotel: 'HB-AYT-5512' }, supplier: 'sup-rixos',
      },
      {
        reference: 'BKG-2026-008', clientId: 'cli-014', client: 'Riad Benchaa', ownerId: 'agt-karim',
        destination: 'London', startDate: '2026-09-26', endDate: '2026-09-29', status: 'awaiting_payment',
        total: 1_080_000, paid: 360_000, outstanding: 720_000, currency: 'DZD',
        travellers: ['Riad Benchaa', 'Sofiane Benchaa'],
        flights: [{ airline: 'Air Algérie', route: 'ALG → LHR', dep: '2026-09-26', arr: '2026-09-26', pnr: 'AH4KTZ', cabin: 'Economy' },
                  { airline: 'Air Algérie', route: 'LHR → ALG', dep: '2026-09-29', arr: '2026-09-29', pnr: 'AH4KTZ', cabin: 'Economy' }],
        hotel: { name: 'Hilton London Wembley', stars: 4, nights: 3, city: 'London' },
        supplierRefs: { flight: 'DUF-10302', hotel: 'HB-LON-9930' }, supplier: 'sup-airalgerie',
      },
      {
        reference: 'BKG-2026-009', clientId: 'cli-007', client: 'Mehdi Cherkaoui', ownerId: 'agt-karim',
        destination: 'Istanbul', startDate: '2026-06-30', endDate: '2026-07-03', status: 'completed',
        total: 640_000, paid: 640_000, outstanding: 0, currency: 'DZD',
        travellers: ['Mehdi Cherkaoui'],
        flights: [{ airline: 'Turkish Airlines', route: 'CMN → IST', dep: '2026-06-30', arr: '2026-06-30', pnr: 'TK1ZQP', cabin: 'Economy' },
                  { airline: 'Turkish Airlines', route: 'IST → CMN', dep: '2026-07-03', arr: '2026-07-03', pnr: 'TK1ZQP', cabin: 'Economy' }],
        hotel: { name: 'Swissôtel The Bosphorus', stars: 5, nights: 3, city: 'Istanbul' },
        supplierRefs: { flight: 'DUF-9755', hotel: 'HB-IST-1180' }, supplier: 'sup-turkish',
      },
      {
        reference: 'BKG-2026-010', clientId: 'cli-005', client: 'GreenField Pharma', ownerId: 'agt-yasmine',
        destination: 'Istanbul', startDate: '2026-08-18', endDate: '2026-08-21', status: 'confirmed',
        total: 4_180_000, paid: 2_090_000, outstanding: 2_090_000, currency: 'DZD',
        travellers: ['+ 26 delegates (group)'],
        flights: [{ airline: 'Turkish Airlines', route: 'ALG → IST', dep: '2026-08-18', arr: '2026-08-18', pnr: 'TK6HBN', cabin: 'Economy' },
                  { airline: 'Turkish Airlines', route: 'IST → ALG', dep: '2026-08-21', arr: '2026-08-21', pnr: 'TK6HBN', cabin: 'Economy' }],
        hotel: { name: 'Hilton Istanbul Bomonti', stars: 5, nights: 3, city: 'Istanbul' },
        supplierRefs: { flight: 'DUF-10455', hotel: 'HB-IST-6604' }, supplier: 'sup-turkish',
      },
    ],

    // -----------------------------------------------------------------------
    // PROPOSALS — 6 quotations
    // status: draft | sent | viewed | accepted | expired
    // -----------------------------------------------------------------------
    proposals: [
      { id: 'PRD-2041', clientId: 'cli-013', client: 'Nour El Houda Benamar', destination: 'Maldives',
        value: 2_960_000, status: 'sent', validUntil: '2026-07-04',
        items: ['Return Business flights ALG–MLE', '7 nights overwater villa', 'Seaplane transfers', 'Half board'] },
      { id: 'PRD-2042', clientId: 'cli-005', client: 'GreenField Pharma', destination: 'Istanbul',
        value: 4_180_000, status: 'viewed', validUntil: '2026-07-15',
        items: ['26 return flights ALG–IST', '3 nights 5★ + meeting rooms', 'Airport transfers', 'Gala dinner'] },
      { id: 'PRD-2043', clientId: 'cli-010', client: 'Atlas Engineering Group', destination: 'Barcelona',
        value: 2_640_000, status: 'draft', validUntil: '2026-07-18',
        items: ['Return flights ALG–BCN', '4 nights 4★ city centre', 'Expo passes', 'Ground transport'] },
      { id: 'PRD-2044', clientId: 'cli-006', client: 'Leïla Mansour', destination: 'Maldives',
        value: 2_480_000, status: 'accepted', validUntil: '2026-07-08',
        items: ['Return Business flights', '7 nights 5★ resort', 'Honeymoon package', 'Spa credit'] },
      { id: 'PRD-2045', clientId: 'cli-014', client: 'Riad Benchaa', destination: 'London',
        value: 1_080_000, status: 'viewed', validUntil: '2026-07-12',
        items: ['Return flights ALG–LHR', '3 nights 4★ near Wembley', 'Match tickets ×2', 'Stadium transfer'] },
      { id: 'PRD-2046', clientId: 'cli-008', client: 'Ines Hamidi', destination: 'Rome',
        value: 720_000, status: 'draft', validUntil: '2026-07-30',
        items: ['Return flights ALG–FCO', '4 nights 3★ central', 'City pass', 'Airport transfer'] },
    ],

    // -----------------------------------------------------------------------
    // SUPPLIERS — 10
    // type: airline | bedbank | dmc | insurance
    // -----------------------------------------------------------------------
    suppliers: [
      { id: 'sup-airalgerie', name: 'Air Algérie',     type: 'airline',   contract: 'IATA BSP', commission: 7.0,  rating: 4.2, channel: 'Duffel' },
      { id: 'sup-emirates',   name: 'Emirates',        type: 'airline',   contract: 'NDC direct', commission: 6.0,  rating: 4.8, channel: 'Duffel' },
      { id: 'sup-turkish',    name: 'Turkish Airlines',type: 'airline',   contract: 'NDC direct', commission: 6.5,  rating: 4.6, channel: 'Duffel' },
      { id: 'sup-qatar',      name: 'Qatar Airways',   type: 'airline',   contract: 'NDC direct', commission: 6.0,  rating: 4.7, channel: 'Duffel' },
      { id: 'sup-hotelbeds',  name: 'Hotelbeds',       type: 'bedbank',   contract: 'Global API', commission: 12.0, rating: 4.5, channel: 'Hotelbeds' },
      { id: 'sup-jaz',        name: 'Jaz Hotels',      type: 'bedbank',   contract: 'Allotment',  commission: 14.0, rating: 4.3, channel: 'Hotelbeds' },
      { id: 'sup-rixos',      name: 'Rixos Hotels',    type: 'bedbank',   contract: 'Allotment',  commission: 13.0, rating: 4.6, channel: 'Hotelbeds' },
      { id: 'sup-dmc-haramain', name: 'Haramain DMC',  type: 'dmc',       contract: 'Umrah packages', commission: 10.0, rating: 4.4, channel: 'Direct' },
      { id: 'sup-dmc-bosphorus', name: 'Bosphorus DMC',type: 'dmc',       contract: 'Turkey land', commission: 11.0, rating: 4.5, channel: 'Direct' },
      { id: 'sup-allianz',    name: 'Allianz Travel',  type: 'insurance', contract: 'Per-policy',  commission: 20.0, rating: 4.4, channel: 'Direct' },
    ],

    // -----------------------------------------------------------------------
    // DESTINATIONS — top 8 by revenue (for charts)
    // share = % of total revenue
    // -----------------------------------------------------------------------
    destinations: [
      { name: 'Dubai',     bookings: 41, revenue: 11_200_000, share: 22.4, country: 'UAE' },
      { name: 'Istanbul',  bookings: 34, revenue: 8_900_000,  share: 17.8, country: 'Turkey' },
      { name: 'Paris',     bookings: 26, revenue: 6_300_000,  share: 12.6, country: 'France' },
      { name: 'Jeddah',    bookings: 22, revenue: 5_400_000,  share: 10.8, country: 'Saudi Arabia' },
      { name: 'Maldives',  bookings: 11, revenue: 4_800_000,  share: 9.6,  country: 'Maldives' },
      { name: 'Antalya',   bookings: 19, revenue: 3_600_000,  share: 7.2,  country: 'Turkey' },
      { name: 'Barcelona', bookings: 15, revenue: 2_900_000,  share: 5.8,  country: 'Spain' },
      { name: 'London',    bookings: 12, revenue: 2_500_000,  share: 5.0,  country: 'United Kingdom' },
    ],

    // -----------------------------------------------------------------------
    // TIME SERIES — 12 months (Jul 2025 → Jun 2026)
    // -----------------------------------------------------------------------
    revenueSeries: [
      { month: '2025-07', revenue: 28_400_000 },
      { month: '2025-08', revenue: 33_900_000 },
      { month: '2025-09', revenue: 26_700_000 },
      { month: '2025-10', revenue: 29_500_000 },
      { month: '2025-11', revenue: 24_800_000 },
      { month: '2025-12', revenue: 35_600_000 },
      { month: '2026-01', revenue: 27_200_000 },
      { month: '2026-02', revenue: 30_100_000 },
      { month: '2026-03', revenue: 32_800_000 },
      { month: '2026-04', revenue: 36_400_000 },
      { month: '2026-05', revenue: 38_100_000 },
      { month: '2026-06', revenue: 42_800_000 },
    ],
    bookingsSeries: [
      { month: '2025-07', bookings: 118 },
      { month: '2025-08', bookings: 139 },
      { month: '2025-09', bookings: 111 },
      { month: '2025-10', bookings: 124 },
      { month: '2025-11', bookings: 103 },
      { month: '2025-12', bookings: 151 },
      { month: '2026-01', bookings: 116 },
      { month: '2026-02', bookings: 128 },
      { month: '2026-03', bookings: 137 },
      { month: '2026-04', bookings: 149 },
      { month: '2026-05', bookings: 156 },
      { month: '2026-06', bookings: 168 },
    ],

    // -----------------------------------------------------------------------
    // ACTIVITY FEED — 8 recent items
    // -----------------------------------------------------------------------
    activity: [
      { id: 'act-1', type: 'booking',  agentId: 'agt-karim',   text: 'Karim Benali ticketed BKG-2026-001 — Dubai, Amine Belkacem', time: '2026-06-29T09:12:00' },
      { id: 'act-2', type: 'proposal', agentId: 'agt-lina',    text: 'Leïla Mansour accepted proposal PRD-2044 — Maldives honeymoon', time: '2026-06-28T17:40:00' },
      { id: 'act-3', type: 'payment',  agentId: 'agt-nadia',   text: 'Payment received: 1,240,000 DZD on BKG-2026-003', time: '2026-06-28T15:05:00' },
      { id: 'act-4', type: 'lead',     agentId: 'agt-omar',    text: 'New lead: Ines Hamidi — Europe enquiry (Rome & Paris)', time: '2026-06-28T11:22:00' },
      { id: 'act-5', type: 'proposal', agentId: 'agt-yasmine', text: 'GreenField Pharma viewed proposal PRD-2042 — Istanbul conference', time: '2026-06-27T18:03:00' },
      { id: 'act-6', type: 'booking',  agentId: 'agt-omar',    text: 'Omar Said created BKG-2026-004 — Umrah group, 18 pilgrims', time: '2026-06-27T10:48:00' },
      { id: 'act-7', type: 'support',  agentId: 'agt-sofiane', text: 'Sofiane Mansouri resolved a re-issue request on BKG-2026-007', time: '2026-06-26T14:30:00' },
      { id: 'act-8', type: 'booking',  agentId: 'agt-karim',   text: 'Mehdi Cherkaoui trip completed — BKG-2026-009, Istanbul', time: '2026-06-26T09:00:00' },
    ],

    // -----------------------------------------------------------------------
    // NOTIFICATIONS — 5
    // -----------------------------------------------------------------------
    notifications: [
      { id: 'ntf-1', kind: 'warning', text: 'BKG-2026-004 awaiting payment — 2,430,000 DZD outstanding, departs in 27 days', time: '2026-06-29T08:30:00', read: false },
      { id: 'ntf-2', kind: 'info',    text: 'Proposal PRD-2041 expires in 5 days (Nour El Houda Benamar — Maldives)', time: '2026-06-29T08:00:00', read: false },
      { id: 'ntf-3', kind: 'success', text: 'Payment of 1,240,000 DZD reconciled on BKG-2026-003', time: '2026-06-28T15:06:00', read: true },
      { id: 'ntf-4', kind: 'warning', text: 'Passport for Tarek Djebbar expires 2027-07-09 — verify before Istanbul trip', time: '2026-06-28T10:15:00', read: false },
      { id: 'ntf-5', kind: 'info',    text: 'Monthly revenue is up 12.4% vs. last month', time: '2026-06-28T07:45:00', read: true },
    ],

    // -----------------------------------------------------------------------
    // TASKS — 6 follow-ups
    // priority: high | medium | low
    // -----------------------------------------------------------------------
    tasks: [
      { id: 'tsk-1', title: 'Collect balance on Maldives honeymoon (BKG-2026-003)', clientId: 'cli-006', ownerId: 'agt-lina',    due: '2026-07-01', priority: 'high',   done: false },
      { id: 'tsk-2', title: 'Send Umrah rooming list to Haramain DMC (BKG-2026-004)', clientId: 'cli-004', ownerId: 'agt-omar',    due: '2026-07-02', priority: 'high',   done: false },
      { id: 'tsk-3', title: 'Follow up GreenField on Istanbul conference proposal',   clientId: 'cli-005', ownerId: 'agt-yasmine', due: '2026-07-03', priority: 'medium', done: false },
      { id: 'tsk-4', title: 'Call Ines Hamidi to qualify Europe enquiry',             clientId: 'cli-008', ownerId: 'agt-omar',    due: '2026-06-30', priority: 'medium', done: false },
      { id: 'tsk-5', title: 'Confirm match tickets for Riad Benchaa — London',        clientId: 'cli-014', ownerId: 'agt-karim',   due: '2026-07-05', priority: 'medium', done: false },
      { id: 'tsk-6', title: 'Re-verify passport expiry — Tarek Djebbar',              clientId: 'cli-012', ownerId: 'agt-omar',    due: '2026-07-04', priority: 'low',    done: false },
    ],

    // -----------------------------------------------------------------------
    // UPCOMING DEPARTURES — 5 trips departing soon
    // -----------------------------------------------------------------------
    upcomingDepartures: [
      { reference: 'BKG-2026-009', client: 'Mehdi Cherkaoui',  destination: 'Istanbul', date: '2026-06-30', status: 'completed' },
      { reference: 'BKG-2026-001', client: 'Amine Belkacem',   destination: 'Dubai',    date: '2026-07-05', status: 'ticketed' },
      { reference: 'BKG-2026-005', client: 'Sonatrach (3 pax)',destination: 'Paris',    date: '2026-07-08', status: 'ticketed' },
      { reference: 'BKG-2026-002', client: 'Khaled Bouazza',   destination: 'Dubai',    date: '2026-07-14', status: 'confirmed' },
      { reference: 'BKG-2026-007', client: 'Yacine Brahimi',   destination: 'Antalya',  date: '2026-07-20', status: 'confirmed' },
    ],
  };

  // Expose globally for plain <script> usage and module-ish reads.
  ATLAS.fmt = fmt;
  if (typeof window !== 'undefined') window.ATLAS = ATLAS;
  if (typeof globalThis !== 'undefined') globalThis.ATLAS = ATLAS;
  if (typeof module !== 'undefined' && module.exports) module.exports = ATLAS;
})();
