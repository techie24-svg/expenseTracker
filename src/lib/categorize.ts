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

// Keyword -> category. First match wins. Kept intentionally simple and easy to
// extend; users can always correct a category in the UI.
const RULES: [RegExp, Category][] = [
  [/\b(whole foods|trader joe|safeway|kroger|costco|wegmans|aldi|publix|grocery|supermarket|instacart|sprouts|h-?e-?b)\b/i, "Groceries"],
  [/\b(restaurant|cafe|coffee|starbucks|mcdonald|chipotle|doordash|uber eats|grubhub|dining|pizza|sushi|bar &|tavern|bakery|dunkin)\b/i, "Dining"],
  [/\b(airline|air lines|delta|united|american air|southwest|jetblue|hotel|marriott|hilton|hyatt|airbnb|expedia|booking\.com|travel|resort|lodging)\b/i, "Travel"],
  [/\b(uber|lyft|taxi|transit|metro|parking|gas|shell|chevron|exxon|bp |fuel|toll|amtrak)\b/i, "Transport"],
  [/\b(amazon|walmart|target|best buy|ebay|etsy|nordstrom|macy|apple store|store|shop|clothing|nike|adidas)\b/i, "Shopping"],
  [/\b(comcast|xfinity|verizon|at&t|t-mobile|electric|water|gas company|utility|pg&e|con ed|internet)\b/i, "Utilities"],
  [/\b(netflix|hulu|spotify|disney|hbo|max|movie|cinema|amc|theatre|ticketmaster|concert|game)\b/i, "Entertainment"],
  [/\b(pharmacy|cvs|walgreens|doctor|medical|dental|hospital|clinic|fitness|gym|equinox|health)\b/i, "Health"],
  [/\b(home depot|lowe|ikea|furniture|hardware|rent|mortgage|hoa|home)\b/i, "Home"],
  [/\b(subscription|membership|prime|icloud|google storage|patreon|substack)\b/i, "Subscriptions"],
  [/\b(annual fee|membership fee|interest|finance charge|late fee)\b/i, "Fees"],
  [/\b(payment|autopay|transfer|venmo|zelle|cash app|withdrawal|atm)\b/i, "Cash & Transfers"],
];

export function categorize(description: string): Category {
  const desc = description || "";
  for (const [pattern, category] of RULES) {
    if (pattern.test(desc)) return category;
  }
  return "Uncategorized";
}
