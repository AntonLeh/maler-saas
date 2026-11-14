-- Einstellungen: Zusatzpositionen neu anlegen und löschen (nur Chef des eigenen Betriebs) – 14.11.2026
-- Ändern und Lesen gab es schon; hier kommen nur die Rechte zum Anlegen und Löschen dazu.

drop policy if exists additional_quote_positions_admin_insert on public.additional_quote_positions;
create policy additional_quote_positions_admin_insert on public.additional_quote_positions
  for insert to authenticated
  with check (tenant_id = public.current_tenant_id() and public.current_role_id() = 2);

drop policy if exists additional_quote_positions_admin_delete on public.additional_quote_positions;
create policy additional_quote_positions_admin_delete on public.additional_quote_positions
  for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.current_role_id() = 2);
