export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      ab_variants: {
        Row: {
          clicks_count: number | null
          conversions_count: number | null
          created_at: string | null
          id: string
          is_active: boolean | null
          link_id: string
          offer_url: string
          variant_label: string
          weight_pct: number | null
        }
        Insert: {
          clicks_count?: number | null
          conversions_count?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          link_id: string
          offer_url: string
          variant_label: string
          weight_pct?: number | null
        }
        Update: {
          clicks_count?: number | null
          conversions_count?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          link_id?: string
          offer_url?: string
          variant_label?: string
          weight_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ab_variants_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "links"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_cache: {
        Row: {
          data: Json
          days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          data: Json
          days: number
          updated_at?: string
          user_id: string
        }
        Update: {
          data?: Json
          days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          click_quota: number | null
          daily_redirect_enabled: boolean | null
          fallback_url: string | null
          id: boolean
          injection_count: number | null
          injection_threshold: number | null
          last_click_reset_at: string | null
          our_adsterra_url: string | null
          signup_blocklist_enabled: boolean
          signup_gmail_only: boolean
          signup_ip_max_per_day: number
          signup_protection_enabled: boolean
          updated_at: string | null
        }
        Insert: {
          click_quota?: number | null
          daily_redirect_enabled?: boolean | null
          fallback_url?: string | null
          id?: boolean
          injection_count?: number | null
          injection_threshold?: number | null
          last_click_reset_at?: string | null
          our_adsterra_url?: string | null
          signup_blocklist_enabled?: boolean
          signup_gmail_only?: boolean
          signup_ip_max_per_day?: number
          signup_protection_enabled?: boolean
          updated_at?: string | null
        }
        Update: {
          click_quota?: number | null
          daily_redirect_enabled?: boolean | null
          fallback_url?: string | null
          id?: boolean
          injection_count?: number | null
          injection_threshold?: number | null
          last_click_reset_at?: string | null
          our_adsterra_url?: string | null
          signup_blocklist_enabled?: boolean
          signup_gmail_only?: boolean
          signup_ip_max_per_day?: number
          signup_protection_enabled?: boolean
          updated_at?: string | null
        }
        Relationships: []
      }
      blocked_email_domains: {
        Row: {
          created_at: string
          domain: string
        }
        Insert: {
          created_at?: string
          domain: string
        }
        Update: {
          created_at?: string
          domain?: string
        }
        Relationships: []
      }
      bot_fingerprints: {
        Row: {
          auto_blocked: boolean | null
          fingerprint_hash: string
          is_bot_count: number | null
          is_human_count: number | null
          last_country: string | null
          last_ip: string | null
          last_ua: string | null
          updated_at: string | null
        }
        Insert: {
          auto_blocked?: boolean | null
          fingerprint_hash: string
          is_bot_count?: number | null
          is_human_count?: number | null
          last_country?: string | null
          last_ip?: string | null
          last_ua?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_blocked?: boolean | null
          fingerprint_hash?: string
          is_bot_count?: number | null
          is_human_count?: number | null
          last_country?: string | null
          last_ip?: string | null
          last_ua?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      bot_rules: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          label: string | null
          pattern: string
          rule_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string | null
          pattern: string
          rule_type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string | null
          pattern?: string
          rule_type?: string
        }
        Relationships: []
      }
      bot_whitelist: {
        Row: {
          created_at: string
          hit_count: number
          id: string
          is_active: boolean
          label: string | null
          last_hit_at: string | null
          pattern: string
          rule_type: string
        }
        Insert: {
          created_at?: string
          hit_count?: number
          id?: string
          is_active?: boolean
          label?: string | null
          last_hit_at?: string | null
          pattern: string
          rule_type: string
        }
        Update: {
          created_at?: string
          hit_count?: number
          id?: string
          is_active?: boolean
          label?: string | null
          last_hit_at?: string | null
          pattern?: string
          rule_type?: string
        }
        Relationships: []
      }
      broadcast_reads: {
        Row: {
          broadcast_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          broadcast_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          broadcast_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_reads_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "broadcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcasts: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          icon: string
          id: string
          is_active: boolean
          title: string
          tone: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          title: string
          tone?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          title?: string
          tone?: string
        }
        Relationships: []
      }
      clicks: {
        Row: {
          bot_reason: string | null
          bot_score: number | null
          browser: string | null
          challenge_passed: boolean | null
          city: string | null
          country: string | null
          created_at: string
          device: string | null
          id: string
          ip: string | null
          is_bot: boolean
          link_id: string
          os: string | null
          referer: string | null
          referer_host: string | null
          routed_to: string | null
          signals: Json | null
          ua: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          bot_reason?: string | null
          bot_score?: number | null
          browser?: string | null
          challenge_passed?: boolean | null
          city?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          id?: string
          ip?: string | null
          is_bot?: boolean
          link_id: string
          os?: string | null
          referer?: string | null
          referer_host?: string | null
          routed_to?: string | null
          signals?: Json | null
          ua?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          bot_reason?: string | null
          bot_score?: number | null
          browser?: string | null
          challenge_passed?: boolean | null
          city?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          id?: string
          ip?: string | null
          is_bot?: boolean
          link_id?: string
          os?: string | null
          referer?: string | null
          referer_host?: string | null
          routed_to?: string | null
          signals?: Json | null
          ua?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clicks_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "links"
            referencedColumns: ["id"]
          },
        ]
      }
      cloaking_rules: {
        Row: {
          action: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          label: string | null
          pattern: string
          priority: number | null
          rule_type: string
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string | null
          pattern: string
          priority?: number | null
          rule_type: string
        }
        Update: {
          action?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string | null
          pattern?: string
          priority?: number | null
          rule_type?: string
        }
        Relationships: []
      }
      country_tiers: {
        Row: {
          country_code: string
          country_name: string | null
          tier: number
        }
        Insert: {
          country_code: string
          country_name?: string | null
          tier: number
        }
        Update: {
          country_code?: string
          country_name?: string | null
          tier?: number
        }
        Relationships: []
      }
      custom_domains: {
        Row: {
          created_at: string
          domain: string
          id: string
          updated_at: string
          user_id: string
          verification_token: string
          verified: boolean
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          updated_at?: string
          user_id: string
          verification_token: string
          verified?: boolean
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          updated_at?: string
          user_id?: string
          verification_token?: string
          verified?: boolean
          verified_at?: string | null
        }
        Relationships: []
      }
      daily_stats: {
        Row: {
          bot_clicks: number | null
          country_breakdown: Json | null
          day: string
          device_breakdown: Json | null
          human_clicks: number | null
          id: string
          link_id: string | null
        }
        Insert: {
          bot_clicks?: number | null
          country_breakdown?: Json | null
          day: string
          device_breakdown?: Json | null
          human_clicks?: number | null
          id?: string
          link_id?: string | null
        }
        Update: {
          bot_clicks?: number | null
          country_breakdown?: Json | null
          day?: string
          device_breakdown?: Json | null
          human_clicks?: number | null
          id?: string
          link_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_stats_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "links"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_cache: {
        Row: {
          data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          data: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      domain_health_checks: {
        Row: {
          blacklist_sources: Json | null
          blacklisted: boolean | null
          checked_at: string
          dns_ok: boolean | null
          domain: string
          domain_id: string
          error_message: string | null
          http_final_url: string | null
          http_status: number | null
          id: number
          raw: Json | null
          redirect_count: number | null
          ssl_days_remaining: number | null
          ssl_expires_at: string | null
          ssl_issuer: string | null
          ssl_valid: boolean | null
          status: string
        }
        Insert: {
          blacklist_sources?: Json | null
          blacklisted?: boolean | null
          checked_at?: string
          dns_ok?: boolean | null
          domain: string
          domain_id: string
          error_message?: string | null
          http_final_url?: string | null
          http_status?: number | null
          id?: number
          raw?: Json | null
          redirect_count?: number | null
          ssl_days_remaining?: number | null
          ssl_expires_at?: string | null
          ssl_issuer?: string | null
          ssl_valid?: boolean | null
          status: string
        }
        Update: {
          blacklist_sources?: Json | null
          blacklisted?: boolean | null
          checked_at?: string
          dns_ok?: boolean | null
          domain?: string
          domain_id?: string
          error_message?: string | null
          http_final_url?: string | null
          http_status?: number | null
          id?: number
          raw?: Json | null
          redirect_count?: number | null
          ssl_days_remaining?: number | null
          ssl_expires_at?: string | null
          ssl_issuer?: string | null
          ssl_valid?: boolean | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "domain_health_checks_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "monitored_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          context: Json | null
          created_at: string
          id: string
          is_resolved: boolean | null
          level: string
          link_id: string | null
          message: string
          source: string
          stack: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          id?: string
          is_resolved?: boolean | null
          level?: string
          link_id?: string | null
          message: string
          source: string
          stack?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          id?: string
          is_resolved?: boolean | null
          level?: string
          link_id?: string | null
          message?: string
          source?: string
          stack?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "error_logs_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "links"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_offers: {
        Row: {
          clicks_count: number | null
          conversions_count: number | null
          country_codes: string[] | null
          created_at: string | null
          id: string
          is_active: boolean | null
          link_id: string
          offer_url: string
          tier: number | null
          weight: number | null
        }
        Insert: {
          clicks_count?: number | null
          conversions_count?: number | null
          country_codes?: string[] | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          link_id: string
          offer_url: string
          tier?: number | null
          weight?: number | null
        }
        Update: {
          clicks_count?: number | null
          conversions_count?: number | null
          country_codes?: string[] | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          link_id?: string
          offer_url?: string
          tier?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "geo_offers_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "links"
            referencedColumns: ["id"]
          },
        ]
      }
      hourly_stats_cache: {
        Row: {
          id: boolean
          stats: Json
          updated_at: string
        }
        Insert: {
          id?: boolean
          stats?: Json
          updated_at?: string
        }
        Update: {
          id?: boolean
          stats?: Json
          updated_at?: string
        }
        Relationships: []
      }
      links: {
        Row: {
          adsterra_direct_link: string | null
          adsterra_url: string | null
          blocked_countries: string[]
          bot_clicks_count: number
          clicks_count: number
          created_at: string
          destination_url: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          last_clicked_at: string | null
          offer_clicks_count: number | null
          ours_clicks_count: number | null
          prelanding_template: string | null
          safe_url: string | null
          short_code: string
          status: Database["public"]["Enums"]["link_status"]
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          adsterra_direct_link?: string | null
          adsterra_url?: string | null
          blocked_countries?: string[]
          bot_clicks_count?: number
          clicks_count?: number
          created_at?: string
          destination_url: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_clicked_at?: string | null
          offer_clicks_count?: number | null
          ours_clicks_count?: number | null
          prelanding_template?: string | null
          safe_url?: string | null
          short_code: string
          status?: Database["public"]["Enums"]["link_status"]
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          adsterra_direct_link?: string | null
          adsterra_url?: string | null
          blocked_countries?: string[]
          bot_clicks_count?: number
          clicks_count?: number
          created_at?: string
          destination_url?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_clicked_at?: string | null
          offer_clicks_count?: number | null
          ours_clicks_count?: number | null
          prelanding_template?: string | null
          safe_url?: string | null
          short_code?: string
          status?: Database["public"]["Enums"]["link_status"]
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      monitored_domains: {
        Row: {
          blacklist_sources: Json | null
          blacklisted: boolean | null
          created_at: string
          dns_ok: boolean | null
          domain: string
          http_final_url: string | null
          http_status: number | null
          id: string
          is_active: boolean
          last_checked_at: string | null
          last_error: string | null
          notes: string | null
          redirect_count: number | null
          source: string
          ssl_days_remaining: number | null
          ssl_expires_at: string | null
          ssl_issuer: string | null
          ssl_valid: boolean | null
          status: string | null
          updated_at: string
        }
        Insert: {
          blacklist_sources?: Json | null
          blacklisted?: boolean | null
          created_at?: string
          dns_ok?: boolean | null
          domain: string
          http_final_url?: string | null
          http_status?: number | null
          id?: string
          is_active?: boolean
          last_checked_at?: string | null
          last_error?: string | null
          notes?: string | null
          redirect_count?: number | null
          source?: string
          ssl_days_remaining?: number | null
          ssl_expires_at?: string | null
          ssl_issuer?: string | null
          ssl_valid?: boolean | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          blacklist_sources?: Json | null
          blacklisted?: boolean | null
          created_at?: string
          dns_ok?: boolean | null
          domain?: string
          http_final_url?: string | null
          http_status?: number | null
          id?: string
          is_active?: boolean
          last_checked_at?: string | null
          last_error?: string | null
          notes?: string | null
          redirect_count?: number | null
          source?: string
          ssl_days_remaining?: number | null
          ssl_expires_at?: string | null
          ssl_issuer?: string | null
          ssl_valid?: boolean | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      packages: {
        Row: {
          click_quota: number | null
          created_at: string
          features: Json
          id: string
          is_active: boolean
          link_limit: number
          name: string
          price_monthly: number | null
          price_usd: number
          slug: string
          sort_order: number
        }
        Insert: {
          click_quota?: number | null
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          link_limit?: number
          name: string
          price_monthly?: number | null
          price_usd?: number
          slug: string
          sort_order?: number
        }
        Update: {
          click_quota?: number | null
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          link_limit?: number
          name?: string
          price_monthly?: number | null
          price_usd?: number
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      plisio_event_logs: {
        Row: {
          created_at: string | null
          id: string
          order_number: string | null
          processed_at: string | null
          raw_body: Json | null
          status: string | null
          txn_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_number?: string | null
          processed_at?: string | null
          raw_body?: Json | null
          status?: string | null
          txn_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          order_number?: string | null
          processed_at?: string | null
          raw_body?: Json | null
          status?: string | null
          txn_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          click_quota: number | null
          clicks_period_start: string | null
          clicks_used: number | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_banned: boolean
          last_click_reset_seen_at: string | null
          last_daily_redirect_at: string | null
          last_login_at: string | null
          link_limit: number | null
          link_quota: number
          links_used: number
          ours_clicks: number | null
          plan_expires_at: string | null
          plan_slug: string
          plan_started_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          click_quota?: number | null
          clicks_period_start?: string | null
          clicks_used?: number | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_banned?: boolean
          last_click_reset_seen_at?: string | null
          last_daily_redirect_at?: string | null
          last_login_at?: string | null
          link_limit?: number | null
          link_quota?: number
          links_used?: number
          ours_clicks?: number | null
          plan_expires_at?: string | null
          plan_slug?: string
          plan_started_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          click_quota?: number | null
          clicks_period_start?: string | null
          clicks_used?: number | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_banned?: boolean
          last_click_reset_seen_at?: string | null
          last_daily_redirect_at?: string | null
          last_login_at?: string | null
          link_limit?: number | null
          link_quota?: number
          links_used?: number
          ours_clicks?: number | null
          plan_expires_at?: string | null
          plan_slug?: string
          plan_started_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quota_reset_snapshots: {
        Row: {
          click_quota: number | null
          clicks_period_start: string | null
          clicks_used: number | null
          created_at: string
          email: string | null
          id: string
          plan_expires_at: string | null
          plan_slug: string | null
          profile_id: string
          reset_at: string
          reset_id: string
        }
        Insert: {
          click_quota?: number | null
          clicks_period_start?: string | null
          clicks_used?: number | null
          created_at?: string
          email?: string | null
          id?: string
          plan_expires_at?: string | null
          plan_slug?: string | null
          profile_id: string
          reset_at?: string
          reset_id: string
        }
        Update: {
          click_quota?: number | null
          clicks_period_start?: string | null
          clicks_used?: number | null
          created_at?: string
          email?: string | null
          id?: string
          plan_expires_at?: string | null
          plan_slug?: string | null
          profile_id?: string
          reset_at?: string
          reset_id?: string
        }
        Relationships: []
      }
      referrer_rules: {
        Row: {
          action: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          label: string | null
          pattern: string
          trust_score: number | null
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string | null
          pattern: string
          trust_score?: number | null
        }
        Update: {
          action?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string | null
          pattern?: string
          trust_score?: number | null
        }
        Relationships: []
      }
      signup_attempts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          ip: string | null
          reason: string | null
          success: boolean
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          ip?: string | null
          reason?: string | null
          success?: boolean
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          ip?: string | null
          reason?: string | null
          success?: boolean
        }
        Relationships: []
      }
      upgrade_requests: {
        Row: {
          amount: number | null
          created_at: string | null
          id: string
          package_slug: string
          payment_id: string | null
          plisio_invoice_id: string | null
          plisio_invoice_url: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          id?: string
          package_slug: string
          payment_id?: string | null
          plisio_invoice_id?: string | null
          plisio_invoice_url?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          id?: string
          package_slug?: string
          payment_id?: string | null
          plisio_invoice_id?: string | null
          plisio_invoice_url?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wikipedia_safe_urls: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          language: string
          title: string | null
          url: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          is_active?: boolean
          language?: string
          title?: string | null
          url: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          language?: string
          title?: string | null
          url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _compute_analytics_summary: {
        Args: { _days?: number; _user_id: string }
        Returns: Json
      }
      _fast_analytics_summary: {
        Args: { _days?: number; _user_id: string }
        Returns: Json
      }
      admin_bot_reasons: {
        Args: { _hours?: number; _limit?: number }
        Returns: {
          count: number
          key: string
        }[]
      }
      admin_clicks_timeseries: {
        Args: { _days?: number }
        Returns: {
          bots: number
          date: string
          offer: number
          ours: number
          total: number
        }[]
      }
      admin_fb_blocked_count: { Args: { _hours?: number }; Returns: number }
      admin_get_inactive_users: {
        Args: never
        Returns: {
          clicks_used: number
          created_at: string
          days_inactive: number
          email: string
          id: string
          last_sign_in_at: string
          link_count: number
          plan_slug: string
        }[]
      }
      admin_top_countries: {
        Args: { _days?: number; _limit?: number }
        Returns: {
          count: number
          country: string
        }[]
      }
      admin_user_trend: {
        Args: { _days?: number; _user_id: string }
        Returns: {
          bots: number
          clicks: number
          date: string
        }[]
      }
      aggregate_daily_stats: { Args: { _days?: number }; Returns: Json }
      delete_inactive_free_users: { Args: never; Returns: Json }
      expire_monthly_plans: { Args: never; Returns: Json }
      expire_old_upgrade_requests: { Args: never; Returns: undefined }
      get_admin_overview_stats: { Args: never; Returns: Json }
      get_analytics_summary: {
        Args: { _days?: number; _user_id: string }
        Returns: Json
      }
      get_cohort_retention: {
        Args: { _user_id: string }
        Returns: {
          d1: number
          d30: number
          d7: number
          day_idx: number
          day_label: string
          size: number
        }[]
      }
      get_dashboard_stats: { Args: { _user_id: string }; Returns: Json }
      get_last_hour_click_stats: { Args: never; Returns: Json }
      get_live_analytics_summary:
        | { Args: { _user_id: string }; Returns: Json }
        | { Args: { "": Json }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_ab_variant_clicks: {
        Args: { _link_id: string; _variant_label: string }
        Returns: undefined
      }
      increment_link_click_counters: {
        Args: { _is_bot: boolean; _link_id: string; _routed_to: string }
        Returns: undefined
      }
      maintenance_purge_old_clicks: { Args: never; Returns: undefined }
      pick_prelanding_template: {
        Args: { _candidates: string[]; _link_id: string }
        Returns: string
      }
      prune_domain_health_history: { Args: never; Returns: undefined }
      record_bot_fingerprint: {
        Args: {
          _block_threshold?: number
          _country?: string
          _hash: string
          _ip?: string
          _is_bot: boolean
          _ua?: string
        }
        Returns: undefined
      }
      record_redirect_click: {
        Args: {
          _bot_reason?: string
          _bot_score?: number
          _challenge_passed?: boolean
          _country?: string
          _ip?: string
          _is_bot?: boolean
          _link_id: string
          _referer_host?: string
          _routed_to?: string
          _signals?: Json
          _ua?: string
          _user_id: string
          _utm_campaign?: string
          _utm_content?: string
          _utm_medium?: string
          _utm_source?: string
          _utm_term?: string
        }
        Returns: undefined
      }
      record_redirect_clicks_batch: {
        Args: { _events: Json }
        Returns: undefined
      }
      record_whitelist_hit: { Args: { _id: string }; Returns: undefined }
      refresh_active_analytics_cache: {
        Args: { _limit?: number }
        Returns: Json
      }
      refresh_hourly_stats_cache: { Args: never; Returns: undefined }
      reset_all_clicks: { Args: never; Returns: Json }
      restore_paid_quota_from_reset_snapshot: {
        Args: { _reset_id?: string }
        Returns: Json
      }
      resync_profile_click_counters: { Args: never; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "user"
      link_status: "active" | "paused" | "expired"
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
    Enums: {
      app_role: ["admin", "user"],
      link_status: ["active", "paused", "expired"],
    },
  },
} as const
