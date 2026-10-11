// Display formats shared by every module. Dates are British-English, day
// first, month abbreviated: "11 Oct 2026"; times are 24-hour. Storage and
// APIs use ISO 8601 in UTC; only the display is formatted.

export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// A SHA-256 shown in a table: the first 12 hex characters and an ellipsis;
// the full value goes in the cell's title.
export function shortHash(hash: string): string {
  return hash.length > 12 ? `${hash.slice(0, 12)}…` : hash;
}
