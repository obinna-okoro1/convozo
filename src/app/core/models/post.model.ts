/**
 * Creator Post model
 * Short-form public post (≤ 100 words) written by an expert on their profile.
 * Has an optional title displayed prominently above the content.
 */
export interface CreatorPost {
  id: string;
  creator_id: string;
  /** Optional headline. Null on posts created before migration 038. */
  title: string | null;
  content: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}
