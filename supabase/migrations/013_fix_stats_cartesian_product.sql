-- Fix Cartesian product bugs in database stats helper functions
-- Redefine get_event_stats and get_org_dashboard_stats to run scalar counts/subqueries instead of multi-join aggregates.

-- 1. Redefine get_event_stats
CREATE OR REPLACE FUNCTION get_event_stats(p_event_id UUID)
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_total_regs INT;
  v_confirmed  INT;
  v_pending    INT;
  v_cancelled  INT;
  v_waitlisted INT;
  v_checked_in INT;
  v_certs      INT;
  v_capacity   INT;
  v_rate       DECIMAL;
  result       JSON;
BEGIN
  -- Get capacity
  SELECT capacity INTO v_capacity FROM events WHERE id = p_event_id AND deleted_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Count registrations
  SELECT 
    COUNT(*) FILTER (WHERE r.status IN ('confirmed','pending')),
    COUNT(*) FILTER (WHERE r.status = 'confirmed'),
    COUNT(*) FILTER (WHERE r.status = 'pending'),
    COUNT(*) FILTER (WHERE r.status = 'cancelled'),
    COUNT(*) FILTER (WHERE r.status = 'waitlisted')
  INTO 
    v_total_regs, v_confirmed, v_pending, v_cancelled, v_waitlisted
  FROM registrations r
  WHERE r.event_id = p_event_id AND r.deleted_at IS NULL;

  -- Count attendance (only active non-deleted registrations)
  SELECT COUNT(*) INTO v_checked_in
  FROM attendance a
  JOIN registrations r ON a.registration_id = r.id
  WHERE a.event_id = p_event_id AND r.deleted_at IS NULL;

  -- Count certificates (only active non-deleted registrations)
  SELECT COUNT(*) INTO v_certs
  FROM certificates c
  JOIN registrations r ON c.registration_id = r.id
  WHERE c.event_id = p_event_id AND c.revoked_at IS NULL AND r.deleted_at IS NULL;

  -- Calculate attendance rate based on total registrations (confirmed + pending)
  IF v_total_regs > 0 THEN
    -- Cap rate at 100.0%
    v_rate := LEAST(100.0, ROUND((v_checked_in::DECIMAL / v_total_regs) * 100.0, 1));
  ELSE
    v_rate := 0;
  END IF;

  SELECT json_build_object(
    'total_registrations',   COALESCE(v_total_regs, 0),
    'confirmed',             COALESCE(v_confirmed, 0),
    'pending',               COALESCE(v_pending, 0),
    'cancelled',             COALESCE(v_cancelled, 0),
    'waitlisted',            COALESCE(v_waitlisted, 0),
    'checked_in',            COALESCE(v_checked_in, 0),
    'certificates_issued',   COALESCE(v_certs, 0),
    'capacity',              v_capacity,
    'attendance_rate',       COALESCE(v_rate, 0)
  ) INTO result;

  RETURN result;
END;
$$;

-- 2. Redefine get_org_dashboard_stats
CREATE OR REPLACE FUNCTION get_org_dashboard_stats(p_org_id UUID)
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_total_events        INT;
  v_active_events       INT;
  v_total_regs          INT;
  v_total_confirmed     INT;
  v_total_att           INT;
  v_total_parts         INT;
  v_total_certs         INT;
  v_this_month_reg      INT;
  v_avg_rate            DECIMAL;
  result                JSON;
BEGIN
  -- Count events
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'published' AND end_date >= NOW())
  INTO v_total_events, v_active_events
  FROM events
  WHERE organization_id = p_org_id AND deleted_at IS NULL;

  -- Count registrations and participants
  SELECT 
    COUNT(*) FILTER (WHERE status IN ('confirmed','pending')),
    COUNT(*) FILTER (WHERE status = 'confirmed'),
    COUNT(DISTINCT participant_id) FILTER (WHERE status = 'confirmed'),
    COUNT(*) FILTER (WHERE status IN ('confirmed','pending') AND created_at >= date_trunc('month', NOW()))
  INTO v_total_regs, v_total_confirmed, v_total_parts, v_this_month_reg
  FROM registrations
  WHERE organization_id = p_org_id AND deleted_at IS NULL;

  -- Count attendance (only active non-deleted registrations)
  SELECT COUNT(*) INTO v_total_att
  FROM attendance a
  JOIN registrations r ON a.registration_id = r.id
  WHERE a.organization_id = p_org_id AND r.deleted_at IS NULL;

  -- Count certificates (only active non-deleted registrations)
  SELECT COUNT(*) INTO v_total_certs
  FROM certificates c
  JOIN registrations r ON c.registration_id = r.id
  WHERE c.organization_id = p_org_id AND c.revoked_at IS NULL AND r.deleted_at IS NULL;

  -- Calculate average attendance rate based on total registrations (confirmed + pending)
  IF v_total_regs > 0 THEN
    v_avg_rate := LEAST(100.0, ROUND((v_total_att::DECIMAL / v_total_regs) * 100.0, 1));
  ELSE
    v_avg_rate := 0;
  END IF;

  SELECT json_build_object(
    'total_events',            COALESCE(v_total_events, 0),
    'active_events',           COALESCE(v_active_events, 0),
    'total_registrations',     COALESCE(v_total_regs, 0),
    'total_attendance',        COALESCE(v_total_att, 0),
    'total_participants',      COALESCE(v_total_parts, 0),
    'total_certificates',      COALESCE(v_total_certs, 0),
    'this_month_registrations', COALESCE(v_this_month_reg, 0),
    'avg_attendance_rate',     COALESCE(v_avg_rate, 0)
  ) INTO result;

  RETURN result;
END;
$$;

-- 3. Create a trigger to confirm registration on attendance insert
CREATE OR REPLACE FUNCTION trigger_confirm_registration_on_attendance()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE registrations
  SET status = 'confirmed',
      approved_at = COALESCE(approved_at, NOW())
  WHERE id = NEW.registration_id
    AND status != 'confirmed';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_confirm_registration_on_attendance ON attendance;
CREATE TRIGGER trg_confirm_registration_on_attendance
  AFTER INSERT ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION trigger_confirm_registration_on_attendance();
