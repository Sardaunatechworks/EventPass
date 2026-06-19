-- ============================================================
-- EventPass: 005_seed_data.sql
-- Development seed data — DO NOT run in production
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Global system settings
-- ────────────────────────────────────────────────────────────
INSERT INTO system_settings (organization_id, key, value) VALUES
  (NULL, 'platform.name',               '"EventPass"'),
  (NULL, 'platform.support_email',      '"support@eventpass.africa"'),
  (NULL, 'platform.default_timezone',   '"Africa/Lagos"'),
  (NULL, 'platform.default_currency',   '"NGN"'),
  (NULL, 'platform.max_events_free',    '5'),
  (NULL, 'platform.max_participants',   '500'),
  (NULL, 'email.from_address',          '"noreply@eventpass.africa"'),
  (NULL, 'email.from_name',             '"EventPass"');

-- ────────────────────────────────────────────────────────────
-- NOTE: Actual user/org seed data must be inserted AFTER
-- creating auth users via Supabase dashboard or CLI.
--
-- Use the README seed instructions to:
--   1. Create a Supabase auth user
--   2. Insert an organization record
--   3. Insert an organization_members record linking the auth user
--   4. Insert a subscription record
--
-- Sample SQL (fill in real UUIDs after creating auth users):
-- ────────────────────────────────────────────────────────────

/*
-- EXAMPLE: Run after creating auth user via Supabase Studio

-- 1. Create demo organization
INSERT INTO organizations (id, name, slug, email, country, primary_color)
VALUES (
  'a1b2c3d4-0000-0000-0000-000000000001',
  'TechFort Africa',
  'techfort',
  'admin@techfort.africa',
  'NG',
  '#2563EB'
);

-- 2. Link owner (replace with real auth.users.id)
INSERT INTO organization_members (organization_id, user_id, role, accepted_at)
VALUES (
  'a1b2c3d4-0000-0000-0000-000000000001',
  'REPLACE-WITH-REAL-AUTH-USER-UUID',
  'owner',
  NOW()
);

-- 3. Create free subscription
INSERT INTO subscriptions (organization_id, plan, status, event_limit, participant_limit)
VALUES (
  'a1b2c3d4-0000-0000-0000-000000000001',
  'free',
  'active',
  5,
  500
);

-- 4. Sample event
INSERT INTO events (
  id, organization_id, title, description, event_type, status,
  start_date, end_date, location_name, capacity, certificate_enabled,
  created_by
) VALUES (
  'e1e2e3e4-0000-0000-0000-000000000001',
  'a1b2c3d4-0000-0000-0000-000000000001',
  'TechFort Dev Summit 2026',
  'Annual developer summit bringing together Africa''s top engineers.',
  'conference',
  'published',
  NOW() + INTERVAL '7 days',
  NOW() + INTERVAL '9 days',
  'Landmark Event Centre, Lagos',
  500,
  TRUE,
  'REPLACE-WITH-REAL-AUTH-USER-UUID'
);
*/
