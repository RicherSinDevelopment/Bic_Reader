-- Keep policy-only privilege elevation outside the Data API surface.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.has_active_premium()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.premium_entitlements
    where user_id = (select auth.uid())
      and is_active
      and (expires_at is null or expires_at > pg_catalog.timezone('utc', now()))
  );
$$;

revoke all on function private.has_active_premium() from public, anon;
grant execute on function private.has_active_premium() to authenticated;

-- Preserve the old signature for deployed clients while preventing callers
-- from probing another user's entitlement. This wrapper has no elevated role.
create or replace function public.has_active_premium(check_user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select check_user_id = (select auth.uid())
    and (select private.has_active_premium());
$$;

revoke all on function public.has_active_premium(uuid) from public, anon;
grant execute on function public.has_active_premium(uuid) to authenticated;

drop policy if exists "Premium users manage their PDF metadata" on public.cloud_pdf_documents;
create policy "Premium users manage their PDF metadata"
on public.cloud_pdf_documents for all to authenticated
using (
  (select auth.uid()) = user_id
  and (select private.has_active_premium())
)
with check (
  (select auth.uid()) = user_id
  and storage_path like ((select auth.uid())::text || '/%')
  and (select private.has_active_premium())
);

drop policy if exists "Premium users manage their annotations" on public.cloud_reader_annotations;
create policy "Premium users manage their annotations"
on public.cloud_reader_annotations for all to authenticated
using ((select auth.uid()) = user_id and (select private.has_active_premium()))
with check ((select auth.uid()) = user_id and (select private.has_active_premium()));

drop policy if exists "Premium users manage their settings" on public.cloud_user_settings;
create policy "Premium users manage their settings"
on public.cloud_user_settings for all to authenticated
using ((select auth.uid()) = user_id and (select private.has_active_premium()))
with check ((select auth.uid()) = user_id and (select private.has_active_premium()));

drop policy if exists "Premium users manage their reading positions" on public.cloud_reader_positions;
create policy "Premium users manage their reading positions"
on public.cloud_reader_positions for all to authenticated
using ((select auth.uid()) = user_id and (select private.has_active_premium()))
with check ((select auth.uid()) = user_id and (select private.has_active_premium()));

drop policy if exists "Premium users read their PDF files" on storage.objects;
create policy "Premium users read their PDF files"
on storage.objects for select to authenticated
using (
  bucket_id = 'premium-pdfs'
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select private.has_active_premium())
);

drop policy if exists "Premium users upload their PDF files" on storage.objects;
create policy "Premium users upload their PDF files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'premium-pdfs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select private.has_active_premium())
);

drop policy if exists "Premium users update their PDF files" on storage.objects;
create policy "Premium users update their PDF files"
on storage.objects for update to authenticated
using (
  bucket_id = 'premium-pdfs'
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select private.has_active_premium())
)
with check (
  bucket_id = 'premium-pdfs'
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select private.has_active_premium())
);

drop policy if exists "Premium users delete their PDF files" on storage.objects;
create policy "Premium users delete their PDF files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'premium-pdfs'
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select private.has_active_premium())
);

-- Bound user-controlled values to prevent oversized rows and invalid geometry.
alter table public.cloud_pdf_documents
  add constraint cloud_pdf_documents_id_length check (char_length(id) between 1 and 200),
  add constraint cloud_pdf_documents_names_length check (
    char_length(display_name) between 1 and 500
    and char_length(normalized_name) between 1 and 500
    and char_length(original_name) between 1 and 500
  ),
  add constraint cloud_pdf_documents_owned_storage_path check (
    char_length(storage_path) between 38 and 550
    and storage_path like (user_id::text || '/%')
    and storage_path !~ '(^|/)[.]{1,2}($|/)'
    and storage_path !~ E'\\\\'
  ),
  add constraint cloud_pdf_documents_file_size check (
    file_size is null or file_size between 0 and 104857600
  ),
  add constraint cloud_pdf_documents_mime_type check (
    mime_type is null or mime_type = 'application/pdf'
  ),
  add constraint cloud_pdf_documents_progress check (
    current_page >= 0
    and (total_pages is null or total_pages >= 0)
    and completion_percentage between 0 and 100
  );

alter table public.cloud_reader_annotations
  add constraint cloud_reader_annotations_text_lengths check (
    char_length(id) between 1 and 200
    and char_length(annotation_id) between 1 and 200
    and char_length(pdf_id) between 1 and 200
    and char_length(scope) between 1 and 50
    and char_length(block_id) between 1 and 250
    and (color is null or char_length(color) <= 50)
    and (note_text is null or char_length(note_text) <= 20000)
  ),
  add constraint cloud_reader_annotations_offsets check (
    start_offset >= 0 and text_length >= 0
  );

alter table public.cloud_reader_positions
  add constraint cloud_reader_positions_geometry check (
    char_length(pdf_id) between 1 and 200
    and (source_block_id is null or char_length(source_block_id) <= 250)
    and (word_index is null or word_index >= 0)
    and (character_offset is null or character_offset >= 0)
    and (block_progress is null or block_progress between 0 and 1)
    and revision >= 1
  );

alter table public.cloud_user_settings
  add constraint cloud_user_settings_size check (pg_column_size(reader_settings) <= 65536);

-- RevenueCat retries reuse the event ID. Serialize events per user and refuse
-- to let an older delivery overwrite a newer entitlement decision.
alter table public.premium_entitlements
  add column if not exists last_event_timestamp_ms bigint not null default 0,
  add column if not exists last_event_id text;

create table if not exists public.revenuecat_webhook_events (
  id text primary key check (char_length(id) between 1 and 200),
  event_timestamp_ms bigint not null check (event_timestamp_ms > 0),
  user_id uuid not null references auth.users(id) on delete cascade,
  received_at timestamptz not null default pg_catalog.timezone('utc', now())
);

create index if not exists revenuecat_webhook_events_user_timestamp
on public.revenuecat_webhook_events (user_id, event_timestamp_ms desc);

alter table public.revenuecat_webhook_events enable row level security;
revoke all on table public.revenuecat_webhook_events from public, anon, authenticated;
grant all on table public.revenuecat_webhook_events to service_role;

create or replace function public.apply_revenuecat_entitlement(
  p_event_id text,
  p_event_timestamp_ms bigint,
  p_user_id uuid,
  p_entitlement_id text,
  p_is_active boolean,
  p_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
  applied_count integer;
begin
  if p_event_id is null or char_length(p_event_id) not between 1 and 200
    or p_event_timestamp_ms <= 0
    or p_user_id is null
    or p_entitlement_id is null or char_length(p_entitlement_id) not between 1 and 100 then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 77139)
  );

  insert into public.revenuecat_webhook_events (id, event_timestamp_ms, user_id)
  values (p_event_id, p_event_timestamp_ms, p_user_id)
  on conflict (id) do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then return false; end if;

  insert into public.premium_entitlements (
    user_id, entitlement_id, is_active, expires_at, updated_at,
    last_event_timestamp_ms, last_event_id
  ) values (
    p_user_id, p_entitlement_id, p_is_active, p_expires_at,
    pg_catalog.timezone('utc', now()), p_event_timestamp_ms, p_event_id
  )
  on conflict (user_id) do update set
    entitlement_id = excluded.entitlement_id,
    is_active = excluded.is_active,
    expires_at = excluded.expires_at,
    updated_at = excluded.updated_at,
    last_event_timestamp_ms = excluded.last_event_timestamp_ms,
    last_event_id = excluded.last_event_id
  where public.premium_entitlements.last_event_timestamp_ms <= excluded.last_event_timestamp_ms;
  get diagnostics applied_count = row_count;
  return applied_count > 0;
end;
$$;

revoke all on function public.apply_revenuecat_entitlement(text, bigint, uuid, text, boolean, timestamptz)
from public, anon, authenticated;
grant execute on function public.apply_revenuecat_entitlement(text, bigint, uuid, text, boolean, timestamptz)
to service_role;

-- New public-schema functions are private until explicitly granted.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
