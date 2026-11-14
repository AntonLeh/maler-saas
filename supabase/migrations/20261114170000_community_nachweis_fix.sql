-- MalerTreff: Upload-Regel für Nachweise reparieren – 14.11.2026
-- Die Regel las die Mitgliedertabelle direkt; die ist für Nutzer gesperrt (RLS). Jetzt prüft eine Funktion mit Server-Rechten.

create or replace function public.community_can_submit_proof()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.community_members m
                 where m.auth_user_id = auth.uid() and m.status = 'wartet'
                   and m.kind in ('betrieb', 'zulieferer') and m.app_user_id is null);
$$;
revoke all on function public.community_can_submit_proof() from public, anon;
grant execute on function public.community_can_submit_proof() to authenticated;

drop policy if exists community_proof_insert on storage.objects;
create policy community_proof_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'community-proofs' and (storage.foldername(name))[1] = auth.uid()::text
              and public.community_can_submit_proof());
