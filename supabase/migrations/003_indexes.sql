-- ============================================================
-- EventPass: 003_indexes.sql
-- Performance indexes for all hot query paths
-- ============================================================

-- ── organizations ───────────────────────────────────────────
CREATE INDEX idx_organizations_slug        ON organizations(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_organizations_is_active   ON organizations(is_active) WHERE deleted_at IS NULL;

-- ── organization_members ────────────────────────────────────
CREATE INDEX idx_org_members_user_id       ON organization_members(user_id);
CREATE INDEX idx_org_members_org_id        ON organization_members(organization_id);
CREATE INDEX idx_org_members_role          ON organization_members(organization_id, role);
CREATE INDEX idx_org_members_active        ON organization_members(user_id, is_active);

-- ── programs ────────────────────────────────────────────────
CREATE INDEX idx_programs_org_id           ON programs(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_programs_status           ON programs(organization_id, status) WHERE deleted_at IS NULL;

-- ── events ──────────────────────────────────────────────────
CREATE INDEX idx_events_org_id             ON events(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_program_id         ON events(program_id) WHERE program_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_events_status             ON events(organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_start_date         ON events(organization_id, start_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_published          ON events(status) WHERE status = 'published' AND deleted_at IS NULL;
CREATE INDEX idx_events_slug               ON events(organization_id, slug) WHERE deleted_at IS NULL;

-- ── event_staff ─────────────────────────────────────────────
CREATE INDEX idx_event_staff_event_id      ON event_staff(event_id);
CREATE INDEX idx_event_staff_user_id       ON event_staff(user_id);
CREATE INDEX idx_event_staff_org_id        ON event_staff(organization_id);

-- ── registration_fields ─────────────────────────────────────
CREATE INDEX idx_reg_fields_event_id       ON registration_fields(event_id) WHERE is_active = TRUE;

-- ── participants ─────────────────────────────────────────────
CREATE INDEX idx_participants_email        ON participants(email);
CREATE INDEX idx_participants_user_id      ON participants(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_participants_name_search  ON participants USING GIN (
  to_tsvector('english', first_name || ' ' || last_name || ' ' || COALESCE(email,''))
);

-- ── registrations ───────────────────────────────────────────
CREATE INDEX idx_registrations_event_id       ON registrations(event_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_registrations_org_id         ON registrations(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_registrations_participant_id ON registrations(participant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_registrations_ticket_number  ON registrations(ticket_number);
CREATE INDEX idx_registrations_status         ON registrations(event_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_registrations_created_at     ON registrations(event_id, created_at DESC) WHERE deleted_at IS NULL;

-- ── registration_answers ────────────────────────────────────
CREATE INDEX idx_reg_answers_registration_id  ON registration_answers(registration_id);
CREATE INDEX idx_reg_answers_field_id         ON registration_answers(field_id);

-- ── attendance ──────────────────────────────────────────────
CREATE INDEX idx_attendance_event_id       ON attendance(event_id);
CREATE INDEX idx_attendance_org_id         ON attendance(organization_id);
CREATE INDEX idx_attendance_participant_id ON attendance(participant_id);
CREATE INDEX idx_attendance_checked_in_at  ON attendance(event_id, checked_in_at DESC);

-- ── certificates ────────────────────────────────────────────
CREATE INDEX idx_certificates_event_id          ON certificates(event_id);
CREATE INDEX idx_certificates_org_id            ON certificates(organization_id);
CREATE INDEX idx_certificates_participant_id    ON certificates(participant_id);
CREATE INDEX idx_certificates_verification_code ON certificates(verification_code);
CREATE INDEX idx_certificates_cert_number       ON certificates(certificate_number);

-- ── audit_logs ──────────────────────────────────────────────
CREATE INDEX idx_audit_logs_org_id         ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_user_id        ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_resource       ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_action         ON audit_logs(action, created_at DESC);

-- ── system_settings ─────────────────────────────────────────
CREATE INDEX idx_system_settings_org_key   ON system_settings(organization_id, key);

-- ── subscriptions ───────────────────────────────────────────
CREATE INDEX idx_subscriptions_org_id      ON subscriptions(organization_id);
CREATE INDEX idx_subscriptions_status      ON subscriptions(status);

-- ── billing_events ──────────────────────────────────────────
CREATE INDEX idx_billing_events_org_id     ON billing_events(organization_id, created_at DESC);
CREATE INDEX idx_billing_events_sub_id     ON billing_events(subscription_id);
