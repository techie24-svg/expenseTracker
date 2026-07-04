import { NextResponse } from "next/server";
import { db } from "@/db";
import { cards } from "@/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  try {
    const all = await db.select().from(cards).orderBy(asc(cards.name));
    return NextResponse.json(all);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const [created] = await db
      .insert(cards)
      .values({
        name,
        issuer: body.issuer ? String(body.issuer).trim() : null,
        owner: body.owner ? String(body.owner).trim() : null,
        last4: body.last4 ? String(body.last4).trim() : null,
        annualFee:
          body.annualFee !== undefined && body.annualFee !== null
            ? String(body.annualFee)
            : "0",
      })
      .returning();
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}
