// Pagination helpers for list endpoints.
//
// Raw `parseInt(req.query.limit)` is unsafe: `?limit=abc` yields NaN (→ a MySQL
// error / 500 when bound to LIMIT), and an unbounded value like `?limit=999999`
// lets a caller dump an entire table in one request. These clamp to sane ranges.

// Clamp a requested page size to [1, max], falling back to `def` for
// missing/invalid values.
function clampLimit(value, def = 20, max = 100) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n < 1) return def;
  return Math.min(n, max);
}

// Clamp a requested offset to a non-negative integer (0 for missing/invalid).
function clampOffset(value) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n < 0) return 0;
  return n;
}

module.exports = { clampLimit, clampOffset };
