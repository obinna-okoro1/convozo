/**
 * Shared response types used across multiple domains.
 */

export interface SupabaseResponse<T> {
  data: T | null;
  error: Error | null;
}

export interface EdgeFunctionResponse<T = unknown> {
  data?: T;
  error?: { message: string };
}
