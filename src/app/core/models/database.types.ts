export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      availability_slots: {
        Row: {
          created_at: string | null
          creator_id: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean | null
          start_time: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          creator_id: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean | null
          start_time: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          creator_id?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean | null
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "availability_slots_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      call_bookings: {
        Row: {
          actual_duration_seconds: number | null
          amount_paid: number
          booker_email: string
          booker_name: string
          call_ended_at: string | null
          call_notes: string | null
          call_started_at: string | null
          capture_method: string
          created_at: string | null
          creator_id: string
          creator_joined_at: string | null
          creator_meeting_token: string | null
          daily_room_name: string | null
          daily_room_url: string | null
          dispute_frozen_at: string | null
          dispute_id: string | null
          duration: number
          fan_access_token: string
          fan_joined_at: string | null
          fan_meeting_token: string | null
          fan_timezone: string
          flutterwave_tx_ref: string | null
          id: string
          meeting_verification_code: string | null
          payout_release_at: string | null
          payout_released_at: string | null
          payout_status: string
          refund_id: string | null
          refunded_at: string | null
          scheduled_at: string | null
          session_type: string
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          updated_at: string | null
        }
        Insert: {
          actual_duration_seconds?: number | null
          amount_paid: number
          booker_email: string
          booker_name: string
          call_ended_at?: string | null
          call_notes?: string | null
          call_started_at?: string | null
          capture_method?: string
          created_at?: string | null
          creator_id: string
          creator_joined_at?: string | null
          creator_meeting_token?: string | null
          daily_room_name?: string | null
          daily_room_url?: string | null
          dispute_frozen_at?: string | null
          dispute_id?: string | null
          duration: number
          fan_access_token?: string
          fan_joined_at?: string | null
          fan_meeting_token?: string | null
          fan_timezone?: string
          flutterwave_tx_ref?: string | null
          id?: string
          meeting_verification_code?: string | null
          payout_release_at?: string | null
          payout_released_at?: string | null
          payout_status?: string
          refund_id?: string | null
          refunded_at?: string | null
          scheduled_at?: string | null
          session_type?: string
          status: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_duration_seconds?: number | null
          amount_paid?: number
          booker_email?: string
          booker_name?: string
          call_ended_at?: string | null
          call_notes?: string | null
          call_started_at?: string | null
          capture_method?: string
          created_at?: string | null
          creator_id?: string
          creator_joined_at?: string | null
          creator_meeting_token?: string | null
          daily_room_name?: string | null
          daily_room_url?: string | null
          dispute_frozen_at?: string | null
          dispute_id?: string | null
          duration?: number
          fan_access_token?: string
          fan_joined_at?: string | null
          fan_meeting_token?: string | null
          fan_timezone?: string
          flutterwave_tx_ref?: string | null
          id?: string
          meeting_verification_code?: string | null
          payout_release_at?: string | null
          payout_released_at?: string | null
          payout_status?: string
          refund_id?: string | null
          refunded_at?: string | null
          scheduled_at?: string | null
          session_type?: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_bookings_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      call_events: {
        Row: {
          actor: string | null
          booking_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          actor?: string | null
          booking_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          actor?: string | null
          booking_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "call_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "call_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_rate_limits: {
        Row: {
          count: number
          key: string
          last_seen_at: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          last_seen_at?: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          last_seen_at?: string
          window_start?: string
        }
        Relationships: []
      }
      creator_links: {
        Row: {
          click_count: number
          created_at: string | null
          creator_id: string
          icon: string | null
          id: string
          is_active: boolean
          position: number
          title: string
          updated_at: string | null
          url: string
        }
        Insert: {
          click_count?: number
          created_at?: string | null
          creator_id: string
          icon?: string | null
          id?: string
          is_active?: boolean
          position?: number
          title: string
          updated_at?: string | null
          url: string
        }
        Update: {
          click_count?: number
          created_at?: string | null
          creator_id?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          position?: number
          title?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_links_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_monthly_analytics: {
        Row: {
          call_count: number
          call_gross: number
          call_net: number
          call_platform_fee: number
          call_refund_amount: number
          call_refund_count: number
          created_at: string
          creator_id: string
          id: string
          message_count: number
          message_gross: number
          message_net: number
          message_platform_fee: number
          message_refund_amount: number
          message_refund_count: number
          month: string
          shop_gross: number
          shop_net: number
          shop_order_count: number
          shop_platform_fee: number
          shop_refund_amount: number
          shop_refund_count: number
          support_count: number
          support_gross: number
          support_net: number
          support_platform_fee: number
          support_refund_amount: number
          support_refund_count: number
          total_gross: number
          total_net: number
          total_platform_fee: number
          total_refunds: number
          updated_at: string
        }
        Insert: {
          call_count?: number
          call_gross?: number
          call_net?: number
          call_platform_fee?: number
          call_refund_amount?: number
          call_refund_count?: number
          created_at?: string
          creator_id: string
          id?: string
          message_count?: number
          message_gross?: number
          message_net?: number
          message_platform_fee?: number
          message_refund_amount?: number
          message_refund_count?: number
          month: string
          shop_gross?: number
          shop_net?: number
          shop_order_count?: number
          shop_platform_fee?: number
          shop_refund_amount?: number
          shop_refund_count?: number
          support_count?: number
          support_gross?: number
          support_net?: number
          support_platform_fee?: number
          support_refund_amount?: number
          support_refund_count?: number
          total_gross?: number
          total_net?: number
          total_platform_fee?: number
          total_refunds?: number
          updated_at?: string
        }
        Update: {
          call_count?: number
          call_gross?: number
          call_net?: number
          call_platform_fee?: number
          call_refund_amount?: number
          call_refund_count?: number
          created_at?: string
          creator_id?: string
          id?: string
          message_count?: number
          message_gross?: number
          message_net?: number
          message_platform_fee?: number
          message_refund_amount?: number
          message_refund_count?: number
          month?: string
          shop_gross?: number
          shop_net?: number
          shop_order_count?: number
          shop_platform_fee?: number
          shop_refund_amount?: number
          shop_refund_count?: number
          support_count?: number
          support_gross?: number
          support_net?: number
          support_platform_fee?: number
          support_refund_amount?: number
          support_refund_count?: number
          total_gross?: number
          total_net?: number
          total_platform_fee?: number
          total_refunds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_monthly_analytics_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_posts: {
        Row: {
          content: string
          created_at: string
          creator_id: string
          id: string
          is_published: boolean
          title: string | null
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          creator_id: string
          id?: string
          is_published?: boolean
          title?: string | null
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          creator_id?: string
          id?: string
          is_published?: boolean
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_posts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_settings: {
        Row: {
          auto_reply_text: string | null
          buffer_minutes: number
          call_duration: number | null
          call_price: number | null
          calls_enabled: boolean | null
          created_at: string | null
          creator_id: string
          id: string
          message_price: number | null
          messages_enabled: boolean | null
          physical_address: string | null
          response_expectation: string | null
          session_type: string
          shop_enabled: boolean
          tips_enabled: boolean | null
          updated_at: string | null
        }
        Insert: {
          auto_reply_text?: string | null
          buffer_minutes?: number
          call_duration?: number | null
          call_price?: number | null
          calls_enabled?: boolean | null
          created_at?: string | null
          creator_id: string
          id?: string
          message_price?: number | null
          messages_enabled?: boolean | null
          physical_address?: string | null
          response_expectation?: string | null
          session_type?: string
          shop_enabled?: boolean
          tips_enabled?: boolean | null
          updated_at?: string | null
        }
        Update: {
          auto_reply_text?: string | null
          buffer_minutes?: number
          call_duration?: number | null
          call_price?: number | null
          calls_enabled?: boolean | null
          created_at?: string | null
          creator_id?: string
          id?: string
          message_price?: number | null
          messages_enabled?: boolean | null
          physical_address?: string | null
          response_expectation?: string | null
          session_type?: string
          shop_enabled?: boolean
          tips_enabled?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_settings_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creators: {
        Row: {
          banner_image_url: string | null
          bio: string | null
          category: string | null
          country: string
          created_at: string | null
          display_name: string
          email: string
          id: string
          is_active: boolean | null
          linkedin_url: string | null
          payment_provider: string
          phone_number: string
          profession_title: string | null
          profile_image_url: string | null
          profile_type: string
          slug: string
          subcategory: string | null
          theme_color: string | null
          updated_at: string | null
          user_id: string
          years_of_experience: number | null
        }
        Insert: {
          banner_image_url?: string | null
          bio?: string | null
          category?: string | null
          country?: string
          created_at?: string | null
          display_name: string
          email: string
          id?: string
          is_active?: boolean | null
          linkedin_url?: string | null
          payment_provider?: string
          phone_number?: string
          profession_title?: string | null
          profile_image_url?: string | null
          profile_type?: string
          slug: string
          subcategory?: string | null
          theme_color?: string | null
          updated_at?: string | null
          user_id: string
          years_of_experience?: number | null
        }
        Update: {
          banner_image_url?: string | null
          bio?: string | null
          category?: string | null
          country?: string
          created_at?: string | null
          display_name?: string
          email?: string
          id?: string
          is_active?: boolean | null
          linkedin_url?: string | null
          payment_provider?: string
          phone_number?: string
          profession_title?: string | null
          profile_image_url?: string | null
          profile_type?: string
          slug?: string
          subcategory?: string | null
          theme_color?: string | null
          updated_at?: string | null
          user_id?: string
          years_of_experience?: number | null
        }
        Relationships: []
      }
      flutterwave_subaccounts: {
        Row: {
          account_name: string | null
          account_number: string
          bank_code: string
          bank_name: string
          business_name: string
          country: string
          created_at: string
          creator_id: string
          id: string
          is_active: boolean
          subaccount_id: string
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_number: string
          bank_code: string
          bank_name: string
          business_name: string
          country?: string
          created_at?: string
          creator_id: string
          id?: string
          is_active?: boolean
          subaccount_id: string
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_number?: string
          bank_code?: string
          bank_name?: string
          business_name?: string
          country?: string
          created_at?: string
          creator_id?: string
          id?: string
          is_active?: boolean
          subaccount_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paystack_subaccounts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      link_clicks: {
        Row: {
          created_at: string | null
          creator_id: string
          id: string
          link_id: string
          referrer: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          creator_id: string
          id?: string
          link_id: string
          referrer?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          creator_id?: string
          id?: string
          link_id?: string
          referrer?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "link_clicks_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_clicks_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "creator_links"
            referencedColumns: ["id"]
          },
        ]
      }
      message_replies: {
        Row: {
          content: string
          created_at: string | null
          id: string
          message_id: string
          sender_type: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          message_id: string
          sender_type: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          message_id?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_replies_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          amount_paid: number
          conversation_token: string
          created_at: string | null
          creator_id: string
          flutterwave_tx_ref: string | null
          id: string
          is_handled: boolean | null
          message_content: string
          message_type: string | null
          refunded_at: string | null
          replied_at: string | null
          reply_content: string | null
          sender_email: string
          sender_name: string
          stripe_session_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount_paid: number
          conversation_token?: string
          created_at?: string | null
          creator_id: string
          flutterwave_tx_ref?: string | null
          id?: string
          is_handled?: boolean | null
          message_content: string
          message_type?: string | null
          refunded_at?: string | null
          replied_at?: string | null
          reply_content?: string | null
          sender_email: string
          sender_name: string
          stripe_session_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_paid?: number
          conversation_token?: string
          created_at?: string | null
          creator_id?: string
          flutterwave_tx_ref?: string | null
          id?: string
          is_handled?: boolean | null
          message_content?: string
          message_type?: string | null
          refunded_at?: string | null
          replied_at?: string | null
          reply_content?: string | null
          sender_email?: string
          sender_name?: string
          stripe_session_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          creator_amount: number
          creator_id: string
          dispute_frozen_at: string | null
          dispute_id: string | null
          flutterwave_tx_ref: string | null
          id: string
          message_id: string | null
          platform_fee: number
          refund_id: string | null
          refunded_at: string | null
          sender_email: string
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          creator_amount: number
          creator_id: string
          dispute_frozen_at?: string | null
          dispute_id?: string | null
          flutterwave_tx_ref?: string | null
          id?: string
          message_id?: string | null
          platform_fee: number
          refund_id?: string | null
          refunded_at?: string | null
          sender_email: string
          status: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          creator_amount?: number
          creator_id?: string
          dispute_frozen_at?: string | null
          dispute_id?: string | null
          flutterwave_tx_ref?: string | null
          id?: string
          message_id?: string | null
          platform_fee?: number
          refund_id?: string | null
          refunded_at?: string | null
          sender_email?: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          creator_id: string
          endpoint: string
          id: string
          p256dh: string
        }
        Insert: {
          auth: string
          created_at?: string
          creator_id: string
          endpoint: string
          id?: string
          p256dh: string
        }
        Update: {
          auth?: string
          created_at?: string
          creator_id?: string
          endpoint?: string
          id?: string
          p256dh?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_items: {
        Row: {
          created_at: string
          creator_id: string
          delivery_note: string | null
          description: string | null
          file_storage_path: string | null
          file_url: string | null
          id: string
          is_active: boolean
          is_request_based: boolean
          item_type: string
          preview_text: string | null
          price: number
          sort_order: number
          thumbnail_storage_path: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          delivery_note?: string | null
          description?: string | null
          file_storage_path?: string | null
          file_url?: string | null
          id?: string
          is_active?: boolean
          is_request_based?: boolean
          item_type: string
          preview_text?: string | null
          price: number
          sort_order?: number
          thumbnail_storage_path?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          delivery_note?: string | null
          description?: string | null
          file_storage_path?: string | null
          file_url?: string | null
          id?: string
          is_active?: boolean
          is_request_based?: boolean
          item_type?: string
          preview_text?: string | null
          price?: number
          sort_order?: number
          thumbnail_storage_path?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_items_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_orders: {
        Row: {
          amount_paid: number
          buyer_email: string
          buyer_name: string
          created_at: string
          creator_id: string
          fulfillment_url: string | null
          id: string
          idempotency_key: string
          item_id: string
          request_details: string | null
          status: string
          stripe_session_id: string
          updated_at: string
        }
        Insert: {
          amount_paid: number
          buyer_email: string
          buyer_name: string
          created_at?: string
          creator_id: string
          fulfillment_url?: string | null
          id?: string
          idempotency_key: string
          item_id: string
          request_details?: string | null
          status?: string
          stripe_session_id: string
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          buyer_email?: string
          buyer_name?: string
          created_at?: string
          creator_id?: string
          fulfillment_url?: string | null
          id?: string
          idempotency_key?: string
          item_id?: string
          request_details?: string | null
          status?: string
          stripe_session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_orders_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_orders_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "shop_items"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_accounts: {
        Row: {
          charges_enabled: boolean | null
          created_at: string | null
          creator_id: string
          details_submitted: boolean | null
          id: string
          onboarding_completed: boolean | null
          payouts_enabled: boolean | null
          stripe_account_id: string
          updated_at: string | null
        }
        Insert: {
          charges_enabled?: boolean | null
          created_at?: string | null
          creator_id: string
          details_submitted?: boolean | null
          id?: string
          onboarding_completed?: boolean | null
          payouts_enabled?: boolean | null
          stripe_account_id: string
          updated_at?: string | null
        }
        Update: {
          charges_enabled?: boolean | null
          created_at?: string | null
          creator_id?: string
          details_submitted?: boolean | null
          id?: string
          onboarding_completed?: boolean | null
          payouts_enabled?: boolean | null
          stripe_account_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stripe_accounts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      analytics_ensure_row: {
        Args: { p_creator_id: string; p_month: string }
        Returns: undefined
      }
      get_call_status: {
        Args: { p_booking_id: string }
        Returns: {
          booker_name: string
          call_started_at: string
          creator_id: string
          creator_joined_at: string
          duration: number
          fan_joined_at: string
          fan_timezone: string
          id: string
          scheduled_at: string
          status: string
        }[]
      }
      get_creator_booked_slots: {
        Args: { p_after_ts?: string; p_creator_id: string }
        Returns: {
          scheduled_at: string
        }[]
      }
      increment_click_count: { Args: { row_id: string }; Returns: undefined }
      upsert_checkout_rate_limit: {
        Args: { p_key: string; p_window_start: string }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

