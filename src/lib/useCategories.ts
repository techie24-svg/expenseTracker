"use client";

import { useEffect, useState } from "react";
import { CATEGORIES } from "./categorize";

export interface CategoryInfo {
  name: string;
  custom: boolean;
}

/**
 * Fetches the merged built-in + user-defined categories from the API.
 * Falls back to the built-in list while loading or if the request fails, so
 * dropdowns always have options.
 */
export function useCategories() {
  const fallback: CategoryInfo[] = (CATEGORIES as readonly string[]).map(
    (name) => ({ name, custom: false }),
  );
  const [categories, setCategories] = useState<CategoryInfo[]>(fallback);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      if (Array.isArray(data.categories) && data.categories.length > 0) {
        setCategories(data.categories);
      }
    } catch {
      // keep fallback
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const names = categories.map((c) => c.name);
  return { categories, names, loading, refresh };
}
