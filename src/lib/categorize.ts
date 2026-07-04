export const CATEGORIES = [
  "Groceries",
  "Dining",
  "Travel",
  "Transport",
  "Shopping",
  "Utilities",
  "Entertainment",
  "Health",
  "Home",
  "Subscriptions",
  "Fees",
  "Cash & Transfers",
  "Uncategorized",
] as const;

export type Category = (typeof CATEGORIES)[number];

// Keyword -> category. First match wins, so order matters: the most specific /
// easily-confused rules (food delivery vs. rideshare) come first. Card
// descriptors often insert a "*" (e.g. "UBER *EATS"), so patterns allow it.
const RULES: [RegExp, Category][] = [
  // Food delivery FIRST so "UBER *EATS" doesn't get caught by the rideshare
  // rule below. \W* absorbs the "*"/spaces card networks insert.
  [
    /(uber\W*eats|ubereats|zomato|swiggy|doordash|door\W*dash|grubhub|seamless|postmates|deliveroo|caviar|gopuff|slice\b|chownow|toast\W*tab)/i,
    "Dining",
  ],
  // Rideshare / micro-transit (after food delivery). VIA is the Jersey City
  // rideshare service — scoped so it doesn't catch restaurants named "Via ...".
  [
    /(uber\W*(trip|ride|pending|technolog)|\buber\b|\blyft\b|via\W*jersey|via\W*transport|via\W*transit|ride\W*via|\brevel\b|\bcurb\b)/i,
    "Transport",
  ],
  // Groceries
  [
    /\b(whole foods|trader joe|safeway|kroger|costco|wegmans|aldi|publix|grocery|supermarket|instacart|sprouts|h-?e-?b|shoprite|stop\s*&?\s*shop|giant|food\s*bazaar|patel bros|market basket|fresh market|food lion|meijer|winco)\b/i,
    "Groceries",
  ],
  // Restaurant chains (be vigilant). Many common US/Indian chains + generic
  // food words below.
  [
    /\b(domino|pizza hut|papa john|little caesar|kfc|popeye|chick[\W-]*fil[\W-]*a|chickfila|mcdonald|burger king|wendy|taco bell|subway|chipotle|panera|five guys|shake shack|dunkin|starbucks|peet|dutch bros|panda express|olive garden|cheesecake|ihop|denny|applebee|buffalo wild|wingstop|raising cane|\bcanes\b|sonic|arby|jack in the box|in[\W-]*n[\W-]*out|whataburger|culver|jimmy john|jersey mike|firehouse|qdoba|\bmoe'?s\b|noodles|sweetgreen|\bcava\b|chopt|dairy queen|baskin|cold stone|krispy kreme|tim horton|bojangles|zaxby|el pollo|del taco|carl'?s jr|hardee|white castle|checkers|portillo|halal guys|nando|\bpret\b|taqueria|trattoria|osteria|ristorante|cantina|biryani|tandoor|curry|kebab|shawarma|dosa|chaat)\b/i,
    "Dining",
  ],
  // Generic dining words
  [
    /\b(restaurant|resto|cafe|caffe|coffee|espresso|tavern|\bpub\b|brewery|brewing|grill|grille|kitchen|eatery|bistro|diner|\bdeli\b|bakery|pizzeria|pizza|sushi|ramen|\bpho\b|thai|noodle|dumpling|hotpot|\bbbq\b|steakhouse|seafood|wings|donut|doughnut|gelato|smoothie|juice bar|dining|food court|catering)\b/i,
    "Dining",
  ],
  [/\b(airline|air lines|delta|united|american air|southwest|jetblue|hotel|marriott|bonvoy|hilton|hyatt|airbnb|expedia|booking\.com|travel|resort|lodging|amtrak|tsa|clear|global entry)\b/i, "Travel"],
  [/\b(taxi|\bcab\b|transit|metro|\bmta\b|\bnjt\b|nj transit|path train|\bbart\b|caltrain|parking|\bgarage\b|spothero|\bgas\b|shell|chevron|exxon|mobil|\bbp\b|fuel|toll|ez[\W-]*pass|zipcar|hertz|avis|enterprise rent|budget rent)\b/i, "Transport"],
  [/\b(amazon|walmart|target|best buy|ebay|etsy|nordstrom|macy|kohl|apple store|\bstore\b|\bshop\b|clothing|nike|adidas|lululemon|sephora|ulta|wayfair)\b/i, "Shopping"],
  [/\b(comcast|xfinity|verizon|at&t|t-mobile|electric|water|gas company|utility|pg&e|con ed|internet|spectrum)\b/i, "Utilities"],
  [/\b(netflix|hulu|spotify|disney|hbo|\bmax\b|movie|cinema|\bamc\b|theatre|ticketmaster|concert|\bgame\b|playstation|xbox|steam)\b/i, "Entertainment"],
  [/\b(pharmacy|cvs|walgreens|doctor|medical|dental|hospital|clinic|fitness|\bgym\b|equinox|peloton|health)\b/i, "Health"],
  [/\b(home depot|lowe|ikea|furniture|hardware|rent|mortgage|\bhoa\b|\bhome\b)\b/i, "Home"],
  [/\b(subscription|membership|prime|icloud|google storage|patreon|substack)\b/i, "Subscriptions"],
  [/\b(annual fee|membership fee|interest|finance charge|late fee)\b/i, "Fees"],
  [/\b(payment|autopay|transfer|venmo|zelle|cash app|withdrawal|\batm\b)\b/i, "Cash & Transfers"],
];

export function categorize(description: string): Category {
  const desc = description || "";
  for (const [pattern, category] of RULES) {
    if (pattern.test(desc)) return category;
  }
  return "Uncategorized";
}
