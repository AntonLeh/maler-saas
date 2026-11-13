-- Ratgeber: Titelbild je Artikel – 13.11.2026
-- Die Bildbibliothek bleibt privat; nur das Bild eines veröffentlichten Artikels liegt im öffentlichen Speicher „ratgeber“.

alter table public.owner_articles add column if not exists image_path text;
alter table public.owner_articles add column if not exists image_public text;
alter table public.owner_articles add column if not exists image_alt text;
alter table public.owner_articles add column if not exists image_ai_label boolean not null default false;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ratgeber', 'ratgeber', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists ratgeber_owner_insert on storage.objects;
create policy ratgeber_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'ratgeber' and public.current_role_id() = 1);
drop policy if exists ratgeber_owner_update on storage.objects;
create policy ratgeber_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'ratgeber' and public.current_role_id() = 1);
drop policy if exists ratgeber_owner_delete on storage.objects;
create policy ratgeber_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'ratgeber' and public.current_role_id() = 1);

-- Lesen (für „überschreiben“ beim erneuten Veröffentlichen nötig)
drop policy if exists ratgeber_owner_select on storage.objects;
create policy ratgeber_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'ratgeber' and public.current_role_id() = 1);
