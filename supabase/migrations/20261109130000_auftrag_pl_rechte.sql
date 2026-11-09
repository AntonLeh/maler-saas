-- Aufträge: Projektleiter dürfen nur IHRE Aufträge ändern/löschen und dort Mitarbeiter zuteilen (09.11.2026)
-- „Seine“ Aufträge = als Projektleiter eingetragen, als Projektleiter zugeteilt oder selbst angelegt.
-- Inhaber/Admin (Rolle 1/2) dürfen weiterhin alles in ihrer Firma. Lesen bleibt unverändert.

create or replace function public.pm_can_manage_order(p_order_id bigint)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and o.tenant_id = public.current_tenant_id()
      and (
        public.current_role_id() in (1, 2)
        or (
          public.current_role_id() = 3
          and (
            o.assigned_project_manager_id = public.current_app_user_id()
            or o.created_by = public.current_app_user_id()
            or exists (
              select 1
              from public.order_assignments oa
              where oa.order_id = o.id
                and oa.tenant_id = o.tenant_id
                and oa.user_id = public.current_app_user_id()
                and oa.assignment_role = 'project_manager'
            )
          )
        )
      )
  )
$function$;

revoke all on function public.pm_can_manage_order(bigint) from public, anon;
grant execute on function public.pm_can_manage_order(bigint) to authenticated;

-- Aufträge ändern / löschen
drop policy if exists orders_admin_pm_update on public.orders;
create policy orders_admin_pm_update on public.orders for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.pm_can_manage_order(id))
  with check (tenant_id = public.current_tenant_id() and public.current_role_id() in (1, 2, 3));

drop policy if exists orders_admin_pm_delete on public.orders;
create policy orders_admin_pm_delete on public.orders for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.pm_can_manage_order(id));

-- Zuteilungen anlegen / ändern / löschen
drop policy if exists order_assignments_insert on public.order_assignments;
create policy order_assignments_insert on public.order_assignments for insert to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and public.current_role_id() in (1, 2, 3)
    and public.pm_can_manage_order(order_id)
    and exists (
      select 1 from public.app_users au
      where au.id = order_assignments.user_id and au.tenant_id = order_assignments.tenant_id
    )
  );

drop policy if exists order_assignments_update on public.order_assignments;
create policy order_assignments_update on public.order_assignments for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.pm_can_manage_order(order_id))
  with check (
    tenant_id = public.current_tenant_id()
    and public.pm_can_manage_order(order_id)
    and exists (
      select 1 from public.app_users au
      where au.id = order_assignments.user_id and au.tenant_id = order_assignments.tenant_id
    )
  );

drop policy if exists order_assignments_delete on public.order_assignments;
create policy order_assignments_delete on public.order_assignments for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.pm_can_manage_order(order_id));
