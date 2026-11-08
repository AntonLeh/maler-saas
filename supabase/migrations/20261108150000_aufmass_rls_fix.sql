-- =====================================================================
-- Aufmaß-Entwürfe der Projektleiter: Zugriffsregeln korrigieren
-- Bisher stand dort u. a. "sv.tenant_id = sv.tenant_id" (immer wahr). Jetzt wird verglichen,
-- dass Besichtigung, Raum und Kunde wirklich zur selben Firma bzw. Besichtigung gehören.
-- Inhaltlich sonst unverändert (nur Projektleiter, nur eigene Entwürfe). Kann mehrfach ausgeführt werden.
-- =====================================================================


-- Besichtigung selbst
drop policy if exists site_visits_project_manager_drafts on public.site_visits;
create policy site_visits_project_manager_drafts on public.site_visits for all
  using (tenant_id = current_tenant_id() and current_role_id() = 3 and measured_by = current_app_user_id() and assigned_project_manager_id = current_app_user_id() and status = 'draft')
  with check (tenant_id = current_tenant_id() and current_role_id() = 3 and measured_by = current_app_user_id() and assigned_project_manager_id = current_app_user_id() and status = 'draft'
    and exists (select 1 from public.customers c where c.id = site_visits.customer_id and c.tenant_id = site_visits.tenant_id));

-- site_visit_rooms
drop policy if exists site_visit_rooms_project_manager_drafts on public.site_visit_rooms;
create policy site_visit_rooms_project_manager_drafts on public.site_visit_rooms for all
  using (tenant_id = current_tenant_id() and current_role_id() = 3
    and exists (select 1 from public.site_visits sv
               where sv.id = site_visit_rooms.site_visit_id and sv.tenant_id = site_visit_rooms.tenant_id
                 and sv.measured_by = current_app_user_id() and sv.assigned_project_manager_id = current_app_user_id()
                 and sv.status = 'draft'))
  with check (tenant_id = current_tenant_id() and current_role_id() = 3
    and exists (select 1 from public.site_visits sv
               where sv.id = site_visit_rooms.site_visit_id and sv.tenant_id = site_visit_rooms.tenant_id
                 and sv.measured_by = current_app_user_id() and sv.assigned_project_manager_id = current_app_user_id()
                 and sv.status = 'draft'));

-- site_visit_custom_services
drop policy if exists site_visit_custom_services_project_manager_drafts on public.site_visit_custom_services;
create policy site_visit_custom_services_project_manager_drafts on public.site_visit_custom_services for all
  using (tenant_id = current_tenant_id() and current_role_id() = 3
    and exists (select 1 from public.site_visits sv
               where sv.id = site_visit_custom_services.site_visit_id and sv.tenant_id = site_visit_custom_services.tenant_id
                 and sv.measured_by = current_app_user_id() and sv.assigned_project_manager_id = current_app_user_id()
                 and sv.status = 'draft'))
  with check (tenant_id = current_tenant_id() and current_role_id() = 3
    and exists (select 1 from public.site_visits sv
               where sv.id = site_visit_custom_services.site_visit_id and sv.tenant_id = site_visit_custom_services.tenant_id
                 and sv.measured_by = current_app_user_id() and sv.assigned_project_manager_id = current_app_user_id()
                 and sv.status = 'draft'));

-- site_visit_windows
drop policy if exists site_visit_windows_project_manager_drafts on public.site_visit_windows;
create policy site_visit_windows_project_manager_drafts on public.site_visit_windows for all
  using (tenant_id = current_tenant_id() and current_role_id() = 3
    and exists (select 1 from public.site_visits sv
               where sv.id = site_visit_windows.site_visit_id and sv.tenant_id = site_visit_windows.tenant_id
                 and sv.measured_by = current_app_user_id() and sv.assigned_project_manager_id = current_app_user_id()
                 and sv.status = 'draft'))
  with check (tenant_id = current_tenant_id() and current_role_id() = 3
    and exists (select 1 from public.site_visits sv
               where sv.id = site_visit_windows.site_visit_id and sv.tenant_id = site_visit_windows.tenant_id
                 and sv.measured_by = current_app_user_id() and sv.assigned_project_manager_id = current_app_user_id()
                 and sv.status = 'draft')
    and (room_id is null or exists (select 1 from public.site_visit_rooms r
               where r.id = site_visit_windows.room_id and r.site_visit_id = site_visit_windows.site_visit_id and r.tenant_id = site_visit_windows.tenant_id)));

-- site_visit_doors
drop policy if exists site_visit_doors_project_manager_drafts on public.site_visit_doors;
create policy site_visit_doors_project_manager_drafts on public.site_visit_doors for all
  using (tenant_id = current_tenant_id() and current_role_id() = 3
    and exists (select 1 from public.site_visits sv
               where sv.id = site_visit_doors.site_visit_id and sv.tenant_id = site_visit_doors.tenant_id
                 and sv.measured_by = current_app_user_id() and sv.assigned_project_manager_id = current_app_user_id()
                 and sv.status = 'draft'))
  with check (tenant_id = current_tenant_id() and current_role_id() = 3
    and exists (select 1 from public.site_visits sv
               where sv.id = site_visit_doors.site_visit_id and sv.tenant_id = site_visit_doors.tenant_id
                 and sv.measured_by = current_app_user_id() and sv.assigned_project_manager_id = current_app_user_id()
                 and sv.status = 'draft')
    and (room_id is null or exists (select 1 from public.site_visit_rooms r
               where r.id = site_visit_doors.room_id and r.site_visit_id = site_visit_doors.site_visit_id and r.tenant_id = site_visit_doors.tenant_id)));

-- site_visit_radiators
drop policy if exists site_visit_radiators_project_manager_drafts on public.site_visit_radiators;
create policy site_visit_radiators_project_manager_drafts on public.site_visit_radiators for all
  using (tenant_id = current_tenant_id() and current_role_id() = 3
    and exists (select 1 from public.site_visits sv
               where sv.id = site_visit_radiators.site_visit_id and sv.tenant_id = site_visit_radiators.tenant_id
                 and sv.measured_by = current_app_user_id() and sv.assigned_project_manager_id = current_app_user_id()
                 and sv.status = 'draft'))
  with check (tenant_id = current_tenant_id() and current_role_id() = 3
    and exists (select 1 from public.site_visits sv
               where sv.id = site_visit_radiators.site_visit_id and sv.tenant_id = site_visit_radiators.tenant_id
                 and sv.measured_by = current_app_user_id() and sv.assigned_project_manager_id = current_app_user_id()
                 and sv.status = 'draft')
    and (room_id is null or exists (select 1 from public.site_visit_rooms r
               where r.id = site_visit_radiators.room_id and r.site_visit_id = site_visit_radiators.site_visit_id and r.tenant_id = site_visit_radiators.tenant_id)));

-- site_visit_images
drop policy if exists site_visit_images_project_manager_drafts on public.site_visit_images;
create policy site_visit_images_project_manager_drafts on public.site_visit_images for all
  using (tenant_id = current_tenant_id() and current_role_id() = 3
    and exists (select 1 from public.site_visits sv
               where sv.id = site_visit_images.site_visit_id and sv.tenant_id = site_visit_images.tenant_id
                 and sv.measured_by = current_app_user_id() and sv.assigned_project_manager_id = current_app_user_id()
                 and sv.status = 'draft'))
  with check (tenant_id = current_tenant_id() and current_role_id() = 3
    and exists (select 1 from public.site_visits sv
               where sv.id = site_visit_images.site_visit_id and sv.tenant_id = site_visit_images.tenant_id
                 and sv.measured_by = current_app_user_id() and sv.assigned_project_manager_id = current_app_user_id()
                 and sv.status = 'draft')
    and (room_temp_id is null or exists (select 1 from public.site_visit_rooms r
               where r.id = site_visit_images.room_temp_id and r.site_visit_id = site_visit_images.site_visit_id and r.tenant_id = site_visit_images.tenant_id)));
