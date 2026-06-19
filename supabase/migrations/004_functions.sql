-- ============================================================
-- EventPass: 004_functions.sql
-- PostgreSQL stored functions and triggers for business logic
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- FUNCTION: Generate ticket number
-- Format: {PREFIX}-{YYYYMMDD}-{6-char random alphanum}
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_ticket_number(prefix TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no ambiguous chars
  result TEXT := '';
  i INTEGER;
  random_suffix TEXT := '';
BEGIN
  -- Generate 6-char random suffix
  FOR i IN 1..6 LOOP
    random_suffix := random_suffix || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;

  result := upper(prefix) || '-' || to_char(NOW(), 'YYYYMMDD') || '-' || random_suffix;
  RETURN result;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- FUNCTION: Generate certificate number
-- Format: CERT-{YYYY}-{ORG_SLUG_5}-{8-char random}
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_certificate_number(org_slug TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  random_part TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    random_part := random_part || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;

  RETURN 'CERT-' || to_char(NOW(), 'YYYY') || '-' || upper(left(org_slug, 5)) || '-' || random_part;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- FUNCTION: Generate event slug from title
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_event_slug(title TEXT, org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  suffix INTEGER := 0;
BEGIN
  -- Normalize: lowercase, replace spaces/special chars with hyphens
  base_slug := lower(regexp_replace(unaccent(title), '[^a-z0-9\s-]', '', 'g'));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  base_slug := left(base_slug, 80);

  final_slug := base_slug;

  -- Ensure uniqueness within org
  WHILE EXISTS (
    SELECT 1 FROM events
    WHERE organization_id = org_id AND slug = final_slug AND deleted_at IS NULL
  ) LOOP
    suffix := suffix + 1;
    final_slug := base_slug || '-' || suffix;
  END LOOP;

  RETURN final_slug;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- TRIGGER: Auto-generate event slug on insert
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_auto_event_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_event_slug(NEW.title, NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_event_slug ON events;
CREATE TRIGGER auto_event_slug
  BEFORE INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION trigger_auto_event_slug();

-- ────────────────────────────────────────────────────────────
-- FUNCTION: Get event registration stats
-- Returns counts for dashboard stats cards
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_event_stats(p_event_id UUID)
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_registrations',   COUNT(r.id) FILTER (WHERE r.status IN ('confirmed','pending')),
    'confirmed',             COUNT(r.id) FILTER (WHERE r.status = 'confirmed'),
    'pending',               COUNT(r.id) FILTER (WHERE r.status = 'pending'),
    'cancelled',             COUNT(r.id) FILTER (WHERE r.status = 'cancelled'),
    'waitlisted',            COUNT(r.id) FILTER (WHERE r.status = 'waitlisted'),
    'checked_in',            COUNT(a.id),
    'certificates_issued',   COUNT(c.id) FILTER (WHERE c.revoked_at IS NULL),
    'capacity',              e.capacity,
    'attendance_rate',       CASE WHEN COUNT(r.id) FILTER (WHERE r.status = 'confirmed') > 0
                               THEN ROUND(COUNT(a.id)::DECIMAL / COUNT(r.id) FILTER (WHERE r.status = 'confirmed') * 100, 1)
                               ELSE 0 END
  )
  INTO result
  FROM events e
  LEFT JOIN registrations r  ON r.event_id = e.id AND r.deleted_at IS NULL
  LEFT JOIN attendance a     ON a.event_id = e.id
  LEFT JOIN certificates c   ON c.event_id = e.id
  WHERE e.id = p_event_id
  GROUP BY e.id;

  RETURN result;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- FUNCTION: Get org dashboard summary
-- Used by dashboard module for top-level stats
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_org_dashboard_stats(p_org_id UUID)
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_events',          COUNT(DISTINCT e.id),
    'active_events',         COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'published' AND e.end_date >= NOW()),
    'total_registrations',   COUNT(r.id) FILTER (WHERE r.status IN ('confirmed','pending')),
    'total_attendance',      COUNT(a.id),
    'total_participants',    COUNT(DISTINCT r.participant_id) FILTER (WHERE r.status = 'confirmed'),
    'total_certificates',    COUNT(c.id) FILTER (WHERE c.revoked_at IS NULL),
    'this_month_registrations', COUNT(r.id) FILTER (
      WHERE r.status IN ('confirmed','pending')
        AND r.created_at >= date_trunc('month', NOW())
    )
  )
  INTO result
  FROM events e
  LEFT JOIN registrations r ON r.event_id = e.id AND r.deleted_at IS NULL
  LEFT JOIN attendance a    ON a.event_id = e.id
  LEFT JOIN certificates c  ON c.event_id = e.id
  WHERE e.organization_id = p_org_id AND e.deleted_at IS NULL;

  RETURN result;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- FUNCTION: Audit log writer (called from app via RPC)
-- Uses SECURITY DEFINER to bypass RLS for writes
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION write_audit_log(
  p_organization_id UUID,
  p_action          TEXT,
  p_resource_type   TEXT,
  p_resource_id     UUID DEFAULT NULL,
  p_before_data     JSONB DEFAULT NULL,
  p_after_data      JSONB DEFAULT NULL,
  p_ip_address      TEXT DEFAULT NULL,
  p_user_agent      TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO audit_logs (
    organization_id, user_id, action, resource_type, resource_id,
    before_data, after_data, ip_address, user_agent
  ) VALUES (
    p_organization_id, auth.uid(), p_action, p_resource_type, p_resource_id,
    p_before_data, p_after_data, p_ip_address::INET, p_user_agent
  )
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- FUNCTION: Check-in via QR (atomic, prevents duplicates)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION checkin_by_ticket(
  p_ticket_number TEXT,
  p_event_id      UUID,
  p_method        TEXT DEFAULT 'qr',
  p_device_info   TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_registration  registrations%ROWTYPE;
  v_participant   participants%ROWTYPE;
  v_existing      attendance%ROWTYPE;
  v_attendance_id UUID;
BEGIN
  -- Lock the registration row to prevent race conditions
  SELECT * INTO v_registration
  FROM registrations
  WHERE ticket_number = p_ticket_number
    AND event_id = p_event_id
    AND status = 'confirmed'
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', FALSE,
      'error', 'TICKET_NOT_FOUND',
      'message', 'Invalid or cancelled ticket'
    );
  END IF;

  -- Check for duplicate
  SELECT * INTO v_existing
  FROM attendance
  WHERE registration_id = v_registration.id;

  IF FOUND THEN
    SELECT * INTO v_participant FROM participants WHERE id = v_registration.participant_id;
    RETURN json_build_object(
      'success', FALSE,
      'error', 'ALREADY_CHECKED_IN',
      'message', 'Participant already checked in',
      'checked_in_at', v_existing.checked_in_at,
      'participant_name', v_participant.first_name || ' ' || v_participant.last_name
    );
  END IF;

  -- Record attendance
  INSERT INTO attendance (
    registration_id, event_id, organization_id, participant_id,
    checked_in_by, check_in_method, device_info
  ) VALUES (
    v_registration.id, p_event_id, v_registration.organization_id, v_registration.participant_id,
    auth.uid(), p_method, p_device_info
  )
  RETURNING id INTO v_attendance_id;

  -- Fetch participant info for response
  SELECT * INTO v_participant FROM participants WHERE id = v_registration.participant_id;

  RETURN json_build_object(
    'success', TRUE,
    'attendance_id', v_attendance_id,
    'ticket_number', p_ticket_number,
    'participant_name', v_participant.first_name || ' ' || v_participant.last_name,
    'participant_email', v_participant.email,
    'checked_in_at', NOW()
  );
END;
$$;

-- ────────────────────────────────────────────────────────────
-- FUNCTION: Register participant (atomic, handles upsert + ticket)
-- Called from Edge Function / public form
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION register_participant(
  p_event_id      UUID,
  p_email         TEXT,
  p_first_name    TEXT,
  p_last_name     TEXT,
  p_phone         TEXT DEFAULT NULL,
  p_is_walk_in    BOOLEAN DEFAULT FALSE,
  p_answers       JSONB DEFAULT '[]'  -- [{field_id, answer}]
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event          events%ROWTYPE;
  v_participant_id UUID;
  v_registration   registrations%ROWTYPE;
  v_ticket_number  TEXT;
  v_qr_payload     TEXT;
  v_answer         JSONB;
BEGIN
  -- Validate event exists and is accepting registrations
  SELECT * INTO v_event
  FROM events
  WHERE id = p_event_id
    AND status = 'published'
    AND is_registration_open = TRUE
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'error', 'EVENT_NOT_AVAILABLE',
      'message', 'This event is not currently accepting registrations');
  END IF;

  -- Check capacity
  IF v_event.capacity IS NOT NULL THEN
    IF (SELECT COUNT(*) FROM registrations
        WHERE event_id = p_event_id AND status IN ('confirmed','pending') AND deleted_at IS NULL
       ) >= v_event.capacity THEN
      IF v_event.is_waitlist_enabled THEN
        -- Future: add to waitlist
        RETURN json_build_object('success', FALSE, 'error', 'EVENT_FULL_WAITLIST',
          'message', 'This event is full. You have been added to the waitlist.');
      ELSE
        RETURN json_build_object('success', FALSE, 'error', 'EVENT_FULL',
          'message', 'This event is at full capacity');
      END IF;
    END IF;
  END IF;

  -- Upsert participant (global registry)
  INSERT INTO participants (email, first_name, last_name, phone)
  VALUES (lower(trim(p_email)), p_first_name, p_last_name, p_phone)
  ON CONFLICT (email) DO UPDATE
    SET first_name = EXCLUDED.first_name,
        last_name  = EXCLUDED.last_name,
        phone      = COALESCE(EXCLUDED.phone, participants.phone),
        updated_at = NOW()
  RETURNING id INTO v_participant_id;

  -- Check if already registered
  IF EXISTS (
    SELECT 1 FROM registrations
    WHERE event_id = p_event_id AND participant_id = v_participant_id AND deleted_at IS NULL
  ) THEN
    RETURN json_build_object('success', FALSE, 'error', 'ALREADY_REGISTERED',
      'message', 'You are already registered for this event');
  END IF;

  -- Generate ticket number
  v_ticket_number := generate_ticket_number(v_event.ticket_prefix);

  -- Build QR payload (base64 of JSON)
  v_qr_payload := encode(
    convert_to(
      json_build_object(
        'type', 'eventpass_v1',
        'eid', p_event_id,
        'pid', v_participant_id,
        'tc', v_ticket_number
      )::TEXT,
      'UTF8'
    ),
    'base64'
  );

  -- Create registration
  INSERT INTO registrations (
    event_id, organization_id, participant_id,
    ticket_number, qr_payload, status, is_walk_in,
    requires_approval
  ) VALUES (
    p_event_id, v_event.organization_id, v_participant_id,
    v_ticket_number, v_qr_payload,
    CASE WHEN v_event.requires_approval THEN 'pending' ELSE 'confirmed' END,
    p_is_walk_in, v_event.requires_approval
  )
  RETURNING * INTO v_registration;

  -- Insert custom field answers
  FOR v_answer IN SELECT * FROM jsonb_array_elements(p_answers) LOOP
    INSERT INTO registration_answers (registration_id, field_id, answer)
    VALUES (
      v_registration.id,
      (v_answer->>'field_id')::UUID,
      v_answer->>'answer'
    )
    ON CONFLICT (registration_id, field_id) DO UPDATE SET answer = EXCLUDED.answer;
  END LOOP;

  RETURN json_build_object(
    'success', TRUE,
    'registration_id', v_registration.id,
    'ticket_number', v_ticket_number,
    'qr_payload', v_qr_payload,
    'status', v_registration.status,
    'participant_id', v_participant_id
  );
END;
$$;

-- ────────────────────────────────────────────────────────────
-- FUNCTION: create_organization (SECURITY DEFINER)
-- Atomically creates org + owner membership + free subscription.
-- Solves RLS chicken-and-egg: new users have no org membership yet,
-- so they can't pass the org_admins_can_insert_members policy.
-- This function runs as DB owner and bypasses RLS.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_organization(
  p_name        TEXT,
  p_slug        TEXT,
  p_description TEXT  DEFAULT NULL,
  p_country     TEXT  DEFAULT 'NG',
  p_timezone    TEXT  DEFAULT 'Africa/Lagos',
  p_website     TEXT  DEFAULT NULL,
  p_email       TEXT  DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id  UUID;
  v_user_id UUID := auth.uid();
  v_slug    TEXT;
  v_suffix  INTEGER := 0;
BEGIN
  -- Must be authenticated
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'UNAUTHENTICATED',
      'message', 'You must be signed in to create an organization');
  END IF;

  -- Sanitize slug: lowercase, alphanumeric + hyphens only
  v_slug := lower(regexp_replace(
    regexp_replace(trim(p_slug), '[^a-z0-9\s-]', '', 'g'),
    '[\s]+', '-', 'g'
  ));
  v_slug := regexp_replace(v_slug, '-+', '-', 'g');
  v_slug := trim(both '-' from v_slug);

  -- Ensure slug uniqueness
  WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = v_slug) LOOP
    v_suffix := v_suffix + 1;
    v_slug := v_slug || '-' || v_suffix;
  END LOOP;

  -- Create organization
  INSERT INTO organizations (
    name, slug, description, country, timezone, website, email, is_active
  ) VALUES (
    trim(p_name), v_slug, p_description, p_country, p_timezone, p_website, p_email, TRUE
  )
  RETURNING id INTO v_org_id;

  -- Add calling user as owner (bypasses RLS — this is the bootstrap step)
  INSERT INTO organization_members (
    organization_id, user_id, role, accepted_at, is_active
  ) VALUES (
    v_org_id, v_user_id, 'owner', NOW(), TRUE
  );

  -- Create free subscription
  INSERT INTO subscriptions (
    organization_id, plan, status, event_limit, participant_limit
  ) VALUES (
    v_org_id, 'free', 'active', 5, 500
  );

  RETURN json_build_object(
    'success',  TRUE,
    'org_id',   v_org_id,
    'slug',     v_slug,
    'name',     trim(p_name)
  );
END;
$$;

