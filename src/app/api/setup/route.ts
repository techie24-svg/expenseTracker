import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { setupDatabase } from "@/lib/setupDb";

/** Report whether the database is initialized and how many cards exist. */
export async function GET() {
  try {
    const exists = await db.execute(
      sql`SELECT to_regclass('public.cards') IS NOT NULL AS ready`,
    );
    const ready = Boolean(
      (exists as unknown as { rows?: { ready: boolean }[] }).rows?.[0]?.ready ??
        (exists as unknown as { ready: boolean }[])[0]?.ready,
    );

    let cardCount = 0;
    let txnCount = 0;
    if (ready) {
      const c = await db.execute(sql`SELECT count(*)::int AS n FROM cards`);
      const t = await db.execute(
        sql`SELECT count(*)::int AS n FROM transactions`,
      );
      const read = (r: unknown) =>
        Number(
          (r as { rows?: { n: number }[] }).rows?.[0]?.n ??
            (r as { n: number }[])[0]?.n ??
            0,
        );
      cardCount = read(c);
      txnCount = read(t);
    }

    return NextResponse.json({ ready, cardCount, txnCount });
  } catch (e) {
    return NextResponse.json(
      { ready: false, error: (e as Error).message },
      { status: 200 },
    );
  }
}

/** Create the schema (idempotent) and seed the household's cards. */
export async function POST() {
  try {
    const result = await setupDatabase();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
