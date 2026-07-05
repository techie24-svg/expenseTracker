import { NextResponse } from "next/server";
import { db } from "@/db";
import { cards, transactions } from "@/db/schema";
import { eq } from "drizzle-orm";

/** PATCH a card (e.g. rename, owner, annual fee, active flag). */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const cardId = Number(id);
    const body = await req.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.issuer !== undefined)
      updates.issuer = body.issuer ? String(body.issuer).trim() : null;
    if (body.owner !== undefined)
      updates.owner = body.owner ? String(body.owner).trim() : null;
    if (body.last4 !== undefined)
      updates.last4 = body.last4 ? String(body.last4).trim() : null;
    if (body.annualFee !== undefined)
      updates.annualFee = String(body.annualFee);
    if (body.active !== undefined) updates.active = Boolean(body.active);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const [updated] = await db
      .update(cards)
      .set(updates)
      .where(eq(cards.id, cardId))
      .returning();
    if (!updated) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/**
 * Delete a card. Its transactions are kept but unlinked (card_id -> null via the
 * FK's ON DELETE SET NULL); they still carry their account label. Pass
 * ?withTransactions=1 to also delete every transaction on the card.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const cardId = Number(id);
    if (Number.isNaN(cardId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const withTransactions = searchParams.get("withTransactions") === "1";

    let deletedTransactions = 0;
    if (withTransactions) {
      const removed = await db
        .delete(transactions)
        .where(eq(transactions.cardId, cardId))
        .returning({ id: transactions.id });
      deletedTransactions = removed.length;
    }

    const [deleted] = await db
      .delete(cards)
      .where(eq(cards.id, cardId))
      .returning();
    if (!deleted) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, deletedTransactions });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
