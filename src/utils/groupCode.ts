// Group codes (sql/10_kid_groups.sql) without the database client, so the
// /kids join page can be prerendered at build time without Supabase keys.

/** Normalises what a child or grown-up typed as a code. */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}
