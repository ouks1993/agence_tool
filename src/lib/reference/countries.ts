/**
 * ISO 3166-1 country reference data — the single source of truth for the
 * country and nationality pickers.
 *
 * Per the Phase 3 decision we store the **full country name** (e.g. "Algeria")
 * and the **nationality demonym** (e.g. "Algerian") as the canonical values, but
 * users always pick them from this list so spellings never drift
 * ("USA" / "U.S." / "United States" can't coexist). The alpha-2 `code` is kept
 * for stable lookups, sorting and deriving the flag emoji.
 */

/** [alpha-2 code, country name, nationality demonym] */
const RAW: [string, string, string][] = [
  ["AF", "Afghanistan", "Afghan"],
  ["AL", "Albania", "Albanian"],
  ["DZ", "Algeria", "Algerian"],
  ["AD", "Andorra", "Andorran"],
  ["AO", "Angola", "Angolan"],
  ["AG", "Antigua and Barbuda", "Antiguan"],
  ["AR", "Argentina", "Argentine"],
  ["AM", "Armenia", "Armenian"],
  ["AU", "Australia", "Australian"],
  ["AT", "Austria", "Austrian"],
  ["AZ", "Azerbaijan", "Azerbaijani"],
  ["BS", "Bahamas", "Bahamian"],
  ["BH", "Bahrain", "Bahraini"],
  ["BD", "Bangladesh", "Bangladeshi"],
  ["BB", "Barbados", "Barbadian"],
  ["BY", "Belarus", "Belarusian"],
  ["BE", "Belgium", "Belgian"],
  ["BZ", "Belize", "Belizean"],
  ["BJ", "Benin", "Beninese"],
  ["BT", "Bhutan", "Bhutanese"],
  ["BO", "Bolivia", "Bolivian"],
  ["BA", "Bosnia and Herzegovina", "Bosnian"],
  ["BW", "Botswana", "Motswana"],
  ["BR", "Brazil", "Brazilian"],
  ["BN", "Brunei", "Bruneian"],
  ["BG", "Bulgaria", "Bulgarian"],
  ["BF", "Burkina Faso", "Burkinabè"],
  ["BI", "Burundi", "Burundian"],
  ["KH", "Cambodia", "Cambodian"],
  ["CM", "Cameroon", "Cameroonian"],
  ["CA", "Canada", "Canadian"],
  ["CV", "Cape Verde", "Cape Verdean"],
  ["CF", "Central African Republic", "Central African"],
  ["TD", "Chad", "Chadian"],
  ["CL", "Chile", "Chilean"],
  ["CN", "China", "Chinese"],
  ["CO", "Colombia", "Colombian"],
  ["KM", "Comoros", "Comoran"],
  ["CG", "Congo", "Congolese"],
  ["CD", "Congo (DRC)", "Congolese"],
  ["CR", "Costa Rica", "Costa Rican"],
  ["CI", "Côte d'Ivoire", "Ivorian"],
  ["HR", "Croatia", "Croatian"],
  ["CU", "Cuba", "Cuban"],
  ["CY", "Cyprus", "Cypriot"],
  ["CZ", "Czechia", "Czech"],
  ["DK", "Denmark", "Danish"],
  ["DJ", "Djibouti", "Djiboutian"],
  ["DM", "Dominica", "Dominican"],
  ["DO", "Dominican Republic", "Dominican"],
  ["EC", "Ecuador", "Ecuadorian"],
  ["EG", "Egypt", "Egyptian"],
  ["SV", "El Salvador", "Salvadoran"],
  ["GQ", "Equatorial Guinea", "Equatorial Guinean"],
  ["ER", "Eritrea", "Eritrean"],
  ["EE", "Estonia", "Estonian"],
  ["SZ", "Eswatini", "Swazi"],
  ["ET", "Ethiopia", "Ethiopian"],
  ["FJ", "Fiji", "Fijian"],
  ["FI", "Finland", "Finnish"],
  ["FR", "France", "French"],
  ["GA", "Gabon", "Gabonese"],
  ["GM", "Gambia", "Gambian"],
  ["GE", "Georgia", "Georgian"],
  ["DE", "Germany", "German"],
  ["GH", "Ghana", "Ghanaian"],
  ["GR", "Greece", "Greek"],
  ["GD", "Grenada", "Grenadian"],
  ["GT", "Guatemala", "Guatemalan"],
  ["GN", "Guinea", "Guinean"],
  ["GW", "Guinea-Bissau", "Bissau-Guinean"],
  ["GY", "Guyana", "Guyanese"],
  ["HT", "Haiti", "Haitian"],
  ["HN", "Honduras", "Honduran"],
  ["HK", "Hong Kong", "Hong Konger"],
  ["HU", "Hungary", "Hungarian"],
  ["IS", "Iceland", "Icelandic"],
  ["IN", "India", "Indian"],
  ["ID", "Indonesia", "Indonesian"],
  ["IR", "Iran", "Iranian"],
  ["IQ", "Iraq", "Iraqi"],
  ["IE", "Ireland", "Irish"],
  ["IL", "Israel", "Israeli"],
  ["IT", "Italy", "Italian"],
  ["JM", "Jamaica", "Jamaican"],
  ["JP", "Japan", "Japanese"],
  ["JO", "Jordan", "Jordanian"],
  ["KZ", "Kazakhstan", "Kazakhstani"],
  ["KE", "Kenya", "Kenyan"],
  ["KI", "Kiribati", "I-Kiribati"],
  ["KW", "Kuwait", "Kuwaiti"],
  ["KG", "Kyrgyzstan", "Kyrgyz"],
  ["LA", "Laos", "Laotian"],
  ["LV", "Latvia", "Latvian"],
  ["LB", "Lebanon", "Lebanese"],
  ["LS", "Lesotho", "Mosotho"],
  ["LR", "Liberia", "Liberian"],
  ["LY", "Libya", "Libyan"],
  ["LI", "Liechtenstein", "Liechtensteiner"],
  ["LT", "Lithuania", "Lithuanian"],
  ["LU", "Luxembourg", "Luxembourgish"],
  ["MO", "Macau", "Macanese"],
  ["MG", "Madagascar", "Malagasy"],
  ["MW", "Malawi", "Malawian"],
  ["MY", "Malaysia", "Malaysian"],
  ["MV", "Maldives", "Maldivian"],
  ["ML", "Mali", "Malian"],
  ["MT", "Malta", "Maltese"],
  ["MH", "Marshall Islands", "Marshallese"],
  ["MR", "Mauritania", "Mauritanian"],
  ["MU", "Mauritius", "Mauritian"],
  ["MX", "Mexico", "Mexican"],
  ["FM", "Micronesia", "Micronesian"],
  ["MD", "Moldova", "Moldovan"],
  ["MC", "Monaco", "Monégasque"],
  ["MN", "Mongolia", "Mongolian"],
  ["ME", "Montenegro", "Montenegrin"],
  ["MA", "Morocco", "Moroccan"],
  ["MZ", "Mozambique", "Mozambican"],
  ["MM", "Myanmar", "Burmese"],
  ["NA", "Namibia", "Namibian"],
  ["NR", "Nauru", "Nauruan"],
  ["NP", "Nepal", "Nepali"],
  ["NL", "Netherlands", "Dutch"],
  ["NZ", "New Zealand", "New Zealander"],
  ["NI", "Nicaragua", "Nicaraguan"],
  ["NE", "Niger", "Nigerien"],
  ["NG", "Nigeria", "Nigerian"],
  ["KP", "North Korea", "North Korean"],
  ["MK", "North Macedonia", "Macedonian"],
  ["NO", "Norway", "Norwegian"],
  ["OM", "Oman", "Omani"],
  ["PK", "Pakistan", "Pakistani"],
  ["PW", "Palau", "Palauan"],
  ["PS", "Palestine", "Palestinian"],
  ["PA", "Panama", "Panamanian"],
  ["PG", "Papua New Guinea", "Papua New Guinean"],
  ["PY", "Paraguay", "Paraguayan"],
  ["PE", "Peru", "Peruvian"],
  ["PH", "Philippines", "Filipino"],
  ["PL", "Poland", "Polish"],
  ["PT", "Portugal", "Portuguese"],
  ["QA", "Qatar", "Qatari"],
  ["RO", "Romania", "Romanian"],
  ["RU", "Russia", "Russian"],
  ["RW", "Rwanda", "Rwandan"],
  ["KN", "Saint Kitts and Nevis", "Kittitian"],
  ["LC", "Saint Lucia", "Saint Lucian"],
  ["VC", "Saint Vincent and the Grenadines", "Vincentian"],
  ["WS", "Samoa", "Samoan"],
  ["SM", "San Marino", "Sammarinese"],
  ["ST", "São Tomé and Príncipe", "São Toméan"],
  ["SA", "Saudi Arabia", "Saudi"],
  ["SN", "Senegal", "Senegalese"],
  ["RS", "Serbia", "Serbian"],
  ["SC", "Seychelles", "Seychellois"],
  ["SL", "Sierra Leone", "Sierra Leonean"],
  ["SG", "Singapore", "Singaporean"],
  ["SK", "Slovakia", "Slovak"],
  ["SI", "Slovenia", "Slovenian"],
  ["SB", "Solomon Islands", "Solomon Islander"],
  ["SO", "Somalia", "Somali"],
  ["ZA", "South Africa", "South African"],
  ["KR", "South Korea", "South Korean"],
  ["SS", "South Sudan", "South Sudanese"],
  ["ES", "Spain", "Spanish"],
  ["LK", "Sri Lanka", "Sri Lankan"],
  ["SD", "Sudan", "Sudanese"],
  ["SR", "Suriname", "Surinamese"],
  ["SE", "Sweden", "Swedish"],
  ["CH", "Switzerland", "Swiss"],
  ["SY", "Syria", "Syrian"],
  ["TW", "Taiwan", "Taiwanese"],
  ["TJ", "Tajikistan", "Tajik"],
  ["TZ", "Tanzania", "Tanzanian"],
  ["TH", "Thailand", "Thai"],
  ["TL", "Timor-Leste", "Timorese"],
  ["TG", "Togo", "Togolese"],
  ["TO", "Tonga", "Tongan"],
  ["TT", "Trinidad and Tobago", "Trinidadian"],
  ["TN", "Tunisia", "Tunisian"],
  ["TR", "Türkiye", "Turkish"],
  ["TM", "Turkmenistan", "Turkmen"],
  ["TV", "Tuvalu", "Tuvaluan"],
  ["UG", "Uganda", "Ugandan"],
  ["UA", "Ukraine", "Ukrainian"],
  ["AE", "United Arab Emirates", "Emirati"],
  ["GB", "United Kingdom", "British"],
  ["US", "United States", "American"],
  ["UY", "Uruguay", "Uruguayan"],
  ["UZ", "Uzbekistan", "Uzbek"],
  ["VU", "Vanuatu", "Ni-Vanuatu"],
  ["VA", "Vatican City", "Vatican"],
  ["VE", "Venezuela", "Venezuelan"],
  ["VN", "Vietnam", "Vietnamese"],
  ["YE", "Yemen", "Yemeni"],
  ["ZM", "Zambia", "Zambian"],
  ["ZW", "Zimbabwe", "Zimbabwean"],
];

export type Country = {
  code: string;
  name: string;
  nationality: string;
  flag: string;
};

/** Derives the flag emoji from an alpha-2 code via regional-indicator letters. */
function flagOf(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export const COUNTRIES: Country[] = RAW.map(([code, name, nationality]) => ({
  code,
  name,
  nationality,
  flag: flagOf(code),
})).sort((a, b) => a.name.localeCompare(b.name));

/** Nationalities (demonyms), de-duplicated and sorted, for the nationality picker. */
export const NATIONALITIES: { code: string; nationality: string; flag: string }[] =
  COUNTRIES.map((c) => ({ code: c.code, nationality: c.nationality, flag: c.flag })).sort(
    (a, b) => a.nationality.localeCompare(b.nationality)
  );

const byName = new Map(COUNTRIES.map((c) => [c.name.toLowerCase(), c]));
const byCode = new Map(COUNTRIES.map((c) => [c.code, c]));

export function countryByName(name: string | null | undefined): Country | undefined {
  return name ? byName.get(name.toLowerCase()) : undefined;
}
export function countryByCode(code: string | null | undefined): Country | undefined {
  return code ? byCode.get(code.toUpperCase()) : undefined;
}

/** Flag + name for display, falling back to the raw value if unrecognised. */
export function countryDisplay(name: string | null | undefined): string {
  const c = countryByName(name);
  return c ? `${c.flag} ${c.name}` : (name ?? "");
}

/**
 * Best-effort fuzzy map of a free-text country value to a canonical name.
 * Handles common aliases so backfill/imports converge on one spelling.
 */
const ALIASES: Record<string, string> = {
  usa: "United States",
  "u.s.": "United States",
  "u.s.a.": "United States",
  us: "United States",
  "united states of america": "United States",
  uk: "United Kingdom",
  "u.k.": "United Kingdom",
  "great britain": "United Kingdom",
  england: "United Kingdom",
  uae: "United Arab Emirates",
  emirates: "United Arab Emirates",
  turkey: "Türkiye",
  "south korea": "South Korea",
  korea: "South Korea",
  russia: "Russia",
  "czech republic": "Czechia",
  "ivory coast": "Côte d'Ivoire",
  drc: "Congo (DRC)",
};

export function normalizeCountry(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  const direct = byName.get(v.toLowerCase());
  if (direct) return direct.name;
  const alias = ALIASES[v.toLowerCase()];
  if (alias) return alias;
  // Partial contains match (e.g. "Algiers, Algeria" → Algeria).
  const hit = COUNTRIES.find((c) => v.toLowerCase().includes(c.name.toLowerCase()));
  return hit ? hit.name : v; // leave unknown values untouched
}
