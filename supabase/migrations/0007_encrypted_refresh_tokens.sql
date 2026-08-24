-- Command — self-managed encrypted OAuth tokens
-- Hosted PostgREST does not expose the vault schema, so supabase-js vault
-- calls fail in edge functions. The Google refresh token now lives here,
-- AES-256-GCM encrypted with a key held only as an edge-function secret.

alter table public.integration_accounts
  add column if not exists refresh_token_enc text;
