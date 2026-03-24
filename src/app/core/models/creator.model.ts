/**
 * Creator domain models
 * Represents expert profiles and their settings on the platform.
 */

export interface Creator {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
  profile_image_url: string | null;
  banner_image_url: string | null;
  bio: string | null;
  slug: string;
  phone_number: string;
  /** ISO 3166-1 alpha-2 country code detected at signup, e.g. 'NG', 'US'. */
  country: string;
  /** Payment provider assigned at signup based on country. NG/ZA → 'paystack'; all others → 'stripe'. */
  payment_provider: 'stripe' | 'paystack';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatorSettings {
  id: string;
  creator_id: string;
  message_price: number;
  messages_enabled: boolean;
  call_price: number | null;
  call_duration: number | null;
  calls_enabled: boolean;
  tips_enabled: boolean;
  shop_enabled: boolean;
  response_expectation: string | null;
  auto_reply_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatorProfile extends Creator {
  creator_settings: CreatorSettings;
}
