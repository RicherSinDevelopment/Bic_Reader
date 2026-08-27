create table if not exists public.premium_entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  entitlement_id text not null default 'pro',
  is_active boolean not null default false,
  expires_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.premium_entitlements enable row level security;
revoke all on table public.premium_entitlements from anon, authenticated;
grant all on table public.premium_entitlements to service_role;

create or replace function public.has_active_premium(check_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.premium_entitlements
    where user_id = check_user_id
      and is_active
      and (expires_at is null or expires_at > timezone('utc', now()))
  );
$$;

revoke all on function public.has_active_premium(uuid) from public;
grant execute on function public.has_active_premium(uuid) to authenticated;

create table if not exists public.cloud_pdf_documents (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  display_name text not null,
  normalized_name text not null,
  original_name text not null,
  storage_path text not null,
  file_size bigint,
  mime_type text,
  added_at timestamptz not null,
  last_opened_at timestamptz not null,
  current_page integer not null default 0,
  total_pages integer,
  completion_percentage double precision not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id),
  unique (user_id, normalized_name),
  unique (storage_path)
);

create table if not exists public.cloud_reader_annotations (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  annotation_id text not null,
  pdf_id text not null,
  scope text not null,
  kind text not null check (kind in ('highlight', 'note')),
  block_id text not null,
  start_offset integer not null,
  text_length integer not null,
  color text,
  note_text text,
  created_at timestamptz not null,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id),
  foreign key (user_id, pdf_id)
    references public.cloud_pdf_documents (user_id, id) on delete cascade
);

create index if not exists cloud_reader_annotations_document_scope
on public.cloud_reader_annotations (user_id, pdf_id, scope);

create table if not exists public.cloud_user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reader_settings jsonb not null default '{}'::jsonb,
  appearance_preference text not null default 'system'
    check (appearance_preference in ('system', 'light', 'dark')),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.cloud_pdf_documents enable row level security;
alter table public.cloud_reader_annotations enable row level security;
alter table public.cloud_user_settings enable row level security;

revoke all on table public.cloud_pdf_documents from anon, authenticated;
revoke all on table public.cloud_reader_annotations from anon, authenticated;
revoke all on table public.cloud_user_settings from anon, authenticated;
grant select, insert, update, delete on table public.cloud_pdf_documents to authenticated;
grant select, insert, update, delete on table public.cloud_reader_annotations to authenticated;
grant select, insert, update, delete on table public.cloud_user_settings to authenticated;
grant all on table public.cloud_pdf_documents to service_role;
grant all on table public.cloud_reader_annotations to service_role;
grant all on table public.cloud_user_settings to service_role;

create policy "Premium users manage their PDF metadata"
on public.cloud_pdf_documents for all to authenticated
using ((select auth.uid()) = user_id and public.has_active_premium((select auth.uid())))
with check ((select auth.uid()) = user_id and public.has_active_premium((select auth.uid())));

create policy "Premium users manage their annotations"
on public.cloud_reader_annotations for all to authenticated
using ((select auth.uid()) = user_id and public.has_active_premium((select auth.uid())))
with check ((select auth.uid()) = user_id and public.has_active_premium((select auth.uid())));

create policy "Premium users manage their settings"
on public.cloud_user_settings for all to authenticated
using ((select auth.uid()) = user_id and public.has_active_premium((select auth.uid())))
with check ((select auth.uid()) = user_id and public.has_active_premium((select auth.uid())));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('premium-pdfs', 'premium-pdfs', false, 104857600, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Premium users read their PDF files"
on storage.objects for select to authenticated
using (
  bucket_id = 'premium-pdfs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.has_active_premium((select auth.uid()))
);

create policy "Premium users upload their PDF files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'premium-pdfs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.has_active_premium((select auth.uid()))
);

create policy "Premium users update their PDF files"
on storage.objects for update to authenticated
using (
  bucket_id = 'premium-pdfs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.has_active_premium((select auth.uid()))
)
with check (
  bucket_id = 'premium-pdfs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.has_active_premium((select auth.uid()))
);

create policy "Premium users delete their PDF files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'premium-pdfs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.has_active_premium((select auth.uid()))
);
