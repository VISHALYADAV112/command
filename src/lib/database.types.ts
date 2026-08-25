// Database contract (snake_case), kept in generated Supabase shape. Regenerate
// this file after migrations with `npm run db:types`.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

interface Timestamps {
  created_at: string
  updated_at: string
}

export interface DbProfile {
  id: string
  email: string
  display_name: string | null
  timezone: string
  week_starts_on: number
}

export interface DbUserSettings {
  user_id: string
  node_floor_minutes: number
  dsa_floor_minutes: number
  math_floor_minutes: number
  job_hunt_floor_minutes: number
  node_weekly_minutes: number
  dsa_weekly_minutes: number
  math_weekly_minutes: number
  job_hunt_weekly_minutes: number
  theme: string
}

export interface DbDailyLog {
  id: string
  day: string // YYYY-MM-DD
  meditation: boolean
  gym: boolean
  diet: 'on_track' | 'loose' | 'off' | null
  node_minutes: number
  dsa_minutes: number
  math_minutes: number
  job_hunt_minutes: number
  note: string | null
}

export interface DbLearningItem {
  id: string
  concept: string
  stack: 'job' | 'brain'
  track: 'node' | 'dsa' | 'math'
  item_type: 'concept' | 'pattern' | 'snippet' | 'formula'
  confidence: number
  difficulty: 'easy' | 'medium' | 'hard' | null
  next_review_on: string | null
  last_reviewed_on: string | null
  mastery_hits: number
  source_url: string | null
  content_markdown: string | null
}

export interface DbPerson {
  id: string
  name: string
  company: string | null
  email: string | null
  linkedin_url: string | null
  how_known: 'cold' | 'alumni' | 'linkedin' | 'ex_colleague' | 'referred_by' | null
  status: 'to_reach_out' | 'talking' | 'referred' | 'cold'
  last_contacted_on: string | null
  next_follow_up_on: string | null
  notes: string | null
}

export interface DbJobApplication {
  id: string
  company: string
  role: string
  lane: 'sde' | 'ai_ml'
  channel: 'india_product' | 'gcc' | 'remote_intl' | 'services'
  status: 'researching' | 'applied' | 'oa' | 'phone' | 'onsite' | 'offer' | 'rejected'
  applied_on: string | null
  has_referral: boolean
  referrer_id: string | null
  ctc_lpa: number | null
  next_action: string | null
  follow_up_on: string | null
  window_closes_on: string | null
  job_url: string | null
  resume_version: string | null
  resume_drive_url: string | null
  notes: string | null
}

export interface DbProject {
  id: string
  name: string
  project_type: 'internship' | 'freelance' | 'portfolio'
  status: 'active' | 'blocked' | 'review' | 'done'
  client: string | null
  payment_status: 'na' | 'unpaid' | 'invoiced' | 'paid'
  amount: number | null
  currency: string
  is_public: boolean
  deadline_on: string | null
  repo_url: string | null
  demo_url: string | null
  drive_folder_url: string | null
  next_action: string | null
  content_markdown: string | null
}

export interface DbIdea {
  id: string
  idea: string
  problem: string | null
  target_market: string | null
  monetization: string | null
  status: 'captured' | 'exploring' | 'validating' | 'dropped'
  next_action: string | null
}

type Table<Row, Insert = Partial<Row>, Update = Partial<Insert>> = {
  Row: { [Key in keyof Row]: Row[Key] }
  Insert: { [Key in keyof Insert]: Insert[Key] }
  Update: { [Key in keyof Update]: Update[Key] }
  Relationships: []
}

type Owned<Row> = Row & { user_id: string } & Timestamps

export interface Database {
  public: {
    Tables: {
      profiles: Table<DbProfile & Timestamps>
      user_settings: Table<DbUserSettings & { updated_at: string }>
      daily_logs: Table<Owned<DbDailyLog>>
      learning_items: Table<Owned<DbLearningItem>>
      people: Table<Owned<DbPerson>>
      job_applications: Table<Owned<DbJobApplication>>
      projects: Table<Owned<DbProject>>
      ideas: Table<Owned<DbIdea>>
      integration_accounts: Table<{
        id: string
        user_id: string
        provider: string
        provider_account_id: string
        email: string | null
        scopes: string[]
        refresh_secret_id: string | null
        refresh_token_enc: string | null
        status: 'connected' | 'expired' | 'revoked' | 'error'
        last_verified_at: string | null
      } & Timestamps>
      integration_links: Table<{
        id: string
        user_id: string
        provider: string
        entity_type: string
        entity_id: string
        external_type: 'calendar_event' | 'task' | 'contact' | 'drive_file'
        external_id: string
        external_url: string | null
        idempotency_key: string
        fingerprint: string | null
        last_synced_at: string
        created_at: string
      }>
      oauth_states: Table<{
        id: string
        state: string
        code_verifier: string
        user_id: string
        created_at: string
      }>
      owner_emails: Table<{ email: string; added_at: string }>
      edge_rate_limits: Table<{
        user_id: string
        bucket: string
        window_started_at: string
        request_count: number
      }>
      mcp_audit_log: Table<{
        id: string
        user_id: string
        client_id: string
        tool_name: string
        input_summary: Json
        success: boolean
        error_message: string | null
        duration_ms: number
        created_at: string
      }>
    }
    Views: { [_ in never]: never }
    Functions: {
      consume_edge_rate_limit: {
        Args: { p_user_id: string; p_bucket: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      search_command: {
        Args: { p_query: string; p_limit?: number }
        Returns: Array<{
          entity_type: string
          entity_id: string
          title: string
          detail: string | null
          status: string | null
          due_on: string | null
        }>
      }
      set_updated_at: { Args: never; Returns: unknown }
      validate_application_referrer: { Args: never; Returns: unknown }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
