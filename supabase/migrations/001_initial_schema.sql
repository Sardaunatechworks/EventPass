-- ============================================================
-- EventPass: 001_initial_schema.sql
-- Production Multi-Tenant SaaS Platform
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- ============================================================
-- UTILITY: Auto-update updated_at timestamp
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================
-- TABLE: organizations
-- Root tenant entity. All data scopes from here.
-- ============================================================
CREATE TABLE organizations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,           -- URL-safe identifier (e.g. "techfort")
  logo_url          TEXT,
  website           TEXT,
  description       TEXT,
  primary_color     TEXT NOT NULL DEFAULT '#2563EB',
  secondary_color   TEXT NOT NULL DEFAULT '#1D4ED8',
  address           TEXT,
  phone             TEXT,
  email             TEXT,
  country           TEXT NOT NULL DEFAULT 'NG',
  timezone          TEXT NOT NULL DEFAULT 'Africa/Lagos',
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  subscription_tier TEXT NOT NULL DEFAULT 'free'
                    CHECK (subscription_tier IN ('free','starter','growth','enterprise')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- TABLE: organization_members
-- Maps auth.users to organizations with RBAC roles
-- ============================================================
CREATE TABLE organization_members (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'staff'
                  CHECK (role IN ('owner','admin','event_manager','staff','volunteer')),
  invited_by      UUID REFERENCES auth.users(id),
  invite_email    TEXT,
  invited_at      TIMESTAMPTZ,
  accepted_at     TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);

CREATE TRIGGER set_organization_members_updated_at
  BEFORE UPDATE ON organization_members
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- TABLE: programs
-- Optional grouping for events (Phase 2 visible, schema-ready now)
-- Organization → Program → Event → Registration → Attendance → Certificate
-- ============================================================
CREATE TABLE programs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  program_type    TEXT NOT NULL DEFAULT 'training'
                  CHECK (program_type IN ('fellowship','bootcamp','training','cohort','conference','workshop','initiative')),
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','active','completed','archived')),
  start_date      DATE,
  end_date        DATE,
  capacity        INTEGER,
  banner_url      TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE TRIGGER set_programs_updated_at
  BEFORE UPDATE ON programs
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- TABLE: events
-- Core event entity. Can belong to a program (nullable).
-- ============================================================
CREATE TABLE events (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  program_id              UUID REFERENCES programs(id) ON DELETE SET NULL,  -- nullable
  title                   TEXT NOT NULL,
  slug                    TEXT,                                              -- auto-generated
  description             TEXT,
  event_type              TEXT NOT NULL DEFAULT 'event'
                          CHECK (event_type IN ('conference','workshop','seminar','training',
                                                'meetup','webinar','bootcamp','ceremony','event')),
  status                  TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','published','ended','archived')),
  start_date              TIMESTAMPTZ NOT NULL,
  end_date                TIMESTAMPTZ NOT NULL,
  timezone                TEXT NOT NULL DEFAULT 'Africa/Lagos',
  location_name           TEXT,
  location_address        TEXT,
  location_lat            DECIMAL(10, 7),
  location_lng            DECIMAL(10, 7),
  is_virtual              BOOLEAN NOT NULL DEFAULT FALSE,
  virtual_link            TEXT,
  capacity                INTEGER,                                           -- NULL = unlimited
  registration_limit      INTEGER,
  is_waitlist_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  is_registration_open    BOOLEAN NOT NULL DEFAULT TRUE,
  registration_opens_at   TIMESTAMPTZ,
  registration_closes_at  TIMESTAMPTZ,
  banner_url              TEXT,
  ticket_prefix           TEXT NOT NULL DEFAULT 'TKT',
  requires_approval       BOOLEAN NOT NULL DEFAULT FALSE,
  is_free                 BOOLEAN NOT NULL DEFAULT TRUE,
  price                   DECIMAL(12, 2),
  currency                TEXT NOT NULL DEFAULT 'NGN',
  certificate_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  certificate_template    TEXT,
  created_by              UUID REFERENCES auth.users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at              TIMESTAMPTZ,
  CONSTRAINT chk_event_dates CHECK (end_date >= start_date)
);

CREATE TRIGGER set_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- TABLE: event_staff
-- Per-event staff / volunteer assignments
-- ============================================================
CREATE TABLE event_staff (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'staff'
                  CHECK (role IN ('manager','staff','volunteer','checker')),
  assigned_by     UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

-- ============================================================
-- TABLE: registration_fields
-- Custom form fields per event
-- ============================================================
CREATE TABLE registration_fields (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  field_name      TEXT NOT NULL,             -- machine name e.g. "job_title"
  field_label     TEXT NOT NULL,             -- display label e.g. "Job Title"
  field_type      TEXT NOT NULL DEFAULT 'text'
                  CHECK (field_type IN ('text','email','phone','textarea',
                                        'select','checkbox','radio','date','number','url')),
  is_required     BOOLEAN NOT NULL DEFAULT FALSE,
  options         JSONB,                     -- for select/radio/checkbox: [{"value":"x","label":"X"}]
  field_order     INTEGER NOT NULL DEFAULT 0,
  placeholder     TEXT,
  help_text       TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: participants
-- GLOBAL participant registry — one record per person ever.
-- A participant can register across multiple organizations.
-- ============================================================
CREATE TABLE participants (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID REFERENCES auth.users(id),   -- nullable: not all have accounts
  email             TEXT NOT NULL,
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  phone             TEXT,
  gender            TEXT CHECK (gender IN ('male','female','non_binary','prefer_not_to_say')),
  date_of_birth     DATE,
  country           TEXT DEFAULT 'NG',
  state             TEXT,
  city              TEXT,
  organization_name TEXT,                             -- their employer/institution
  job_title         TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT participants_email_unique UNIQUE (email)
);

CREATE TRIGGER set_participants_updated_at
  BEFORE UPDATE ON participants
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- TABLE: registrations
-- Links participant ↔ event. Holds ticket + QR data.
-- ============================================================
CREATE TABLE registrations (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id            UUID NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  participant_id      UUID NOT NULL REFERENCES participants(id) ON DELETE RESTRICT,
  ticket_number       TEXT NOT NULL,
  qr_payload          TEXT NOT NULL,           -- base64-encoded signed payload
  status              TEXT NOT NULL DEFAULT 'confirmed'
                      CHECK (status IN ('pending','confirmed','cancelled','waitlisted','rejected')),
  registration_source TEXT NOT NULL DEFAULT 'web'
                      CHECK (registration_source IN ('web','api','import','walk-in','staff')),
  is_walk_in          BOOLEAN NOT NULL DEFAULT FALSE,
  requires_approval   BOOLEAN NOT NULL DEFAULT FALSE,
  approved_at         TIMESTAMPTZ,
  approved_by         UUID REFERENCES auth.users(id),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,
  UNIQUE (event_id, participant_id),
  UNIQUE (ticket_number)
);

CREATE TRIGGER set_registrations_updated_at
  BEFORE UPDATE ON registrations
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- TABLE: registration_answers
-- Custom form field answers per registration
-- ============================================================
CREATE TABLE registration_answers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  field_id        UUID NOT NULL REFERENCES registration_fields(id) ON DELETE CASCADE,
  answer          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (registration_id, field_id)
);

-- ============================================================
-- TABLE: attendance
-- Check-in records. Separate from registrations for audit trail.
-- ============================================================
CREATE TABLE attendance (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  registration_id  UUID NOT NULL REFERENCES registrations(id) ON DELETE RESTRICT,
  event_id         UUID NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  participant_id   UUID NOT NULL REFERENCES participants(id) ON DELETE RESTRICT,
  checked_in_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checked_in_by    UUID REFERENCES auth.users(id),
  check_in_method  TEXT NOT NULL DEFAULT 'qr'
                   CHECK (check_in_method IN ('qr','manual','walk-in','import')),
  device_info      TEXT,
  notes            TEXT,
  UNIQUE (registration_id)   -- one check-in record per registration (prevents duplicates)
);

-- ============================================================
-- TABLE: certificates
-- Issued completion certificates with verification codes
-- ============================================================
CREATE TABLE certificates (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  registration_id     UUID NOT NULL REFERENCES registrations(id) ON DELETE RESTRICT,
  event_id            UUID NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  participant_id      UUID NOT NULL REFERENCES participants(id) ON DELETE RESTRICT,
  certificate_number  TEXT NOT NULL,
  verification_code   TEXT NOT NULL,
  template_data       JSONB,           -- snapshot of cert data at issuance time
  pdf_url             TEXT,            -- Supabase Storage signed URL
  issued_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  issued_by           UUID REFERENCES auth.users(id),
  revoked_at          TIMESTAMPTZ,
  revoked_by          UUID REFERENCES auth.users(id),
  revoke_reason       TEXT,
  UNIQUE (certificate_number),
  UNIQUE (verification_code),
  UNIQUE (registration_id)             -- one certificate per registration
);

-- ============================================================
-- TABLE: audit_logs
-- Immutable action trail. INSERT only via service role.
-- ============================================================
CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action          TEXT NOT NULL,       -- e.g. "event.created", "attendance.recorded"
  resource_type   TEXT NOT NULL,       -- e.g. "event", "registration", "certificate"
  resource_id     UUID,
  before_data     JSONB,
  after_data      JSONB,
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: system_settings
-- Global and per-org key-value config store
-- ============================================================
CREATE TABLE system_settings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,  -- NULL = global
  key             TEXT NOT NULL,
  value           JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, key)
);

CREATE TRIGGER set_system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- TABLE: subscriptions
-- Billing tier per organization (Paystack-ready)
-- ============================================================
CREATE TABLE subscriptions (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  plan                    TEXT NOT NULL DEFAULT 'free'
                          CHECK (plan IN ('free','starter','growth','enterprise')),
  status                  TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','cancelled','past_due','trialing','expired')),
  paystack_customer_id    TEXT,
  paystack_subscription_id TEXT,
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  trial_ends_at           TIMESTAMPTZ,
  event_limit             INTEGER DEFAULT 5,    -- events per billing period
  participant_limit       INTEGER DEFAULT 500,  -- participants per billing period
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- TABLE: billing_events
-- Append-only Paystack webhook log
-- ============================================================
CREATE TABLE billing_events (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id  UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  event_type       TEXT NOT NULL,    -- e.g. "subscription.create", "charge.success"
  amount           DECIMAL(12, 2),
  currency         TEXT DEFAULT 'NGN',
  paystack_ref     TEXT,
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
