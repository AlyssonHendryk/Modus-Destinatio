export const ACTIVITY_POLL_INTERVAL = 30_000

// Polling is intentionally restricted to the newest page. Older cursor pages
// are stable snapshots and must never be replaced by an automatic refresh.
export function shouldPollActivityPage({ cursor, hidden, inFlight }) {
  return cursor === null && !hidden && !inFlight
}
