-- Allow any authenticated user to delete incidents (app removed super_admin-only gate).
-- Also allow deleting documents rows owned by an incident (TR5/TR6/TR7 JSON) without vehicle/employee doc roles.

DROP POLICY IF EXISTS "rbac_incidents_delete" ON public.incidents;
CREATE POLICY "rbac_incidents_delete" ON public.incidents
  FOR DELETE TO authenticated
  USING (true);

DROP POLICY IF EXISTS "rbac_incident_party_delete" ON public.incident_party_entries;
CREATE POLICY "rbac_incident_party_delete" ON public.incident_party_entries
  FOR DELETE TO authenticated
  USING (true);

DROP POLICY IF EXISTS "rbac_documents_delete" ON public.documents;
CREATE POLICY "rbac_documents_delete" ON public.documents
  FOR DELETE TO authenticated
  USING (
    auth_has_any_permission(ARRAY['vehicle_documents.write', 'employee_documents.write'])
    OR (owner_type = 'incident' AND owner_id IS NOT NULL)
  );
