import { NextResponse } from "next/server";
import { db } from "@/db";
import { categories, transactions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { CATEGORIES } from "@/lib/categorize";

const BUILTIN = CATEGORIES as readonly string[];
const isBuiltin = (name: string) =>
  BUILTIN.some((b) => b.toLowerCase() === name.toLowerCase());

/** GET -> merged list of built-in + custom categories. */
export async function GET() {
  try {
    const custom = await db
      .select({ name: categories.name })
      .from(categories);

    const customNames = custom
      .map((c) => c.name)
      .sort((a, b) => a.localeCompare(b));

    // Built-ins keep their defined order (Uncategorized stays last); custom
    // ones are appended before "Uncategorized" so they're easy to find.
    const uncategorized = "Uncategorized";
    const builtinsHead = BUILTIN.filter((b) => b !== uncategorized);
    const ordered = [...builtinsHead, ...customNames, uncategorized];

    const list = ordered.map((name) => ({
      name,
      custom: !isBuiltin(name),
    }));

    return NextResponse.json({ categories: list });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** POST { name } -> add a new custom category. */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    if (name.length > 40) {
      return NextResponse.json(
        { error: "Keep category names under 40 characters." },
        { status: 400 },
      );
    }
    if (isBuiltin(name)) {
      return NextResponse.json(
        { error: `"${name}" is already a built-in category.` },
        { status: 409 },
      );
    }
    const existing = await db
      .select({ id: categories.id, name: categories.name })
      .from(categories);
    if (existing.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      return NextResponse.json(
        { error: `"${name}" already exists.` },
        { status: 409 },
      );
    }

    const [row] = await db.insert(categories).values({ name }).returning();
    return NextResponse.json({ ok: true, category: row });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** PATCH { oldName, newName } -> rename a custom category (updates txns too). */
export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const oldName = String(body.oldName ?? "").trim();
    const newName = String(body.newName ?? "").trim();
    if (!oldName || !newName) {
      return NextResponse.json(
        { error: "oldName and newName are required." },
        { status: 400 },
      );
    }
    if (isBuiltin(oldName)) {
      return NextResponse.json(
        { error: "Built-in categories can't be renamed." },
        { status: 400 },
      );
    }
    if (isBuiltin(newName)) {
      return NextResponse.json(
        { error: `"${newName}" is already a built-in category.` },
        { status: 409 },
      );
    }

    const existing = await db.select().from(categories);
    const target = existing.find(
      (c) => c.name.toLowerCase() === oldName.toLowerCase(),
    );
    if (!target) {
      return NextResponse.json(
        { error: `"${oldName}" not found.` },
        { status: 404 },
      );
    }
    if (
      existing.some(
        (c) =>
          c.id !== target.id &&
          c.name.toLowerCase() === newName.toLowerCase(),
      )
    ) {
      return NextResponse.json(
        { error: `"${newName}" already exists.` },
        { status: 409 },
      );
    }

    await db
      .update(categories)
      .set({ name: newName })
      .where(eq(categories.id, target.id));
    // Keep existing transactions pointing at the renamed category.
    const moved = await db
      .update(transactions)
      .set({ category: newName })
      .where(eq(transactions.category, target.name))
      .returning({ id: transactions.id });

    return NextResponse.json({ ok: true, reassigned: moved.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** DELETE { name } -> remove a custom category; its txns become Uncategorized. */
export async function DELETE(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    if (isBuiltin(name)) {
      return NextResponse.json(
        { error: "Built-in categories can't be deleted." },
        { status: 400 },
      );
    }

    const existing = await db.select().from(categories);
    const target = existing.find(
      (c) => c.name.toLowerCase() === name.toLowerCase(),
    );
    if (!target) {
      return NextResponse.json(
        { error: `"${name}" not found.` },
        { status: 404 },
      );
    }

    const moved = await db
      .update(transactions)
      .set({ category: "Uncategorized" })
      .where(eq(transactions.category, target.name))
      .returning({ id: transactions.id });
    await db.delete(categories).where(eq(categories.id, target.id));

    return NextResponse.json({ ok: true, reassigned: moved.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
