create table if not exists public.cloud_reader_positions (
  user_id uuid not null references auth.users (id) on delete cascade,
  pdf_id text not null,
  source_page integer not null check (source_page >= 1),
  source_block_id text,
  word_index integer,
  character_offset integer,
  block_progress double precision,
  revision integer not null default 1,
  updated_at timestamptz not null,
  primary key (user_id, pdf_id),
  foreign key (user_id, pdf_id)
    references public.cloud_pdf_documents (user_id, id) on delete cascade
);

alter table public.cloud_reader_positions enable row level security;

revoke all on table public.cloud_reader_positions from anon, authenticated;
grant select, insert, update, delete on table public.cloud_reader_positions to authenticated;
grant all on table public.cloud_reader_positions to service_role;

create policy "Premium users manage their reading positions"
on public.cloud_reader_positions for all to authenticated
using (
  (select auth.uid()) = user_id
  and public.has_active_premium((select auth.uid()))
)
with check (
  (select auth.uid()) = user_id
  and public.has_active_premium((select auth.uid()))
);
