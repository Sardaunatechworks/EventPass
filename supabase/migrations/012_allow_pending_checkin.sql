-- Update checkin_by_ticket to support checking in pending registrations
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
  -- Allow both confirmed and pending registrations to be checked in
  SELECT * INTO v_registration
  FROM registrations
  WHERE ticket_number = p_ticket_number
    AND event_id = p_event_id
    AND status IN ('confirmed', 'pending')
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

  -- If status is pending, confirm the registration on check-in
  IF v_registration.status = 'pending' THEN
    UPDATE registrations
    SET status = 'confirmed',
        approved_at = NOW()
    WHERE id = v_registration.id;
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
