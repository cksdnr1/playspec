/**
 * Convert a title to a filesystem-safe slug.
 * Lowercase, replace spaces and special chars with underscores,
 * collapse consecutive underscores, trim leading/trailing underscores.
 *
 * Example: "Feature Name" → "feature_name"
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}
