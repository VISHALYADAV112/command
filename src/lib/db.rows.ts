import type { Database } from './database.types'

type Row<Table extends keyof Database['public']['Tables']> = Database['public']['Tables'][Table]['Row']
type OwnedBusinessRow<Table extends keyof Database['public']['Tables']> = Omit<
  Row<Table>, 'user_id' | 'created_at' | 'updated_at'
>

export type DbProfile = Omit<Row<'profiles'>, 'created_at' | 'updated_at'>
export type DbUserSettings = Omit<Row<'user_settings'>, 'updated_at'>
export type DbDailyLog = OwnedBusinessRow<'daily_logs'>
export type DbLearningItem = OwnedBusinessRow<'learning_items'>
export type DbPerson = OwnedBusinessRow<'people'>
export type DbJobApplication = OwnedBusinessRow<'job_applications'>
export type DbProject = OwnedBusinessRow<'projects'>
export type DbIdea = OwnedBusinessRow<'ideas'>
