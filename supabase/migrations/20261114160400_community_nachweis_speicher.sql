-- MalerTreff: privater Speicher für Nachweise, Berechtigungen – 14.11.2026
-- Nur die Moderation kann Nachweise ansehen. 30 Tage nach der Entscheidung löscht die tägliche Prüfung (deletion-check) die Datei.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-proofs', 'community-proofs', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

drop policy if exists community_proof_insert on storage.objects;
create policy community_proof_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'community-proofs' and (storage.foldername(name))[1] = auth.uid()::text
              and exists (select 1 from public.community_members m where m.auth_user_id = auth.uid() and m.status = 'wartet'
                            and m.kind in ('betrieb', 'zulieferer') and m.app_user_id is null));
drop policy if exists community_proof_select on storage.objects;
create policy community_proof_select on storage.objects for select to authenticated
  using (bucket_id = 'community-proofs' and public.community_is_mod());
drop policy if exists community_proof_delete on storage.objects;
create policy community_proof_delete on storage.objects for delete to authenticated
  using (bucket_id = 'community-proofs' and public.community_is_mod());

do $$
declare f text;
begin
  execute 'revoke all on function public.community_join_external(text) from public, anon, authenticated';
  execute 'revoke all on function public.community_signup_open() from public';
  execute 'grant execute on function public.community_signup_open() to anon, authenticated';
  execute 'revoke all on function public.community_public_info() from public';
  execute 'grant execute on function public.community_public_info() to anon, authenticated';
  foreach f in array array[
    'community_enabled_for_me()', 'community_access()', 'community_join(text)', 'community_external_set(boolean)',
    'community_proof_submit(text)', 'community_verify_list()', 'community_verify_decide(bigint, boolean, text)',
    'community_profile_links(text, text)', 'community_profile(bigint)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
