export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_events: {
        Row: {
          client_id: string | null
          commitment_id: string | null
          created_at: string
          entity_id: string | null
          event_type: string
          id: string
          idempotency_key: string | null
          occurred_at: string
          payload: Json
          source: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          commitment_id?: string | null
          created_at?: string
          entity_id?: string | null
          event_type: string
          id?: string
          idempotency_key?: string | null
          occurred_at?: string
          payload?: Json
          source: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          commitment_id?: string | null
          created_at?: string
          entity_id?: string | null
          event_type?: string
          id?: string
          idempotency_key?: string | null
          occurred_at?: string
          payload?: Json
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_owned_commitment_fk"
            columns: ["user_id", "commitment_id"]
            isOneToOne: false
            referencedRelation: "commitments"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "activity_events_owned_entity_fk"
            columns: ["user_id", "entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "activity_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_proposals: {
        Row: {
          client_id: string
          created_at: string
          decided_at: string | null
          decision_note: string | null
          entity_type_id: string
          expires_at: string
          id: string
          idempotency_key: string
          operation: string
          proposed_commitment: Json | null
          proposed_entity: Json | null
          result_commitment_id: string | null
          result_entity_id: string | null
          result_event_id: string | null
          state: string
          target_commitment_id: string | null
          target_entity_id: string | null
          target_updated_at: string | null
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          entity_type_id: string
          expires_at?: string
          id?: string
          idempotency_key: string
          operation: string
          proposed_commitment?: Json | null
          proposed_entity?: Json | null
          result_commitment_id?: string | null
          result_entity_id?: string | null
          result_event_id?: string | null
          state?: string
          target_commitment_id?: string | null
          target_entity_id?: string | null
          target_updated_at?: string | null
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          entity_type_id?: string
          expires_at?: string
          id?: string
          idempotency_key?: string
          operation?: string
          proposed_commitment?: Json | null
          proposed_entity?: Json | null
          result_commitment_id?: string | null
          result_entity_id?: string | null
          result_event_id?: string | null
          state?: string
          target_commitment_id?: string | null
          target_entity_id?: string | null
          target_updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_proposals_owned_result_commitment_fk"
            columns: ["user_id", "result_commitment_id"]
            isOneToOne: false
            referencedRelation: "commitments"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "agent_proposals_owned_result_entity_fk"
            columns: ["user_id", "result_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "agent_proposals_owned_result_event_fk"
            columns: ["user_id", "result_event_id"]
            isOneToOne: false
            referencedRelation: "activity_events"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "agent_proposals_owned_target_commitment_fk"
            columns: ["user_id", "target_commitment_id"]
            isOneToOne: false
            referencedRelation: "commitments"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "agent_proposals_owned_target_entity_fk"
            columns: ["user_id", "target_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "agent_proposals_owned_type_fk"
            columns: ["user_id", "entity_type_id"]
            isOneToOne: false
            referencedRelation: "entity_types"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "agent_proposals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commitments: {
        Row: {
          action: string
          completed_at: string | null
          created_at: string
          due_on: string
          entity_id: string
          id: string
          kind: string
          origin_source: string
          outcome: string | null
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action: string
          completed_at?: string | null
          created_at?: string
          due_on: string
          entity_id: string
          id?: string
          kind: string
          origin_source: string
          outcome?: string | null
          state?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action?: string
          completed_at?: string | null
          created_at?: string
          due_on?: string
          entity_id?: string
          id?: string
          kind?: string
          origin_source?: string
          outcome?: string | null
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commitments_owned_entity_fk"
            columns: ["user_id", "entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "commitments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_logs: {
        Row: {
          created_at: string
          day: string
          diet: string | null
          dsa_minutes: number
          gym: boolean
          id: string
          job_hunt_minutes: number
          math_minutes: number
          meditation: boolean
          node_minutes: number
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day: string
          diet?: string | null
          dsa_minutes?: number
          gym?: boolean
          id?: string
          job_hunt_minutes?: number
          math_minutes?: number
          meditation?: boolean
          node_minutes?: number
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          diet?: string | null
          dsa_minutes?: number
          gym?: boolean
          id?: string
          job_hunt_minutes?: number
          math_minutes?: number
          meditation?: boolean
          node_minutes?: number
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      edge_rate_limits: {
        Row: {
          bucket: string
          request_count: number
          user_id: string
          window_started_at: string
        }
        Insert: {
          bucket: string
          request_count?: number
          user_id: string
          window_started_at?: string
        }
        Update: {
          bucket?: string
          request_count?: number
          user_id?: string
          window_started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "edge_rate_limits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      entities: {
        Row: {
          archived_at: string | null
          created_at: string
          entity_type_id: string
          fields: Json
          id: string
          schema_version: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          entity_type_id: string
          fields?: Json
          id?: string
          schema_version: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          entity_type_id?: string
          fields?: Json
          id?: string
          schema_version?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entities_owned_type_fk"
            columns: ["user_id", "entity_type_id"]
            isOneToOne: false
            referencedRelation: "entity_types"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "entities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_types: {
        Row: {
          allowed_commitment_kinds: string[]
          created_at: string
          default_sort_direction: string
          default_sort_field: string
          field_schema: Json
          group_by_field: string | null
          icon_key: string
          id: string
          is_active: boolean
          plugin_key: string | null
          plural_name: string
          schema_version: number
          singular_name: string
          type_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed_commitment_kinds?: string[]
          created_at?: string
          default_sort_direction?: string
          default_sort_field?: string
          field_schema?: Json
          group_by_field?: string | null
          icon_key?: string
          id?: string
          is_active?: boolean
          plugin_key?: string | null
          plural_name: string
          schema_version?: number
          singular_name: string
          type_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed_commitment_kinds?: string[]
          created_at?: string
          default_sort_direction?: string
          default_sort_field?: string
          field_schema?: Json
          group_by_field?: string | null
          icon_key?: string
          id?: string
          is_active?: boolean
          plugin_key?: string | null
          plural_name?: string
          schema_version?: number
          singular_name?: string
          type_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_types_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ideas: {
        Row: {
          created_at: string
          id: string
          idea: string
          monetization: string | null
          next_action: string | null
          problem: string | null
          status: string
          target_market: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          idea: string
          monetization?: string | null
          next_action?: string | null
          problem?: string | null
          status?: string
          target_market?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          idea?: string
          monetization?: string | null
          next_action?: string | null
          problem?: string | null
          status?: string
          target_market?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ideas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_accounts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          last_verified_at: string | null
          provider: string
          provider_account_id: string
          refresh_secret_id: string | null
          refresh_token_enc: string | null
          scopes: string[]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          last_verified_at?: string | null
          provider?: string
          provider_account_id: string
          refresh_secret_id?: string | null
          refresh_token_enc?: string | null
          scopes?: string[]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          last_verified_at?: string | null
          provider?: string
          provider_account_id?: string
          refresh_secret_id?: string | null
          refresh_token_enc?: string | null
          scopes?: string[]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_links: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          external_id: string
          external_type: string
          external_url: string | null
          fingerprint: string | null
          id: string
          idempotency_key: string
          last_synced_at: string
          provider: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          external_id: string
          external_type: string
          external_url?: string | null
          fingerprint?: string | null
          id?: string
          idempotency_key: string
          last_synced_at?: string
          provider?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          external_id?: string
          external_type?: string
          external_url?: string | null
          fingerprint?: string | null
          id?: string
          idempotency_key?: string
          last_synced_at?: string
          provider?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          applied_on: string | null
          channel: string
          company: string
          created_at: string
          ctc_lpa: number | null
          follow_up_on: string | null
          has_referral: boolean
          id: string
          job_url: string | null
          lane: string
          next_action: string | null
          notes: string | null
          referrer_id: string | null
          resume_drive_url: string | null
          resume_version: string | null
          role: string
          status: string
          updated_at: string
          user_id: string
          window_closes_on: string | null
        }
        Insert: {
          applied_on?: string | null
          channel: string
          company: string
          created_at?: string
          ctc_lpa?: number | null
          follow_up_on?: string | null
          has_referral?: boolean
          id?: string
          job_url?: string | null
          lane: string
          next_action?: string | null
          notes?: string | null
          referrer_id?: string | null
          resume_drive_url?: string | null
          resume_version?: string | null
          role: string
          status?: string
          updated_at?: string
          user_id: string
          window_closes_on?: string | null
        }
        Update: {
          applied_on?: string | null
          channel?: string
          company?: string
          created_at?: string
          ctc_lpa?: number | null
          follow_up_on?: string | null
          has_referral?: boolean
          id?: string
          job_url?: string | null
          lane?: string
          next_action?: string | null
          notes?: string | null
          referrer_id?: string | null
          resume_drive_url?: string | null
          resume_version?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
          window_closes_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_items: {
        Row: {
          concept: string
          confidence: number
          content_markdown: string | null
          created_at: string
          difficulty: string | null
          id: string
          item_type: string
          last_reviewed_on: string | null
          mastery_hits: number
          next_review_on: string | null
          source_url: string | null
          stack: string
          track: string
          updated_at: string
          user_id: string
        }
        Insert: {
          concept: string
          confidence?: number
          content_markdown?: string | null
          created_at?: string
          difficulty?: string | null
          id?: string
          item_type: string
          last_reviewed_on?: string | null
          mastery_hits?: number
          next_review_on?: string | null
          source_url?: string | null
          stack: string
          track: string
          updated_at?: string
          user_id: string
        }
        Update: {
          concept?: string
          confidence?: number
          content_markdown?: string | null
          created_at?: string
          difficulty?: string | null
          id?: string
          item_type?: string
          last_reviewed_on?: string | null
          mastery_hits?: number
          next_review_on?: string | null
          source_url?: string | null
          stack?: string
          track?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_audit_log: {
        Row: {
          client_id: string
          created_at: string
          duration_ms: number
          error_message: string | null
          id: string
          input_summary: Json
          success: boolean
          tool_name: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          duration_ms: number
          error_message?: string | null
          id?: string
          input_summary?: Json
          success: boolean
          tool_name: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          duration_ms?: number
          error_message?: string | null
          id?: string
          input_summary?: Json
          success?: boolean
          tool_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_states: {
        Row: {
          code_verifier: string
          created_at: string
          id: string
          state: string
          user_id: string
        }
        Insert: {
          code_verifier: string
          created_at?: string
          id?: string
          state: string
          user_id: string
        }
        Update: {
          code_verifier?: string
          created_at?: string
          id?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      owner_emails: {
        Row: {
          added_at: string
          email: string
        }
        Insert: {
          added_at?: string
          email: string
        }
        Update: {
          added_at?: string
          email?: string
        }
        Relationships: []
      }
      people: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          how_known: string | null
          id: string
          last_contacted_on: string | null
          linkedin_url: string | null
          name: string
          next_follow_up_on: string | null
          notes: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          how_known?: string | null
          id?: string
          last_contacted_on?: string | null
          linkedin_url?: string | null
          name: string
          next_follow_up_on?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          how_known?: string | null
          id?: string
          last_contacted_on?: string | null
          linkedin_url?: string | null
          name?: string
          next_follow_up_on?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          timezone: string
          updated_at: string
          week_starts_on: number
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          timezone?: string
          updated_at?: string
          week_starts_on?: number
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          timezone?: string
          updated_at?: string
          week_starts_on?: number
        }
        Relationships: []
      }
      projects: {
        Row: {
          amount: number | null
          client: string | null
          content_markdown: string | null
          created_at: string
          currency: string
          deadline_on: string | null
          demo_url: string | null
          drive_folder_url: string | null
          id: string
          is_public: boolean
          name: string
          next_action: string | null
          payment_status: string
          project_type: string
          repo_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          client?: string | null
          content_markdown?: string | null
          created_at?: string
          currency?: string
          deadline_on?: string | null
          demo_url?: string | null
          drive_folder_url?: string | null
          id?: string
          is_public?: boolean
          name: string
          next_action?: string | null
          payment_status?: string
          project_type: string
          repo_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          client?: string | null
          content_markdown?: string | null
          created_at?: string
          currency?: string
          deadline_on?: string | null
          demo_url?: string | null
          drive_folder_url?: string | null
          id?: string
          is_public?: boolean
          name?: string
          next_action?: string | null
          payment_status?: string
          project_type?: string
          repo_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          dsa_floor_minutes: number
          dsa_weekly_minutes: number
          job_hunt_floor_minutes: number
          job_hunt_weekly_minutes: number
          math_floor_minutes: number
          math_weekly_minutes: number
          node_floor_minutes: number
          node_weekly_minutes: number
          theme: string
          updated_at: string
          user_id: string
          weekly_application_target: number
          weekly_people_contact_target: number
        }
        Insert: {
          dsa_floor_minutes?: number
          dsa_weekly_minutes?: number
          job_hunt_floor_minutes?: number
          job_hunt_weekly_minutes?: number
          math_floor_minutes?: number
          math_weekly_minutes?: number
          node_floor_minutes?: number
          node_weekly_minutes?: number
          theme?: string
          updated_at?: string
          user_id: string
          weekly_application_target?: number
          weekly_people_contact_target?: number
        }
        Update: {
          dsa_floor_minutes?: number
          dsa_weekly_minutes?: number
          job_hunt_floor_minutes?: number
          job_hunt_weekly_minutes?: number
          math_floor_minutes?: number
          math_weekly_minutes?: number
          node_floor_minutes?: number
          node_weekly_minutes?: number
          theme?: string
          updated_at?: string
          user_id?: string
          weekly_application_target?: number
          weekly_people_contact_target?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v3_legacy_commitment_map: {
        Row: {
          commitment_id: string
          created_at: string
          source_field: string
          source_id: string
          source_table: string
          user_id: string
        }
        Insert: {
          commitment_id: string
          created_at?: string
          source_field: string
          source_id: string
          source_table: string
          user_id: string
        }
        Update: {
          commitment_id?: string
          created_at?: string
          source_field?: string
          source_id?: string
          source_table?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v3_legacy_commitment_map_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v3_legacy_entity_map: {
        Row: {
          created_at: string
          entity_id: string
          source_id: string
          source_table: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          source_id: string
          source_table: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          source_id?: string
          source_table?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v3_legacy_entity_map_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_edge_rate_limit: {
        Args: {
          p_bucket: string
          p_limit: number
          p_user_id: string
          p_window_seconds: number
        }
        Returns: boolean
      }
      create_agent_proposal: {
        Args: {
          p_client_id: string
          p_commitment_payload: Json
          p_entity_payload: Json
          p_entity_type_id: string
          p_expires_at?: string
          p_idempotency_key: string
          p_operation: string
          p_target_commitment_id: string
          p_target_entity_id: string
          p_user_id: string
        }
        Returns: Json
      }
      decide_agent_proposal: {
        Args: {
          p_commitment_payload?: Json
          p_decision: string
          p_decision_note?: string
          p_entity_payload?: Json
          p_proposal_id: string
        }
        Returns: Json
      }
      get_v3_due: {
        Args: {
          p_day?: string
          p_limit?: number
          p_offset?: number
          p_type_key?: string
          p_window?: string
        }
        Returns: {
          action: string
          commitment_id: string
          due_on: string
          due_status: string
          entity_id: string
          entity_title: string
          entity_type_id: string
          kind: string
          origin_source: string
          state: string
          type_key: string
        }[]
      }
      get_v3_readiness_inputs: {
        Args: { p_from: string; p_limit?: number; p_to: string }
        Returns: {
          distinct_entity_count: number
          entity_type_key: string
          event_count: number
          event_type: string
        }[]
      }
      get_v3_today: {
        Args: { p_day?: string; p_limit?: number }
        Returns: Json
      }
      get_v3_week: { Args: { p_week_start?: string }; Returns: Json }
      search_command: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          detail: string
          due_on: string
          entity_id: string
          entity_type: string
          status: string
          title: string
        }[]
      }
      seed_default_entity_types: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      v3_default_entity_type_definitions: {
        Args: never
        Returns: {
          allowed_commitment_kinds: string[]
          default_sort_direction: string
          default_sort_field: string
          field_schema: Json
          group_by_field: string
          icon_key: string
          plugin_key: string
          plural_name: string
          singular_name: string
          type_key: string
        }[]
      }
      v3_migration_backfill: { Args: { p_user_id?: string }; Returns: Json }
      v3_migration_calendar_report: {
        Args: { p_user_id: string }
        Returns: {
          pending: number
          relinkable: number
          relinked: number
        }[]
      }
      v3_migration_compatibility_json: {
        Args: { p_user_id: string }
        Returns: Json
      }
      v3_migration_csv: {
        Args: { p_side: string; p_source_table: string; p_user_id: string }
        Returns: string
      }
      v3_migration_csv_escape: { Args: { p_value: string }; Returns: string }
      v3_migration_legacy_json: { Args: { p_user_id: string }; Returns: Json }
      v3_migration_preflight: {
        Args: { p_user_id: string }
        Returns: {
          issue: string
          source_id: string
          source_table: string
        }[]
      }
      v3_migration_report: {
        Args: { p_user_id: string }
        Returns: {
          calendar_links_pending: number
          calendar_links_relinked: number
          compatibility_rows: number
          mapped_commitments: number
          mapped_entities: number
          migration_events: number
          source_rows: number
          source_table: string
        }[]
      }
      valid_activity_payload: { Args: { p_payload: Json }; Returns: boolean }
      valid_agent_proposal_payload: {
        Args: {
          p_commitment_payload: Json
          p_entity_payload: Json
          p_entity_type_id: string
          p_operation: string
          p_target_commitment_id: string
          p_target_entity_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      valid_entity_field_schema: { Args: { p_schema: Json }; Returns: boolean }
      valid_entity_fields: {
        Args: { p_fields: Json; p_schema: Json }
        Returns: boolean
      }
      valid_entity_type_definition: {
        Args: {
          p_commitment_kinds: string[]
          p_default_sort_field: string
          p_group_by_field: string
          p_schema: Json
        }
        Returns: boolean
      }
      write_v3_commitment: {
        Args: {
          p_action: string
          p_completed_at: string
          p_due_on: string
          p_entity_id: string
          p_id: string
          p_idempotency_key: string
          p_kind: string
          p_outcome: string
          p_state: string
        }
        Returns: Json
      }
      write_v3_entity: {
        Args: {
          p_archived_at: string
          p_entity_type_id: string
          p_fields: Json
          p_id: string
          p_idempotency_key: string
          p_schema_version: number
          p_title: string
        }
        Returns: Json
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
