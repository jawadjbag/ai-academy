-- JBI HUB — Exécuter dans Supabase > SQL Editor
-- 1. Créer un projet Supabase et exécuter CE fichier.
-- 2. Dans Authentication > Users : inviter les adresses de vos associés.
-- 3. Remplacer les exemples ci-dessous par vos véritables adresses.
-- 4. Dans la PWA : Paramètres > URL du projet et clé PUBLIQUE (anon / publishable).
-- Ne JAMAIS mettre la clé service_role ou la clé secrète dans la PWA ou GitHub.

create extension if not exists pgcrypto;

create table if not exists public.workspace_members (
  email text primary key
);
alter table public.workspace_members enable row level security;
-- Aucune politique sur workspace_members : seuls les administrateurs SQL y accèdent.
revoke all on public.workspace_members from anon, authenticated;

-- AJOUTER ICI les adresses e-mail explicitement autorisées :
-- insert into public.workspace_members(email)
-- values ('associe1@exemple.com'), ('associe2@exemple.com')
-- on conflict (email) do nothing;

create or replace function public.is_jbi_member()
returns boolean language sql stable security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.workspace_members m
    where lower(m.email) = lower(auth.jwt() ->> 'email')
  );
$$;
revoke all on function public.is_jbi_member() from public, anon;
grant execute on function public.is_jbi_member() to authenticated;

create table if not exists public.workspace_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('project', 'copy', 'task', 'vault')),
  project_id uuid null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workspace_items_by_project on public.workspace_items(project_id);
alter table public.workspace_items enable row level security;
revoke all on public.workspace_items from anon;
grant select, insert, update, delete on public.workspace_items to authenticated;

drop policy if exists "jbi_team_select" on public.workspace_items;
create policy "jbi_team_select" on public.workspace_items
for select to authenticated using (public.is_jbi_member());

drop policy if exists "jbi_team_insert" on public.workspace_items;
create policy "jbi_team_insert" on public.workspace_items
for insert to authenticated with check (public.is_jbi_member());

drop policy if exists "jbi_team_update" on public.workspace_items;
create policy "jbi_team_update" on public.workspace_items
for update to authenticated using (public.is_jbi_member())
with check (public.is_jbi_member());

drop policy if exists "jbi_team_delete" on public.workspace_items;
create policy "jbi_team_delete" on public.workspace_items
for delete to authenticated using (public.is_jbi_member());

-- Temps réel : permet de voir les changements de vos associés sans actualiser.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
  and not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
    and schemaname = 'public' and tablename = 'workspace_items') then
    alter publication supabase_realtime add table public.workspace_items;
  end if;
end $$;

-- Rappel important :
-- Tous les membres autorisés peuvent modifier/supprimer des projets.
-- Les mots de passe sont chiffrés dans le navigateur en AES-GCM avec
-- une phrase secrète partagée. Supabase ne reçoit pas les mots de passe en clair.
-- Utiliser un gestionnaire de mots de passe dédié pour les comptes critiques.
