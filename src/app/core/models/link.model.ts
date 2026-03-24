/**
 * Link-in-Bio domain models
 * Creator custom links and click tracking.
 */

export interface CreatorLink {
  id: string;
  creator_id: string;
  title: string;
  url: string;
  icon: string | null;
  position: number;
  is_active: boolean;
  click_count: number;
  created_at: string;
  updated_at: string;
}

export interface LinkClick {
  id: string;
  link_id: string;
  creator_id: string;
  referrer: string | null;
  user_agent: string | null;
  created_at: string;
}
