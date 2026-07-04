# Spend Tracker

A private, self-hosted tracker for your **true household expenses**. Import
credit card statements, auto-classify the noise (payments, statement credits),
and net out the offset credits on premium cards so only real spend counts.

## Why this exists

- ~95% of spend goes on credit cards → statements are the source of truth.
- High-annual-fee cards come with a pile of **offset/statement credits** (airline,
  Uber, dining, CLEAR, hotel, …). Those are **not** expenses.
- The **annual fee itself is** a real expense and is kept.
- Payments made to the card from checking are transfers, not spend — excluded.

## How the "true expense" logic works

Every transaction is classified into a type:

| Type       | Counts as expense? | Notes |
|------------|--------------------|-------|
| `purchase` | ✅ yes             | Normal spend |
| `fee`      | ✅ yes             | Annual/membership fee — the real cost of the card |
| `interest` | ✅ yes             | Interest / finance charges |
| `credit`   | ❌ no              | Statement / offset credit (reimbursement) |
| `payment`  | ❌ no              | Payment to the card (a transfer) |
| `refund`   | ❌ no              | Merchant refund/return |

**Netting engine:** each statement credit is matched to the purchase it offsets
(exact amount + within ~2 months + merchant similarity).

- Confident matches are **auto-netted** → both the credit and its purchase drop
  out of expenses.
- Fuzzy matches go to the **Review** queue for a one-click confirm. Nothing is
  silently guessed.

## Tech

- **Next.js** (App Router, TypeScript) — deploys to Vercel
- **Neon Postgres** via **Drizzle ORM**
- **Tailwind CSS** + **Recharts**

## Setup (local)

1. Install deps:

   ```bash
   npm install
   ```

2. Create a Neon database at [neon.tech](https://neon.tech), copy the pooled
   connection string, and put it in `.env.local`:

   ```bash
   cp .env.example .env.local
   # then edit DATABASE_URL=...
   ```

3. Initialize the database. Two options:

   - **Easiest:** start the app (step 4) and open **`/setup`**, then click
     "Initialize database". This creates the tables and seeds your cards from the
     browser — no CLI needed (works on Vercel too).
   - **Or via CLI:**

     ```bash
     npm run db:push   # create tables
     npm run db:seed   # create tables + load the household's cards
     ```

4. Run it:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000. Add your cards on the **Cards** page, then import
   a statement CSV on the **Import** page.

## Deploy (Vercel + Neon)

1. Push this repo to GitHub.
2. Import it into Vercel.
3. Add the `DATABASE_URL` environment variable in Vercel (same Neon string).
4. Deploy. Run `npm run db:push` once against your production database.

## Importing statements

- **CSV** works today for basically every issuer (Amex, Chase, Citi, Capital
  One, BofA…). Columns are auto-detected; a sign-convention toggle handles
  Amex-style (positive = charge) vs Chase-style (negative = charge) exports.
- **PDF** parsers are added per-card — drop a redacted sample statement in and a
  parser can be built for that layout.

## Scripts

| Script | What it does |
|--------|--------------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run db:push` | Push schema to Neon |
| `npm run db:seed` | Load the household's cards |
| `npm run db:generate` | Generate SQL migrations |
| `npm run db:studio` | Open Drizzle Studio |
