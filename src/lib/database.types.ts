// Database row types (snake_case), mirroring supabase/migrations.
// In production these can be regenerated with `supabase gen types typescript`.

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
  referrer_id: string | null
  ctc_lpa: number | null
  next_action: string | null
  follow_up_on: string | null
  window_closes_on: string | null
  job_url: string | null
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