/**
 * Extracts a human-readable message from an unknown error value.
 *
 * @param err    - The caught error (type unknown — never assume Error).
 * @param fallback - Displayed when `err` is not an Error instance.
 * @returns      A string safe to show in UI or log to the console.
 */
export function errorMessage(err: unknown, fallback = 'An unexpected error occurred'): string {
  return err instanceof Error ? err.message : fallback;
}
