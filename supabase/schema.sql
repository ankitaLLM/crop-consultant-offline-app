-- Run this file once in the Supabase SQL editor.
-- It stores only authenticated users' TerraSync mutable records.

create table if not exists public.sync_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('draft', 'observation')),
  entity_id text not null,
  payload jsonb not null,
  client_updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key (user_id, entity_type, entity_id)
);

create index if not exists sync_records_user_id_idx on public.sync_records(user_id);
alter table public.sync_records enable row level security;

revoke all on table public.sync_records from anon, authenticated;
grant select, insert, update, delete on table public.sync_records to authenticated;

drop policy if exists "users_select_own_sync_records" on public.sync_records;
create policy "users_select_own_sync_records" on public.sync_records for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "users_insert_own_sync_records" on public.sync_records;
create policy "users_insert_own_sync_records" on public.sync_records for insert to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "users_update_own_sync_records" on public.sync_records;
create policy "users_update_own_sync_records" on public.sync_records for update to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "users_delete_own_sync_records" on public.sync_records;
create policy "users_delete_own_sync_records" on public.sync_records for delete to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

-- Prevent a delayed/offline browser from overwriting a newer server version.
create or replace function public.terrasync_keep_newest_record()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.client_updated_at > new.client_updated_at then
    return old;
  end if;
  new.server_updated_at = now();
  return new;
end;
$$;

revoke all on function public.terrasync_keep_newest_record() from public;
drop trigger if exists terrasync_keep_newest_record on public.sync_records;
create trigger terrasync_keep_newest_record before update on public.sync_records
for each row execute function public.terrasync_keep_newest_record();
