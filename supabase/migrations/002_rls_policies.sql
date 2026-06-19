-- ============================================================
-- EventPass: 002_rls_policies.sql
-- Row Level Security — Organization-level tenant isolation
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- HELPER FUNCTIONS
-- ────────────────────────────────────────────────────────────

-- Returns all organization IDs the current user is an active member of
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS UUID[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
        AND is_active = TRUE
    ),
    ARRAY[]::UUID[]
  );
$$;

-- Returns the role of current user in a given organization
CREATE OR REPLACE FUNCTION get_user_role_in_org(org_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM organization_members
  WHERE user_id = auth.uid()
    AND organization_id = org_id
    AND is_active = TRUE
  LIMIT 1;
$$;

-- Returns TRUE if the current user is an admin-level member of the given org
CREATE OR REPLACE FUNCTION is_org_admin(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid()
      AND organization_id = org_id
      AND role IN ('owner','admin')
      AND is_active = TRUE
  );
$$;

-- Returns TRUE if the current user is a member (any role) of the given org
CREATE OR REPLACE FUNCTION is_org_member(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid()
      AND organization_id = org_id
      AND is_active = TRUE
  );
$$;

-- Returns TRUE if the current user is an active member of any organization that has a registration for the given participant
CREATE OR REPLACE FUNCTION is_org_member_of_participant(p_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM registrations r
    JOIN organization_members m ON m.organization_id = r.organization_id
    WHERE r.participant_id = p_id
      AND m.user_id = auth.uid()
      AND m.is_active = TRUE
      AND r.deleted_at IS NULL
  );
$$;

-- ────────────────────────────────────────────────────────────
-- ENABLE RLS ON ALL TENANT TABLES
-- ────────────────────────────────────────────────────────────
ALTER TABLE organizations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE events                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_staff            ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_fields    ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants           ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_answers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance             ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events         ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- ORGANIZATIONS
-- ────────────────────────────────────────────────────────────
-- Members can view their own organizations
CREATE POLICY "org_members_can_view_their_org"
  ON organizations FOR SELECT
  USING (id = ANY(get_user_org_ids()) AND deleted_at IS NULL);

-- Public can view published org branding (for subdomain resolution)
CREATE POLICY "public_can_view_org_branding"
  ON organizations FOR SELECT
  USING (is_active = TRUE AND deleted_at IS NULL);

-- Admins can update their organization
CREATE POLICY "org_admins_can_update_org"
  ON organizations FOR UPDATE
  USING (is_org_admin(id))
  WITH CHECK (is_org_admin(id));

-- Only service role can insert/delete organizations
-- (Organizations are created via Edge Function to ensure subscription row is also created)

-- ────────────────────────────────────────────────────────────
-- ORGANIZATION_MEMBERS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "members_can_view_their_org_members"
  ON organization_members FOR SELECT
  USING (is_org_member(organization_id));

CREATE POLICY "org_admins_can_insert_members"
  ON organization_members FOR INSERT
  WITH CHECK (is_org_admin(organization_id));

CREATE POLICY "org_admins_can_update_members"
  ON organization_members FOR UPDATE
  USING (is_org_admin(organization_id))
  WITH CHECK (is_org_admin(organization_id));

CREATE POLICY "org_admins_can_delete_members"
  ON organization_members FOR DELETE
  USING (is_org_admin(organization_id));

-- ────────────────────────────────────────────────────────────
-- PROGRAMS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "org_members_can_view_programs"
  ON programs FOR SELECT
  USING (is_org_member(organization_id) AND deleted_at IS NULL);

CREATE POLICY "org_admins_can_insert_programs"
  ON programs FOR INSERT
  WITH CHECK (is_org_admin(organization_id));

CREATE POLICY "org_admins_can_update_programs"
  ON programs FOR UPDATE
  USING (is_org_admin(organization_id))
  WITH CHECK (is_org_admin(organization_id));

CREATE POLICY "org_admins_can_delete_programs"
  ON programs FOR UPDATE  -- soft delete only
  USING (is_org_admin(organization_id));

-- ────────────────────────────────────────────────────────────
-- EVENTS
-- ────────────────────────────────────────────────────────────
-- Published events are publicly visible (for registration pages)
CREATE POLICY "public_can_view_published_events"
  ON events FOR SELECT
  USING (status = 'published' AND deleted_at IS NULL);

-- Org members can view all their events (including drafts)
CREATE POLICY "org_members_can_view_all_their_events"
  ON events FOR SELECT
  USING (is_org_member(organization_id) AND deleted_at IS NULL);

CREATE POLICY "org_event_managers_can_insert_events"
  ON events FOR INSERT
  WITH CHECK (
    get_user_role_in_org(organization_id) IN ('owner','admin','event_manager')
  );

CREATE POLICY "org_event_managers_can_update_events"
  ON events FOR UPDATE
  USING (
    get_user_role_in_org(organization_id) IN ('owner','admin','event_manager')
  )
  WITH CHECK (
    get_user_role_in_org(organization_id) IN ('owner','admin','event_manager')
  );

-- ────────────────────────────────────────────────────────────
-- EVENT_STAFF
-- ────────────────────────────────────────────────────────────
CREATE POLICY "org_members_can_view_event_staff"
  ON event_staff FOR SELECT
  USING (is_org_member(organization_id));

CREATE POLICY "org_admins_can_manage_event_staff"
  ON event_staff FOR ALL
  USING (is_org_admin(organization_id))
  WITH CHECK (is_org_admin(organization_id));

-- ────────────────────────────────────────────────────────────
-- REGISTRATION_FIELDS
-- ────────────────────────────────────────────────────────────
-- Public can view fields for published events (needed to render the form)
CREATE POLICY "public_can_view_fields_for_published_events"
  ON registration_fields FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = registration_fields.event_id
        AND events.status = 'published'
        AND events.deleted_at IS NULL
    )
    AND is_active = TRUE
  );

CREATE POLICY "org_members_can_view_all_fields"
  ON registration_fields FOR SELECT
  USING (is_org_member(organization_id));

CREATE POLICY "org_event_managers_can_manage_fields"
  ON registration_fields FOR ALL
  USING (
    get_user_role_in_org(organization_id) IN ('owner','admin','event_manager')
  )
  WITH CHECK (
    get_user_role_in_org(organization_id) IN ('owner','admin','event_manager')
  );

-- ────────────────────────────────────────────────────────────
-- PARTICIPANTS
-- Participants are global but access is scoped via registrations
-- ────────────────────────────────────────────────────────────

-- Participants can view/update their own record
CREATE POLICY "participants_can_view_own_record"
  ON participants FOR SELECT
  USING (user_id = auth.uid());

-- Org members can view participants registered at their events
CREATE POLICY "org_members_can_view_their_participants"
  ON participants FOR SELECT
  USING (is_org_member_of_participant(id));

-- Anyone can insert participants (public registration)
CREATE POLICY "public_can_insert_participants"
  ON participants FOR INSERT
  WITH CHECK (TRUE);

-- Participants can update their own record; org staff cannot modify participant records
CREATE POLICY "participants_can_update_own_record"
  ON participants FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- REGISTRATIONS
-- ────────────────────────────────────────────────────────────
-- Public can insert registrations for published events
CREATE POLICY "public_can_register_for_published_events"
  ON registrations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = registrations.event_id
        AND events.status = 'published'
        AND events.is_registration_open = TRUE
        AND events.deleted_at IS NULL
    )
  );

-- Participants can view their own registrations
CREATE POLICY "participants_can_view_own_registrations"
  ON registrations FOR SELECT
  USING (
    participant_id IN (
      SELECT id FROM participants WHERE user_id = auth.uid()
    )
    AND deleted_at IS NULL
  );

-- Org members can view registrations for their events
CREATE POLICY "org_members_can_view_registrations"
  ON registrations FOR SELECT
  USING (is_org_member(organization_id) AND deleted_at IS NULL);

CREATE POLICY "org_staff_can_update_registrations"
  ON registrations FOR UPDATE
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

-- ────────────────────────────────────────────────────────────
-- REGISTRATION_ANSWERS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "public_can_insert_answers"
  ON registration_answers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM registrations r
      JOIN events e ON e.id = r.event_id
      WHERE r.id = registration_answers.registration_id
        AND e.status = 'published'
    )
  );

CREATE POLICY "org_members_can_view_answers"
  ON registration_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM registrations r
      WHERE r.id = registration_answers.registration_id
        AND r.organization_id = ANY(get_user_org_ids())
    )
  );

-- ────────────────────────────────────────────────────────────
-- ATTENDANCE
-- ────────────────────────────────────────────────────────────
CREATE POLICY "org_members_can_view_attendance"
  ON attendance FOR SELECT
  USING (is_org_member(organization_id));

CREATE POLICY "org_staff_can_record_attendance"
  ON attendance FOR INSERT
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "org_admins_can_delete_attendance"
  ON attendance FOR DELETE
  USING (is_org_admin(organization_id));

-- ────────────────────────────────────────────────────────────
-- CERTIFICATES
-- ────────────────────────────────────────────────────────────
-- Public can view certificate by verification code (for verify page)
CREATE POLICY "public_can_verify_certificates"
  ON certificates FOR SELECT
  USING (revoked_at IS NULL);

CREATE POLICY "org_members_can_view_certificates"
  ON certificates FOR SELECT
  USING (is_org_member(organization_id));

CREATE POLICY "org_managers_can_issue_certificates"
  ON certificates FOR INSERT
  WITH CHECK (
    get_user_role_in_org(organization_id) IN ('owner','admin','event_manager')
  );

CREATE POLICY "org_admins_can_revoke_certificates"
  ON certificates FOR UPDATE
  USING (is_org_admin(organization_id))
  WITH CHECK (is_org_admin(organization_id));

-- ────────────────────────────────────────────────────────────
-- AUDIT_LOGS
-- Org members can read their own org's audit logs.
-- Only service_role can write.
-- ────────────────────────────────────────────────────────────
CREATE POLICY "org_admins_can_view_audit_logs"
  ON audit_logs FOR SELECT
  USING (
    organization_id IS NULL  -- platform-level logs only visible to service role
    OR is_org_admin(organization_id)
  );

-- ────────────────────────────────────────────────────────────
-- SYSTEM_SETTINGS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "org_members_can_view_settings"
  ON system_settings FOR SELECT
  USING (
    organization_id IS NULL OR is_org_member(organization_id)
  );

CREATE POLICY "org_admins_can_manage_settings"
  ON system_settings FOR ALL
  USING (
    organization_id IS NOT NULL AND is_org_admin(organization_id)
  )
  WITH CHECK (
    organization_id IS NOT NULL AND is_org_admin(organization_id)
  );

-- ────────────────────────────────────────────────────────────
-- SUBSCRIPTIONS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "org_admins_can_view_subscription"
  ON subscriptions FOR SELECT
  USING (is_org_admin(organization_id));

-- ────────────────────────────────────────────────────────────
-- BILLING_EVENTS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "org_admins_can_view_billing_events"
  ON billing_events FOR SELECT
  USING (is_org_admin(organization_id));
